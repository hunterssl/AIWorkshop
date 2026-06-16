/**
 * 灵影平台共享登录桥：为 fetch 自动附加 rh-studio-session / comfy-user。
 * 创作工坊、应用中心、无限画布共用同一套 sessionStorage 登录态。
 */
(function () {
  const USER_KEY = "rh_studio_user_id";
  const TOKEN_KEY = "rh_studio_session_token";
  const AUTH_KEY = "rh_studio_authed_user_id";
  const REMEMBER_KEY = "rh_studio_remember_login";
  const CREDS_KEY = "rh_studio_login_credentials";
  const PERSIST_TOKEN_KEY = "rh_studio_persist_session_token";
  const PERSIST_AUTH_KEY = "rh_studio_persist_authed_user_id";

  function encodeCredential(value) {
    try {
      return btoa(unescape(encodeURIComponent(String(value || ""))));
    } catch (_) {
      return "";
    }
  }

  function decodeCredential(value) {
    try {
      return decodeURIComponent(escape(atob(String(value || ""))));
    } catch (_) {
      return "";
    }
  }

  function isRememberLoginEnabled() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function restorePersistentSession() {
    if (!isRememberLoginEnabled()) return;
    try {
      const token = localStorage.getItem(PERSIST_TOKEN_KEY) || "";
      const authedId = localStorage.getItem(PERSIST_AUTH_KEY) || "";
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      if (authedId) sessionStorage.setItem(AUTH_KEY, authedId);
    } catch (_) {}
  }

  function syncStudioUserToComfy(userId, displayName) {
    let id = String(userId || localStorage.getItem(USER_KEY) || "").trim();
    if (!id) return "";
    try {
      localStorage.setItem(USER_KEY, id);
      localStorage.setItem("Comfy.userId", id);
      const name = String(
        displayName || localStorage.getItem("Comfy.userName") || id.split("_")[0] || id
      ).trim();
      localStorage.setItem("Comfy.userName", name);
      document.cookie = `rh_studio_user_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
      const api = window.comfyAPI?.api?.api;
      if (api) api.user = id;
    } catch (_) {}
    return id;
  }

  function readAuthHeaders() {
    const headers = {};
    try {
      const token = sessionStorage.getItem(TOKEN_KEY) || "";
      const userId = syncStudioUserToComfy();
      const authedId = sessionStorage.getItem(AUTH_KEY) || "";
      if (token && authedId && authedId === userId) {
        headers["rh-studio-session"] = token;
      }
      if (userId) headers["Comfy-User"] = userId;
    } catch (_) {}
    return headers;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    const authHeaders = readAuthHeaders();
    for (const [key, value] of Object.entries(authHeaders)) {
      if (value && !headers.has(key)) headers.set(key, value);
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    return originalFetch(input, { ...init, headers });
  };

  function notifyAuthChange() {
    window.dispatchEvent(new CustomEvent("rh-studio-auth-change"));
  }

  function loadSavedCredentials() {
    if (!isRememberLoginEnabled()) return null;
    try {
      const raw = localStorage.getItem(CREDS_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const username = decodeCredential(data?.u);
      const password = decodeCredential(data?.p);
      if (!username && !password) return null;
      return { username, password };
    } catch (_) {
      return null;
    }
  }

  function saveSavedCredentials(username, password) {
    try {
      localStorage.setItem(
        CREDS_KEY,
        JSON.stringify({
          u: encodeCredential(username),
          p: encodeCredential(password),
        }),
      );
    } catch (_) {}
  }

  function clearSavedCredentials() {
    try {
      localStorage.removeItem(CREDS_KEY);
    } catch (_) {}
  }

  function clearPersistentSession() {
    try {
      localStorage.removeItem(PERSIST_TOKEN_KEY);
      localStorage.removeItem(PERSIST_AUTH_KEY);
    } catch (_) {}
  }

  function applyRememberLogin({ remember, username, password, token, userId }) {
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, "1");
        saveSavedCredentials(username, password);
        const sessionToken = String(token || "").trim();
        const authedId = String(userId || "").trim();
        if (sessionToken) localStorage.setItem(PERSIST_TOKEN_KEY, sessionToken);
        if (authedId) localStorage.setItem(PERSIST_AUTH_KEY, authedId);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        clearPersistentSession();
        clearSavedCredentials();
      }
    } catch (_) {}
  }

  restorePersistentSession();

  window.RhStudioAuth = {
    keys: { USER_KEY, TOKEN_KEY, AUTH_KEY, REMEMBER_KEY, CREDS_KEY },
    readAuthHeaders,
    getUserId() {
      try {
        return localStorage.getItem(USER_KEY) || "";
      } catch {
        return "";
      }
    },
    getSessionToken() {
      try {
        return sessionStorage.getItem(TOKEN_KEY) || "";
      } catch {
        return "";
      }
    },
    isAuthed() {
      try {
        const userId = localStorage.getItem(USER_KEY) || "";
        const token = sessionStorage.getItem(TOKEN_KEY) || "";
        const authedId = sessionStorage.getItem(AUTH_KEY) || "";
        return Boolean(token && userId && authedId === userId);
      } catch {
        return false;
      }
    },
    isRememberLoginEnabled,
    loadSavedCredentials,
    applyRememberLogin,
    clearPersistentSession,
    clearSavedCredentials,
    clearAuth() {
      try {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
      clearPersistentSession();
      notifyAuthChange();
    },
    syncComfyUser: syncStudioUserToComfy,
    notifyAuthChange() {
      window.dispatchEvent(new CustomEvent("rh-studio-auth-change"));
    },
  };
})();
