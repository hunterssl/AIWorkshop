const state = {
  apps: [],
  appDetail: null,
  runMessage: "",
  history: [],
  currentParams: {},
  outputMedia: [],
  paramUploads: {},
  lastPromptId: "",
  activeCategory: "all",
  searchQuery: "",
  sortBy: "updated_desc",
  livePollPromptId: "",
  livePollTimer: null,
  historyCollapsed: false,
};
let deletingAppIds = new Set();
let mediaPreviewHost = null;

const STUDIO_USER_STORAGE_KEY = "rh_studio_user_id";
const STUDIO_AUTH_SESSION_KEY = "rh_studio_authed_user_id";
const STUDIO_SESSION_TOKEN_KEY = "rh_studio_session_token";
const STUDIO_MIN_PASSWORD_LENGTH = 6;
const HISTORY_COLLAPSED_STORAGE_KEY = "rh_portal_history_collapsed_v1";

let portalMultiUserEnabled = false;
/** @type {Record<string, string>} */
let portalUsersMap = {};
let portalUserId = "default";

function qs(selector) {
  return document.querySelector(selector);
}

function bindIfExists(selector, eventName, handler) {
  const el = qs(selector);
  if (!el) return false;
  el.addEventListener(eventName, handler);
  return true;
}

function loadHistoryCollapsedState() {
  try {
    return localStorage.getItem(HISTORY_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setHistoryCollapsedState(collapsed) {
  state.historyCollapsed = Boolean(collapsed);
  try {
    localStorage.setItem(HISTORY_COLLAPSED_STORAGE_KEY, state.historyCollapsed ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

function bindHistoryPanelToggle(root) {
  const toggle = root?.querySelector("#btnHistoryToggle");
  if (!toggle) return;
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setHistoryCollapsedState(!state.historyCollapsed);
    renderAppDetail();
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureMediaPreviewHost() {
  if (mediaPreviewHost) return mediaPreviewHost;
  const host = document.createElement("div");
  host.className = "media-preview hidden";
  host.innerHTML = `
    <div class="media-preview-backdrop" data-preview-close="1"></div>
    <div class="media-preview-dialog">
      <button type="button" class="media-preview-close" data-preview-close="1">关闭</button>
      <div class="media-preview-content" id="mediaPreviewContent"></div>
    </div>
  `;
  document.body.appendChild(host);
  host.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest("[data-preview-close='1']")) return;
    hideMediaPreview();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideMediaPreview();
  });
  mediaPreviewHost = host;
  return mediaPreviewHost;
}

function hideMediaPreview() {
  const host = ensureMediaPreviewHost();
  host.classList.add("hidden");
  const content = host.querySelector("#mediaPreviewContent");
  if (content) content.innerHTML = "";
}

function showMediaPreview(kind, url) {
  if (!url) return;
  const host = ensureMediaPreviewHost();
  const content = host.querySelector("#mediaPreviewContent");
  if (!content) return;
  content.innerHTML = kind === "video"
    ? `<video src="${escapeHtml(url)}" controls autoplay></video>`
    : `<img src="${escapeHtml(url)}" alt="" />`;
  host.classList.remove("hidden");
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uploadInputId(paramKey) {
  const safe = String(paramKey || "file").replace(/[^\w-]/g, "_");
  return `upload_input_${safe}`;
}

function buildViewUrl(file) {
  if (!file || !file.filename) return "";
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  return `/view?${params.toString()}`;
}

function buildDownloadUrl(file) {
  if (!file || !file.filename) return "";
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  return `/rh/api/studio/download?${params.toString()}`;
}

function mediaIdFromItem(item) {
  const filename = String(item?.filename || item?.name || "");
  const subfolder = String(item?.subfolder || "");
  const fileType = String(item?.type || "output");
  return `${fileType}|${subfolder}|${filename}`;
}

function extractMediaFromOutputs(outputs) {
  const media = [];
  for (const nodeId of Object.keys(outputs || {})) {
    const nodeOutput = outputs[nodeId] || {};
    const collect = (items, kind) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        const url = buildViewUrl(item);
        if (!url) continue;
        media.push({
          nodeId,
          kind,
          url,
          name: item.filename || "",
          filename: item.filename || "",
          subfolder: item.subfolder || "",
          type: item.type || "output",
          downloadUrl: buildDownloadUrl(item),
          id: mediaIdFromItem(item),
        });
      }
    };
    collect(nodeOutput.images, "image");
    collect(nodeOutput.gifs, "video");
    collect(nodeOutput.videos, "video");
  }
  return media;
}

function parseCurrentPath() {
  const path = window.location.pathname || "/rh";
  const match = path.match(/^\/rh\/app\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return { page: "app", appId: match[1] };
  }
  return { page: "list" };
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function summarizeStats(app) {
  const runCount = normalizeNumber(app.run_count ?? app.usage_count, 0);
  const likeCount = normalizeNumber(app.like_count ?? app.favorite_count, 0);
  const viewCount = normalizeNumber(app.view_count ?? app.visit_count, 0);
  return { runCount, likeCount, viewCount };
}

function parseUpdatedAt(app) {
  const raw = app.updated_at || app.created_at || "";
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

function sortApps(apps) {
  const items = [...apps];
  if (state.sortBy === "name_asc") {
    items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
    return items;
  }
  if (state.sortBy === "popular_desc") {
    items.sort((a, b) => {
      const aStats = summarizeStats(a);
      const bStats = summarizeStats(b);
      const aScore = aStats.runCount * 3 + aStats.likeCount * 2 + aStats.viewCount;
      const bScore = bStats.runCount * 3 + bStats.likeCount * 2 + bStats.viewCount;
      return bScore - aScore;
    });
    return items;
  }
  items.sort((a, b) => parseUpdatedAt(b) - parseUpdatedAt(a));
  return items;
}

async function requestJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const studioUserId = getStudioUserId();
  const sessionToken = getStudioSessionToken();
  if (studioUserId) headers.set("comfy-user", studioUserId);
  if (sessionToken) headers.set("rh-studio-session", sessionToken);
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && portalMultiUserEnabled) {
      clearPortalUserAuth();
      updatePortalUserUi();
      if (!isPortalLoginModalOpen()) openPortalLoginModal();
    }
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function getStudioSessionToken() {
  try {
    return sessionStorage.getItem(STUDIO_SESSION_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function setStudioSessionToken(token) {
  try {
    const value = String(token || "").trim();
    if (value) sessionStorage.setItem(STUDIO_SESSION_TOKEN_KEY, value);
    else sessionStorage.removeItem(STUDIO_SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isPortalUserAuthed() {
  if (!portalMultiUserEnabled) return true;
  try {
    const token = getStudioSessionToken();
    const userId = portalUserId || "";
    return Boolean(token && userId && sessionStorage.getItem(STUDIO_AUTH_SESSION_KEY) === userId);
  } catch {
    return false;
  }
}

function markPortalUserAuthed(userId) {
  try {
    sessionStorage.setItem(STUDIO_AUTH_SESSION_KEY, String(userId || "").trim());
  } catch {
    // Ignore storage failures.
  }
}

function clearPortalUserAuth() {
  try {
    sessionStorage.removeItem(STUDIO_AUTH_SESSION_KEY);
    sessionStorage.removeItem(STUDIO_SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
  window.RhStudioAuth?.notifyAuthChange?.();
}

function getStudioUserId() {
  if (!portalMultiUserEnabled) return "default";
  if (!isPortalUserAuthed()) return "";
  return portalUserId || "default";
}

function getPortalUserDisplayName() {
  return portalUsersMap[portalUserId] || portalUserId || "default";
}

function resolvePortalUserId(usernameOrId) {
  const text = String(usernameOrId || "").trim();
  if (!text) return "";
  if (portalUsersMap[text]) return text;
  const lower = text.toLowerCase();
  for (const [userId, displayName] of Object.entries(portalUsersMap)) {
    const name = String(displayName || "").trim();
    if (name === text || name.toLowerCase() === lower) return userId;
    if (String(userId) === text) return userId;
  }
  return "";
}

function updatePortalUserUi() {
  const btn = qs("#portalLoginBtn");
  const label = qs("#portalLoginLabel");
  const dropdown = qs("#portalAuthDropdown");
  if (!btn || !label) return;
  if (!portalMultiUserEnabled) {
    label.textContent = "默认用户";
    btn.disabled = true;
    btn.classList.remove("is-logged-in");
    if (dropdown) dropdown.classList.add("is-hidden");
    return;
  }
  btn.disabled = false;
  const authed = isPortalUserAuthed();
  label.textContent = authed ? getPortalUserDisplayName() : "登录";
  btn.classList.toggle("is-logged-in", authed);
  btn.setAttribute("aria-haspopup", authed ? "menu" : "dialog");
  btn.setAttribute("aria-controls", authed ? "portalAuthDropdown" : "portalLoginModal");
  if (!authed) {
    btn.setAttribute("aria-expanded", "false");
    if (dropdown) dropdown.classList.add("is-hidden");
  }
}

function openPortalAuthDropdown() {
  const dropdown = qs("#portalAuthDropdown");
  const btn = qs("#portalLoginBtn");
  if (!dropdown || !btn) return;
  dropdown.classList.remove("is-hidden");
  btn.setAttribute("aria-expanded", "true");
}

function closePortalAuthDropdown() {
  const dropdown = qs("#portalAuthDropdown");
  const btn = qs("#portalLoginBtn");
  if (!dropdown || !btn) return;
  dropdown.classList.add("is-hidden");
  btn.setAttribute("aria-expanded", "false");
}

function togglePortalAuthDropdown() {
  const dropdown = qs("#portalAuthDropdown");
  if (!dropdown) return;
  if (dropdown.classList.contains("is-hidden")) openPortalAuthDropdown();
  else closePortalAuthDropdown();
}

async function logoutPortalUser() {
  closePortalAuthDropdown();
  const token = getStudioSessionToken();
  try {
    if (token) {
      await requestJson("/rh/api/studio/auth/logout", {
        method: "POST",
        skipAuthRecovery: true,
      });
    }
  } catch {
    // 本地仍清除登录态
  }
  clearPortalUserAuth();
  updatePortalUserUi();
}

function isPortalLoginModalOpen() {
  const modal = qs("#portalLoginModal");
  return Boolean(modal && !modal.classList.contains("hidden"));
}

function openPortalLoginModal() {
  const modal = qs("#portalLoginModal");
  if (!modal) return;
  if (isPortalLoginModalOpen()) return;

  const username = qs("#portalLoginUsername");
  if (username) username.value = getPortalUserDisplayName();
  const password = qs("#portalLoginPassword");
  if (password) password.value = "";
  modal.classList.remove("hidden");

  const hasUsername = Boolean(String(username?.value || "").trim());
  window.requestAnimationFrame(() => {
    if (hasUsername) qs("#portalLoginPassword")?.focus();
    else username?.focus();
  });
}

function closePortalLoginModal() {
  qs("#portalLoginModal")?.classList.add("hidden");
}

function validatePortalPassword(password, label = "密码") {
  if (String(password || "").length < STUDIO_MIN_PASSWORD_LENGTH) {
    return `${label}至少 ${STUDIO_MIN_PASSWORD_LENGTH} 位`;
  }
  return "";
}

async function switchPortalUser(nextUserId) {
  const id = String(nextUserId || "").trim();
  if (!id) return;
  portalUserId = id;
  try {
    localStorage.setItem(STUDIO_USER_STORAGE_KEY, id);
  } catch {
    // Ignore storage failures.
  }
  state.history = [];
  state.outputMedia = [];
  updatePortalUserUi();
}

async function loginPortalUser(usernameOrId, password) {
  const id = resolvePortalUserId(usernameOrId);
  const pwdErr = validatePortalPassword(password);
  if (!String(usernameOrId || "").trim()) {
    window.alert("请输入用户名");
    return false;
  }
  if (!id) {
    window.alert("找不到该用户名，请检查输入或先注册");
    return false;
  }
  if (pwdErr) {
    window.alert(pwdErr);
    return false;
  }
  clearPortalUserAuth();
  const data = await requestJson("/rh/api/studio/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: id, password: String(password || "") }),
  });
  if (id !== portalUserId) await switchPortalUser(id);
  setStudioSessionToken(data.session_token || "");
  markPortalUserAuthed(id);
  updatePortalUserUi();
  window.RhStudioAuth?.notifyAuthChange?.();
  closePortalLoginModal();
  if (data.first_time_setup) window.alert("首次登录，密码已设置成功");
  return true;
}

async function registerPortalUser(username, password, confirmPassword) {
  const name = String(username || "").trim();
  const pwd = String(password || "");
  const confirm = String(confirmPassword || "");
  if (!name) {
    window.alert("请输入用户名");
    return false;
  }
  const pwdErr = validatePortalPassword(pwd, "密码");
  if (pwdErr) {
    window.alert(pwdErr);
    return false;
  }
  if (pwd !== confirm) {
    window.alert("两次输入的密码不一致");
    return false;
  }
  const data = await requestJson("/rh/api/studio/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name, password: pwd }),
  });
  const id = String(data.user_id || "").trim();
  if (!id) throw new Error("创建用户失败");
  portalUsersMap[id] = name;
  portalMultiUserEnabled = true;
  await switchPortalUser(id);
  setStudioSessionToken(data.session_token || "");
  markPortalUserAuthed(id);
  updatePortalUserUi();
  window.RhStudioAuth?.notifyAuthChange?.();
  closePortalLoginModal();
  return true;
}

async function initPortalUser() {
  portalUserId = localStorage.getItem(STUDIO_USER_STORAGE_KEY) || "default";
  try {
    const data = await requestJson("/users");
    if (data?.users && typeof data.users === "object" && Object.keys(data.users).length) {
      portalMultiUserEnabled = true;
      portalUsersMap = data.users;
      if (!portalUsersMap[portalUserId]) {
        portalUserId = Object.keys(portalUsersMap)[0] || "default";
        localStorage.setItem(STUDIO_USER_STORAGE_KEY, portalUserId);
      }
    } else {
      portalMultiUserEnabled = false;
      portalUserId = "default";
    }
  } catch {
    portalMultiUserEnabled = false;
    portalUserId = "default";
  }
  updatePortalUserUi();
  if (portalMultiUserEnabled && isPortalUserAuthed()) {
    try {
      await requestJson("/rh/api/studio/auth/me");
    } catch {
      clearPortalUserAuth();
      updatePortalUserUi();
    }
  }
  window.addEventListener("rh-studio-auth-change", () => updatePortalUserUi());
}

function requirePortalLogin(message) {
  state.runMessage = message || "请先登录后再操作。";
  openPortalLoginModal();
  renderAppDetail();
}

function bindPortalAuthControls() {
  bindIfExists("#portalLoginBtn", "click", (event) => {
    event.stopPropagation();
    if (!portalMultiUserEnabled) return;
    if (isPortalUserAuthed()) {
      togglePortalAuthDropdown();
      return;
    }
    openPortalLoginModal();
  });
  bindIfExists("#portalLogoutBtn", "click", (event) => {
    event.stopPropagation();
    void logoutPortalUser();
  });
  bindIfExists("#portalAuthMenu", "click", (event) => event.stopPropagation());
  document.addEventListener("click", () => closePortalAuthDropdown());
  bindIfExists("#portalLoginClose", "click", closePortalLoginModal);
  bindIfExists("#portalLoginConfirm", "click", () => {
    void loginPortalUser(
      qs("#portalLoginUsername")?.value || "",
      qs("#portalLoginPassword")?.value || "",
    ).then(async (ok) => {
      if (!ok) return;
      const route = parseCurrentPath();
      if (route.page === "app") {
        await loadApp(route.appId);
        await refreshHistory();
      } else {
        await loadApps();
        renderAppList();
      }
    }).catch((error) => window.alert(error.message || "登录失败"));
  });
  bindIfExists("#portalRegisterConfirm", "click", () => {
    void registerPortalUser(
      qs("#portalRegisterName")?.value || "",
      qs("#portalRegisterPassword")?.value || "",
      qs("#portalRegisterConfirmPassword")?.value || "",
    ).then(async (ok) => {
      if (!ok) return;
      const route = parseCurrentPath();
      if (route.page === "app") {
        await loadApp(route.appId);
        await refreshHistory();
      } else {
        await loadApps();
        renderAppList();
      }
    }).catch((error) => window.alert(error.message || "注册失败"));
  });
  bindIfExists("#portalLoginPassword", "keydown", (event) => {
    if (event.key === "Enter") qs("#portalLoginConfirm")?.click();
  });
}

async function openWorkflowFromServer(appId) {
  const targetUrl = `/rh/editor/${encodeURIComponent(appId)}`;
  // Open tab immediately in user-gesture context to avoid popup blocking.
  const opened = window.open("about:blank", "_blank");
  if (!opened) {
    throw new Error("浏览器拦截了新标签页，请允许本站弹出新窗口后重试。");
  }

  // Fast pre-check: ensure server-side workflow file exists.
  await fetch(`/rh/api/apps/${encodeURIComponent(appId)}/workflow-file`, { method: "GET" }).then(async (resp) => {
    if (resp.ok) return;
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${resp.status}`);
  });

  // Keep app center page intact; navigate only the new tab.
  try {
    opened.location.href = targetUrl;
  } catch {
    // If cross-window navigation fails unexpectedly, close and surface a clear error.
    opened.close();
    throw new Error("无法在新标签页打开编辑器，请重试。");
  }
}

async function loadApps() {
  const data = await requestJson("/rh/api/apps");
  state.apps = data.apps || [];
}

async function loadApp(appId) {
  state.appDetail = await requestJson(`/rh/api/apps/${encodeURIComponent(appId)}`);
  state.currentParams = {};
  state.outputMedia = [];
  state.paramUploads = {};
  state.lastPromptId = "";
  for (const param of state.appDetail.params || []) {
    state.currentParams[param.key] = param.default ?? "";
  }
}

function renderAppList() {
  const root = qs("#appRoot");
  const categoryCounts = new Map();
  categoryCounts.set("all", state.apps.length);
  let uncategorizedCount = 0;
  for (const app of state.apps) {
    const tags = Array.isArray(app.tags) ? app.tags : [];
    if (!tags.length) {
      uncategorizedCount += 1;
      continue;
    }
    for (const rawTag of tags) {
      const tag = String(rawTag || "").trim();
      if (!tag) continue;
      categoryCounts.set(tag, (categoryCounts.get(tag) || 0) + 1);
    }
  }
  if (uncategorizedCount > 0) {
    categoryCounts.set("uncategorized", uncategorizedCount);
  }

  if (state.activeCategory !== "all" && !categoryCounts.has(state.activeCategory)) {
    state.activeCategory = "all";
  }

  const categories = Array.from(categoryCounts.entries())
    .map(([id, count]) => ({
      id,
      label: id === "all" ? "全部" : id === "uncategorized" ? "未分类" : id,
      count,
    }))
    .sort((a, b) => {
      if (a.id === "all") return -1;
      if (b.id === "all") return 1;
      if (a.id === "uncategorized") return 1;
      if (b.id === "uncategorized") return -1;
      return b.count - a.count || a.label.localeCompare(b.label, "zh-CN");
    });

  const searchedApps = state.apps.filter((app) => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return true;
    const content = `${app.name || ""} ${app.description || ""} ${(app.tags || []).join(" ")}`.toLowerCase();
    return content.includes(q);
  });

  const filteredApps = searchedApps.filter((app) => {
    if (state.activeCategory === "all") return true;
    if (state.activeCategory === "uncategorized") {
      return !Array.isArray(app.tags) || app.tags.length === 0;
    }
    return Array.isArray(app.tags) && app.tags.includes(state.activeCategory);
  });

  const sortedApps = sortApps(filteredApps);

  const categoryTabs = categories.map((category) => {
    const isActive = category.id === state.activeCategory;
    const activeClass = isActive ? "active" : "";
    return `
      <button
        type="button"
        class="category-tab ${activeClass}"
        data-category="${escapeHtml(category.id)}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        <span>${escapeHtml(category.label)}</span>
        <em>${escapeHtml(category.count)}</em>
      </button>
    `;
  }).join("");

  const cards = sortedApps.map((app) => {
    const stats = summarizeStats(app);
    const updatedAt = app.updated_at ? new Date(app.updated_at).toLocaleDateString() : "未知";
    return `
    <article class="card" data-app-id="${escapeHtml(app.id)}">
      <div class="cover-wrap">
        <img class="cover" src="${escapeHtml(app.cover_url || "")}" alt="" onerror="this.style.display='none'"/>
        <div class="card-overlay">
          <span class="pill">${app.has_workflow_json ? "可编辑工作流" : "仅 Prompt"}</span>
          <span class="pill muted">${escapeHtml(app.publish_source || "legacy")}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(app.name)}</h3>
        <p class="desc">${escapeHtml(app.description || "")}</p>
        <div class="tags">${(app.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        <div class="kpi-row">
          <span>运行 ${escapeHtml(stats.runCount)}</span>
          <span>喜欢 ${escapeHtml(stats.likeCount)}</span>
          <span>浏览 ${escapeHtml(stats.viewCount)}</span>
          <span>更新 ${escapeHtml(updatedAt)}</span>
        </div>
        <p class="meta">参数 ${escapeHtml(app.param_count ?? 0)} · ${app.has_workflow_json ? "已保存工作流" : "仅保存 prompt"}</p>
        <div class="card-actions">
          <button class="primary" data-open-app="${escapeHtml(app.id)}">进入应用</button>
          <button class="secondary" data-edit-workflow="${escapeHtml(app.id)}">编辑工作流</button>
          <button class="danger" data-delete-app="${escapeHtml(app.id)}" ${deletingAppIds.has(app.id) ? "disabled" : ""}>
            ${deletingAppIds.has(app.id) ? "删除中..." : "删除应用"}
          </button>
        </div>
      </div>
    </article>
  `;
  }).join("");

  root.innerHTML = `
    <div class="page-inner">
      <section class="hero">
        <div class="hero-copy">
          <div class="hero-eyebrow">工作流库</div>
          <h1 class="hero-title">全部工作流</h1>
          <p class="hero-subtitle">集中管理你发布的 ComfyUI 应用，快速搜索、分类和编辑工作流。</p>
        </div>
        <section class="toolbar">
          <label class="toolbar-search" for="searchInput">
            <svg class="toolbar-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input id="searchInput" type="search" placeholder="搜索应用名称 / 描述 / 标签" value="${escapeHtml(state.searchQuery)}" autocomplete="off" />
          </label>
          <div class="toolbar-sort">
            <select id="sortSelect" aria-label="排序方式">
              <option value="updated_desc" ${state.sortBy === "updated_desc" ? "selected" : ""}>按最近更新</option>
              <option value="popular_desc" ${state.sortBy === "popular_desc" ? "selected" : ""}>按热度</option>
              <option value="name_asc" ${state.sortBy === "name_asc" ? "selected" : ""}>按名称</option>
            </select>
          </div>
          <div class="toolbar-count">共 <strong>${escapeHtml(sortedApps.length)}</strong> 个应用</div>
        </section>
      </section>
      <section class="category-bar" role="tablist" aria-label="应用分类">
        ${categoryTabs}
      </section>
      <section class="grid">
        ${cards || `<div class="empty-state"><p>暂无已发布应用</p><span>在 ComfyUI 中发布工作流后，会显示在这里</span></div>`}
      </section>
    </div>
  `;

  root.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.getAttribute("data-category") || "all";
      button.blur();
      renderAppList();
    });
  });

  const searchInput = root.querySelector("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.searchQuery = searchInput.value || "";
      renderAppList();
    });
  }
  const sortSelect = root.querySelector("#sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.sortBy = sortSelect.value || "updated_desc";
      renderAppList();
    });
  }

  root.querySelectorAll("[data-open-app]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const appId = button.getAttribute("data-open-app");
      window.location.href = `/rh/app/${appId}`;
    });
  });

  root.querySelectorAll(".card[data-app-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".card-actions")) return;
      const appId = card.getAttribute("data-app-id");
      if (!appId) return;
      window.location.href = `/rh/app/${appId}`;
    });
  });

  root.querySelectorAll("[data-delete-app]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const appId = button.getAttribute("data-delete-app");
      if (!appId) return;
      await deleteApp(appId);
    });
  });

  root.querySelectorAll("[data-edit-workflow]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const appId = String(button.getAttribute("data-edit-workflow") || "").trim();
      if (!appId) return;
      try {
        await openWorkflowFromServer(appId);
      } catch (error) {
        window.alert(`打开工作流失败：${error.message || "未知错误"}`);
      }
    });
  });
}

async function deleteApp(appId) {
  const app = state.apps.find((item) => item.id === appId);
  const appName = app?.name || appId;
  const ok = window.confirm(`确认删除应用「${appName}」吗？\n删除后无法恢复。`);
  if (!ok) return;

  deletingAppIds = new Set(deletingAppIds).add(appId);
  renderAppList();
  try {
    await requestJson(`/rh/api/apps/${encodeURIComponent(appId)}`, { method: "DELETE" });
    state.apps = state.apps.filter((item) => item.id !== appId);
    if (state.activeCategory !== "all") {
      const stillHasApp = state.apps.some((item) => {
        if (state.activeCategory === "uncategorized") {
          return !Array.isArray(item.tags) || item.tags.length === 0;
        }
        return Array.isArray(item.tags) && item.tags.includes(state.activeCategory);
      });
      if (!stillHasApp) {
        state.activeCategory = "all";
      }
    }
    renderAppList();
  } catch (error) {
    window.alert(`删除失败：${error.message}`);
  } finally {
    const next = new Set(deletingAppIds);
    next.delete(appId);
    deletingAppIds = next;
    renderAppList();
  }
}

function inputControlHtml(param) {
  const key = escapeHtml(param.key);
  const value = state.currentParams[param.key] ?? param.default ?? "";
  const type = param.type || "text";
  if (type === "select") {
    const options = (param.options || []).map((opt) => {
      const selected = String(opt) === String(value) ? "selected" : "";
      return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
    }).join("");
    return `<select data-param-key="${key}">${options}</select>`;
  }
  if (type === "textarea") {
    return `<textarea class="param-input param-input-textarea" rows="8" data-param-key="${key}">${escapeHtml(value)}</textarea>`;
  }
  if (type === "number") {
    return `<input type="number" data-param-key="${key}" value="${escapeHtml(value)}" />`;
  }
  if (type === "toggle") {
    const checked = value ? "checked" : "";
    return `<input type="checkbox" data-param-key="${key}" ${checked} />`;
  }
  if (type === "image" || type === "file") {
    const inputId = uploadInputId(param.key);
    const upload = state.paramUploads[param.key];
    const preview = upload?.url
      ? `${upload.kind === "video"
          ? `<video src="${escapeHtml(upload.url)}" muted playsinline></video>`
          : `<img src="${escapeHtml(upload.url)}" alt="" />`}`
      : `<div class="upload-placeholder">点击上传图片</div>`;
    const fileName = upload?.name || value || "";
    return `
      <div class="upload-field">
        <input id="${escapeHtml(inputId)}" class="upload-native-input" type="file" accept="image/*,video/*" data-param-key="${key}" data-param-upload="1" />
        <div class="upload-preview-card" role="button" tabindex="0" data-upload-trigger="${key}" data-upload-input-id="${escapeHtml(inputId)}">
          ${preview}
          ${upload?.url ? `<button type="button" class="upload-delete-btn" data-upload-clear="${key}" title="删除已上传图片">🗑</button>` : ""}
        </div>
        <div class="upload-name">${escapeHtml(fileName || "未上传文件")}</div>
        <p class="hint">点击图片区域上传，右下角垃圾桶可删除。</p>
      </div>
    `;
  }
  return `<textarea class="param-input param-input-text" rows="5" data-param-key="${key}">${escapeHtml(value)}</textarea>`;
}

function clearParamUpload(paramKey) {
  state.currentParams[paramKey] = "";
  delete state.paramUploads[paramKey];
  state.runMessage = `已删除上传文件：${paramKey}`;
}

function bindUploadActions(root) {
  root.querySelectorAll("[data-upload-trigger]").forEach((el) => {
    el.addEventListener("click", () => {
      const inputId = el.getAttribute("data-upload-input-id");
      if (!inputId) return;
      const input = document.getElementById(inputId);
      if (input) input.click();
    });
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const inputId = el.getAttribute("data-upload-input-id");
      if (!inputId) return;
      const input = document.getElementById(inputId);
      if (input) input.click();
    });
  });

  root.querySelectorAll("[data-upload-clear]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = button.getAttribute("data-upload-clear");
      if (!key) return;
      clearParamUpload(key);
      renderAppDetail();
    });
  });
}

function bindMediaPreview(root) {
  root.querySelectorAll("[data-media-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute("data-media-action");
      if (action === "download") {
        const url = button.getAttribute("data-download-url") || "";
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      if (action === "delete") {
        const filename = button.getAttribute("data-filename") || "";
        const subfolder = button.getAttribute("data-subfolder") || "";
        const type = button.getAttribute("data-type") || "output";
        const mediaId = button.getAttribute("data-media-id") || "";
        if (!filename || !mediaId) return;
        const ok = window.confirm("确认删除这个文件吗？删除后无法恢复。");
        if (!ok) return;
        try {
          await requestJson("/rh/api/studio/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, subfolder, type }),
          });
          state.outputMedia = state.outputMedia.filter((item) => item.id !== mediaId);
          state.history = state.history.map((job) => ({
            ...job,
            media: (job.media || []).filter((item) => item.id !== mediaId),
          }));
          renderAppDetail();
        } catch (error) {
          window.alert(`删除失败：${error.message || "未知错误"}`);
        }
      }
    });
  });

  root.querySelectorAll("[data-preview-url]").forEach((el) => {
    el.addEventListener("click", () => {
      const url = el.getAttribute("data-preview-url") || "";
      const kind = el.getAttribute("data-preview-kind") || "image";
      showMediaPreview(kind, url);
    });
  });
}

function renderHistoryItems() {
  if (!state.history.length) {
    return `<p class="hint">暂无历史任务</p>`;
  }
  return state.history.map((job) => `
    <div class="history-item">
      <div>状态：<span class="status ${escapeHtml(job.status || "")}">${escapeHtml(job.status || "unknown")}</span>${job.source ? ` · ${escapeHtml(job.source)}` : ""}</div>
      <div>创建：${escapeHtml(job.created_at || "")}</div>
      <div>完成：${escapeHtml(job.completed_at || "")}</div>
      <div class="history-media">
        ${job.media && job.media.length ? job.media.slice(0, 3).map((item) =>
          `<div class="media-thumb" data-preview-url="${escapeHtml(item.url)}" data-preview-kind="${escapeHtml(item.kind)}">
            ${item.kind === "video"
              ? `<video src="${escapeHtml(item.url)}" muted preload="metadata"></video>`
              : `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" />`}
            <div class="media-actions">
              <button type="button" data-media-action="download" data-download-url="${escapeHtml(item.downloadUrl || "")}">下载</button>
              <button type="button" class="danger" data-media-action="delete" data-media-id="${escapeHtml(item.id || "")}" data-filename="${escapeHtml(item.filename || "")}" data-subfolder="${escapeHtml(item.subfolder || "")}" data-type="${escapeHtml(item.type || "output")}">删除</button>
            </div>
          </div>`
        ).join("") : `<span class="hint">暂无媒体产出</span>`}
      </div>
    </div>
  `).join("");
}

function renderOutputPreviewHtml() {
  if (!state.outputMedia.length) {
    return `<p class="hint">运行后这里会显示输出文件。</p>`;
  }
  return state.outputMedia
    .map((item) => `
      <div class="media-thumb media-thumb-large" data-preview-url="${escapeHtml(item.url)}" data-preview-kind="${escapeHtml(item.kind)}">
        ${item.kind === "video"
          ? `<video src="${escapeHtml(item.url)}" controls muted preload="metadata"></video>`
          : `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" />`}
        <div class="media-actions">
          <button type="button" data-media-action="download" data-download-url="${escapeHtml(item.downloadUrl || "")}">下载</button>
          <button type="button" class="danger" data-media-action="delete" data-media-id="${escapeHtml(item.id || "")}" data-filename="${escapeHtml(item.filename || "")}" data-subfolder="${escapeHtml(item.subfolder || "")}" data-type="${escapeHtml(item.type || "output")}">删除</button>
        </div>
      </div>
    `)
    .join("");
}

function renderAppDetail() {
  const root = qs("#appRoot");
  if (!root) return;
  const app = state.appDetail;
  const paramFields = (app.params || []).map((param) => `
    <label>${escapeHtml(param.label || param.key)}</label>
    ${inputControlHtml(param)}
  `).join("");

  root.innerHTML = `
    <section class="split app-run-layout${state.historyCollapsed ? " history-collapsed" : ""}">
      <aside class="panel panel-params">
        <h3 class="section-title">${escapeHtml(app.name)}</h3>
        <p class="hint panel-desc">${escapeHtml(app.description || "")}</p>
        <div class="param-fields">
          ${paramFields || '<p class="hint">当前应用未暴露参数。</p>'}
        </div>
        <div class="run-actions">
          <button id="runBtn" class="primary run-btn" type="button">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>
            <span>立即运行</span>
          </button>
        </div>
        <pre class="log">${escapeHtml(state.runMessage || "等待运行...")}</pre>
      </aside>

      <section class="panel panel-output">
        <h3 class="section-title">产出预览</h3>
        <div id="outputPreview" class="output-grid">
          ${renderOutputPreviewHtml()}
        </div>
      </section>

      <aside class="panel history panel-history${state.historyCollapsed ? " is-collapsed" : ""}" aria-label="历史记录">
        <button
          type="button"
          class="panel-history__edge-toggle${state.historyCollapsed ? " is-collapsed" : ""}"
          id="btnHistoryToggle"
          aria-expanded="${state.historyCollapsed ? "false" : "true"}"
          aria-label="${state.historyCollapsed ? "展开历史记录" : "收起历史记录"}"
          title="${state.historyCollapsed ? "展开" : "收起"}"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.42 1.42l4.59-4.59a1 1 0 0 0 0-1.42l-4.59-4.59a1 1 0 0 0-1.42 0z"/>
          </svg>
        </button>
        <h3 class="section-title">历史记录</h3>
        <div class="history-list">${renderHistoryItems()}</div>
      </aside>
    </section>
  `;

  root.querySelectorAll("[data-param-key]").forEach((el) => {
    el.addEventListener("change", (event) => { void onParamChange(event); });
    el.addEventListener("input", (event) => { void onParamChange(event); });
  });
  bindUploadActions(root);
  bindMediaPreview(root);
  bindHistoryPanelToggle(root);
  bindIfExists("#runBtn", "click", runApp);
}

async function uploadParamFile(paramKey, file) {
  const form = new FormData();
  form.append("image", file, file.name);
  form.append("type", "input");
  const response = await fetch("/upload/image", {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `上传失败: ${response.status}`);
  }
  const joined = data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
  state.currentParams[paramKey] = joined;
  state.paramUploads[paramKey] = {
    url: buildViewUrl({ filename: data.name, subfolder: data.subfolder || "", type: data.type || "input" }),
    name: joined,
    kind: file.type.startsWith("video/") ? "video" : "image",
  };
}

async function onParamChange(event) {
  const key = event.target.getAttribute("data-param-key");
  if (!key) return;
  if (event.target.dataset.paramUpload === "1" && event.target.files && event.target.files[0]) {
    try {
      await uploadParamFile(key, event.target.files[0]);
      state.runMessage = `文件已上传并绑定参数：${key}\n${state.currentParams[key]}`;
    } catch (error) {
      state.runMessage = `文件上传失败: ${error.message}`;
    }
    renderAppDetail();
    return;
  }
  if (event.target.type === "checkbox") {
    state.currentParams[key] = event.target.checked;
  } else {
    state.currentParams[key] = event.target.value;
  }
}

function applyParamBindings(app) {
  const prompt = deepClone(app.prompt_template || {});
  for (const param of app.params || []) {
    const value = state.currentParams[param.key];
    for (const binding of param.bindings || []) {
      const nodeId = String(binding.node_id);
      const inputName = binding.input_name;
      if (!prompt[nodeId] || !prompt[nodeId].inputs) continue;
      prompt[nodeId].inputs[inputName] = coerceValue(value, param.type);
    }
  }
  return prompt;
}

function coerceValue(value, type) {
  if (type === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  if (type === "toggle") {
    return Boolean(value);
  }
  return value;
}

async function runApp() {
  const app = state.appDetail;
  if (!app || !app.prompt_template) {
    state.runMessage = "应用缺少 prompt_template，无法运行。";
    renderAppDetail();
    return;
  }
  if (portalMultiUserEnabled && !isPortalUserAuthed()) {
    requirePortalLogin("请先登录后再运行应用。");
    return;
  }
  try {
    stopLivePoll();
    const prompt = applyParamBindings(app);
    const studioUserId = getStudioUserId();
    const payload = {
      client_id: "rh-portal",
      prompt,
      extra_data: {
        workflow_id: app.id,
        rh_portal_app_id: app.id,
        rh_portal_inputs: state.currentParams,
        rh_studio_user_id: studioUserId,
        rh_job_source: "portal",
      },
    };

    const result = await requestJson("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.lastPromptId = result.prompt_id || "";
    state.runMessage = `提交成功\nprompt_id: ${state.lastPromptId || "unknown"}\nnumber: ${result.number ?? "unknown"}\n\n正在拉取产出预览...`;
    renderAppDetail();
    if (state.lastPromptId) {
      await pollHistoryAndPreview(state.lastPromptId);
    }
    await refreshHistory();
  } catch (error) {
    state.runMessage = `提交失败: ${error.message}`;
    renderAppDetail();
  }
}

function stopLivePoll() {
  if (state.livePollTimer) {
    clearInterval(state.livePollTimer);
    state.livePollTimer = null;
  }
  state.livePollPromptId = "";
}

async function checkPromptCompletion(promptId) {
  const data = await requestJson(`/rh/api/studio/result?prompt_id=${encodeURIComponent(promptId)}`);
  if (!data?.ok || !data.completed) {
    return { done: false, status: "pending", media: [] };
  }
  const media = extractMediaFromOutputs(data.outputs || {});
  const statusStr = data.status || "completed";
  const failed = statusStr === "error";
  return {
    done: true,
    status: failed ? "failed" : "completed",
    statusStr,
    media,
  };
}

function startLivePoll(promptId) {
  if (!promptId) return;
  if (state.livePollPromptId === promptId && state.livePollTimer) return;
  stopLivePoll();
  state.livePollPromptId = promptId;
  state.livePollTimer = setInterval(async () => {
    try {
      const result = await checkPromptCompletion(promptId);
      if (!result.done) return;
      state.outputMedia = result.media || [];
      if (result.status === "failed") {
        state.runMessage = `${state.runMessage}\n\n任务结束：${result.statusStr || "error"}`;
      } else {
        state.runMessage = `${state.runMessage}\n\n后台追踪完成：${result.statusStr || "completed"}\n输出媒体数：${(result.media || []).length}`;
      }
      stopLivePoll();
      await refreshHistory();
      renderAppDetail();
    } catch (error) {
      // Keep tracking on transient errors.
      console.warn("[Portal] live poll error:", error);
    }
  }, 3000);
}

async function pollHistoryAndPreview(promptId) {
  const maxAttempts = 60;
  const intervalMs = 1000;
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkPromptCompletion(promptId);
    if (result.done) {
      const media = result.media || [];
      state.outputMedia = media;
      const statusStr = result.statusStr || "completed";
      state.runMessage = `${state.runMessage}\n\n执行完成：${statusStr}\n输出媒体数：${media.length}`;
      renderAppDetail();
      stopLivePoll();
      return;
    }
    // Not completed yet, wait.
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  state.runMessage = `${state.runMessage}\n\n前端等待超时：任务仍可能在后台执行，正在持续追踪结果...`;
  startLivePoll(promptId);
  renderAppDetail();
}

function mapJobMedia(mediaItems) {
  if (!Array.isArray(mediaItems)) return [];
  return mediaItems.map((item) => ({
    nodeId: item.node_id || "",
    kind: item.kind || "image",
    url: item.view_url || item.url || "",
    name: item.filename || "",
    filename: item.filename || "",
    subfolder: item.subfolder || "",
    type: item.type || "output",
    downloadUrl: item.download_url || item.downloadUrl || "",
    id: mediaIdFromItem(item),
  })).filter((item) => item.url);
}

async function refreshHistory() {
  if (!state.appDetail) return;
  if (portalMultiUserEnabled && !isPortalUserAuthed()) {
    state.history = [];
    renderAppDetail();
    return;
  }
  try {
    const appId = state.appDetail.id;
    const data = await requestJson(
      `/rh/api/jobs?app_id=${encodeURIComponent(appId)}&limit=20&max_items=80`,
    );
    state.history = (data.jobs || []).map((job) => {
      const mappedMedia = mapJobMedia(job.media);
      return {
        id: job.id || job.prompt_id,
        status: job.status,
        source: job.source || "",
        created_at: job.create_time ? new Date(job.create_time).toLocaleString() : "",
        completed_at: job.completed_at || "",
        media: mappedMedia.length ? mappedMedia : extractMediaFromOutputs(job.outputs || {}),
      };
    });
  } catch (error) {
    state.runMessage = `刷新历史失败: ${error.message}`;
  }
  renderAppDetail();
}

function bindGlobalActions() {
  bindIfExists("#goStudioBtn", "click", () => {
    window.location.href = "/rh/studio";
  });
}

async function bootstrap() {
  bindGlobalActions();
  bindPortalAuthControls();
  state.historyCollapsed = loadHistoryCollapsedState();
  window.RhTheme?.bindToggleButtons?.();
  await initPortalUser();
  const route = parseCurrentPath();
  if (portalMultiUserEnabled && !isPortalUserAuthed()) {
    if (route.page === "list") {
      qs("#appRoot").innerHTML = `<div class="panel"><p class="hint">请先点击右上角「登录」，登录后只能看到自己的历史记录。</p></div>`;
    } else {
      await loadApp(route.appId);
      requirePortalLogin("请先登录后再查看历史记录。");
    }
    openPortalLoginModal();
    return;
  }
  if (route.page === "list") {
    await loadApps();
    renderAppList();
    return;
  }
  await loadApp(route.appId);
  await refreshHistory();
}

bootstrap().catch((error) => {
  qs("#appRoot").innerHTML = `<div class="panel"><p>页面加载失败：${escapeHtml(error.message)}</p></div>`;
});

