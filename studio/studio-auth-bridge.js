/**
 * 灵影平台共享登录桥：为 fetch 自动附加 rh-studio-session / comfy-user。
 * 创作工坊、应用中心、无限画布共用同一套 sessionStorage 登录态。
 */
(function () {
  const USER_KEY = "rh_studio_user_id";
  const TOKEN_KEY = "rh_studio_session_token";
  const AUTH_KEY = "rh_studio_authed_user_id";

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

  window.RhStudioAuth = {
    keys: { USER_KEY, TOKEN_KEY, AUTH_KEY },
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
    clearAuth() {
      try {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
      notifyAuthChange();
    },
    syncComfyUser: syncStudioUserToComfy,
    notifyAuthChange() {
      window.dispatchEvent(new CustomEvent("rh-studio-auth-change"));
    },
  };
})();
