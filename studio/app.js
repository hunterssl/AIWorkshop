/**
 * 创作工坊 — 纯前端状态与 UI 交互（后续可对接统一后端 API）
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const chat = $("chat");
  const placeholder = $("chatPlaceholder");
  const modeSelect = $("modeSelect");
  const composerRefRow = $("composerRefRow");
  const composerRefHint = $("composerRefHint");
  const composerRefPreview = $("composerRefPreview");
  const btnRefAdd = $("btnRefAdd");
  const workflowApp = $("workflowApp");
  const promptEl = $("prompt");
  const fileInput = $("fileInput");
  const btnSend = $("btnSend");
  // const announcement = $("announcement");
  // const announcementClose = $("announcementClose");
  const paramsPopAnchor = $("paramsPopAnchor");
  const btnParamsTrigger = $("btnParamsTrigger");
  const composerParamsBody = $("composerParamsBody");
  const paramsSummaryText = $("paramsSummaryText");
  const conversationList = $("conversationList");
  const btnConversationNew = $("btnConversationNew");
  const btnChatHistory = $("btnChatHistory");
  const chatHistoryModal = $("chatHistoryModal");
  const chatHistoryBackdrop = $("chatHistoryBackdrop");
  const btnCloseChatHistory = $("btnCloseChatHistory");
  const chatHistoryDate = $("chatHistoryDate");
  const chatHistoryList = $("chatHistoryList");
  const btnDeleteChatHistoryDate = $("btnDeleteChatHistoryDate");
  const btnClearAllChatHistory = $("btnClearAllChatHistory");
  const queuePanel = $("queuePanel");
  const queueList = $("queueList");
  const btnQueueRefresh = $("btnQueueRefresh");
  const btnQueueToggle = $("btnQueueToggle");
  const homeLanding = $("homeLanding");
  const studioLayout = document.querySelector(".studio-layout");
  const btnEnterChat = $("btnEnterChat");
  const btnEnterPortal = $("btnEnterPortal");
  const btnEnterCanvas = $("btnEnterCanvas");
  const btnGoStudioHome = $("btnGoStudioHome");
  const btnHomeLogin = $("btnHomeLogin");
  const homeLoginLabel = $("homeLoginLabel");
  const homeAuthMenu = $("homeAuthMenu");
  const homeAuthDropdown = $("homeAuthDropdown");
  const btnHomeLogout = $("btnHomeLogout");
  const btnHomeApiSettings = $("btnHomeApiSettings");
  const btnChatLogin = $("btnChatLogin");
  const chatLoginLabel = $("chatLoginLabel");
  const chatAuthMenu = $("chatAuthMenu");
  const chatAuthDropdown = $("chatAuthDropdown");
  const btnChatLogout = $("btnChatLogout");
  const btnChatApiSettings = $("btnChatApiSettings");
  const studioLoginModal = $("studioLoginModal");
  const studioLoginBackdrop = $("studioLoginBackdrop");
  const btnCloseStudioLogin = $("btnCloseStudioLogin");
  const studioLoginUsername = $("studioLoginUsername");
  const btnConfirmStudioLogin = $("btnConfirmStudioLogin");
  const studioLoginNewName = $("studioLoginNewName");
  const studioLoginPassword = $("studioLoginPassword");
  const studioLoginRemember = $("studioLoginRemember");
  const studioLoginNewPassword = $("studioLoginNewPassword");
  const studioLoginConfirmPassword = $("studioLoginConfirmPassword");
  const btnRegisterStudioLogin = $("btnRegisterStudioLogin");

  const dynamicParams = $("dynamicParams");
  const CHAT_HISTORY_STORAGE_BASE = "rh_studio_chat_history_v1";
  const CHAT_CONVERSATION_DEFAULT_TITLE = "新对话";
  const QUEUE_LABELS_STORAGE_BASE = "rh_studio_queue_labels_v1";
  const QUEUE_ENTRIES_STORAGE_BASE = "rh_studio_queue_entries_v1";
  const OWNED_PROMPTS_STORAGE_BASE = "rh_studio_owned_prompts_v1";
  const STUDIO_USER_STORAGE_KEY = "rh_studio_user_id";
  const STUDIO_AUTH_SESSION_KEY = "rh_studio_authed_user_id";
  const STUDIO_SESSION_TOKEN_KEY = "rh_studio_session_token";
  const STUDIO_MIN_PASSWORD_LENGTH = 6;
  const QUEUE_COLLAPSED_STORAGE_KEY = "rh_studio_queue_collapsed_v1";
  const MAX_CHAT_HISTORY_ITEMS = 600;
  const MAX_QUEUE_ITEMS = 120;
  const QUEUE_POLL_INTERVAL_MS = 3000;
  const QUEUE_STALE_POLLS_TO_CANCEL = 2;

  /** 与 Portal 发布时映射到 CLIP 的 key 一致，不在「生成参数」里展示 */
  const STUDIO_PROMPT_PARAM_KEYS = new Set(["prompt", "negative_prompt", "positive", "positive_prompt", "text"]);

  function isStudioPromptParamKey(key) {
    return STUDIO_PROMPT_PARAM_KEYS.has(String(key || "").trim());
  }

  /** 发布时映射到主输入框的提示词参数（含 label 为「提示词 / Prompt」的暴露项） */
  function isStudioPromptParam(param) {
    if (!param || typeof param !== "object") return false;
    if (isStudioPromptParamKey(param.key)) return true;
    const type = String(param.type || "text").toLowerCase();
    if (type !== "text" && type !== "textarea") return false;
    const label = String(param.label || "");
    const key = String(param.key || "").toLowerCase();
    if (/负面|negative/i.test(label) || /negative/.test(key)) return true;
    return /提示词|prompt/i.test(label) || /^prompt$|positive|negative/.test(key);
  }

  /** @type {{ id: string, file: File, objectUrl: string }[]} */
  let referenceItems = [];
  let referenceItemSeq = 0;
  const MAX_REFERENCE_IMAGES = 12;
  /** @type {'t2i'|'t2v'|'i2i'|'i2v'} */
  let generationMode = "t2i";
  let currentAppDetail = null;
  const prettySelectStore = new WeakMap();
  /** @type {any[]} */
  let workflowAppsCache = [];
  let imagePreviewOverlay = null;
  let imagePreviewImg = null;
  let imagePreviewVideo = null;
  let chatHistoryEntries = [];
  /** @type {{prompt_id:string,status:string,title:string,mode:string,created_at:number,updated_at:number,number?:number|string,media_count?:number,error?:string,missing_polls?:number,media_preview?:any}[]} */
  let queueEntries = [];
  let queuePollTimer = null;
  let queueRefreshInFlight = false;
  let activeRunPromptId = "";
  let activeRunController = null;
  const cancellingQueuePromptIds = new Set();
  const cancelledPromptIds = new Set();
  /** @type {Record<string, string>} */
  let queueLabelMap = {};
  let currentConversationId = "";
  let studioUserId = "default";
  let studioMultiUserEnabled = false;
  /** 服务器支持多用户但尚未创建任何账号时为 true，用于允许首次注册 */
  let studioIsFirstSetup = false;
  /** @type {Set<string>} */
  let ownedPromptIds = new Set();

  function chatHistoryStorageKey() {
    return `${CHAT_HISTORY_STORAGE_BASE}__${studioUserId}`;
  }

  function queueLabelsStorageKey() {
    return `${QUEUE_LABELS_STORAGE_BASE}__${studioUserId}`;
  }

  function ownedPromptsStorageKey() {
    return `${OWNED_PROMPTS_STORAGE_BASE}__${studioUserId}`;
  }

  function queueEntriesStorageKey() {
    return `${QUEUE_ENTRIES_STORAGE_BASE}__${studioUserId}`;
  }

  function getStudioClientId() {
    return `rh-studio-${studioUserId}`;
  }

  function mergeStudioRequestOptions(options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (studioUserId) headers.set("comfy-user", studioUserId);
    try {
      const sessionToken = sessionStorage.getItem(STUDIO_SESSION_TOKEN_KEY) || "";
      if (sessionToken) headers.set("rh-studio-session", sessionToken);
    } catch {
      // Ignore storage failures.
    }
    return { ...options, headers };
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

  function getStudioSessionToken() {
    try {
      return sessionStorage.getItem(STUDIO_SESSION_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function handleStudioSessionExpired(message) {
    clearStudioUserAuth();
    updateStudioUserUi();
    if (studioMultiUserEnabled && !isStudioLoginModalOpen()) {
      openStudioLoginModal();
      window.$message?.warning?.(message || "登录已失效，请重新登录");
    }
  }

  async function validateStudioSessionOnInit() {
    if (!studioMultiUserEnabled) return true;
    if (!getStudioSessionToken() || !isStudioUserAuthed()) {
      clearStudioUserAuth();
      updateStudioUserUi();
      return false;
    }
    try {
      await requestJson("/rh/api/studio/auth/me", { skipAuthRecovery: true });
      return true;
    } catch {
      handleStudioSessionExpired("登录已失效，请重新登录后再生成");
      return false;
    }
  }

  function loadOwnedPromptIds() {
    try {
      const raw = localStorage.getItem(ownedPromptsStorageKey());
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((item) => String(item || "").trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  function persistOwnedPromptIds() {
    try {
      localStorage.setItem(ownedPromptsStorageKey(), JSON.stringify([...ownedPromptIds].slice(-MAX_QUEUE_ITEMS)));
    } catch {
      // Ignore storage write failures.
    }
  }

  function registerOwnedPrompt(promptId) {
    const id = String(promptId || "").trim();
    if (!id) return;
    ownedPromptIds.add(id);
    persistOwnedPromptIds();
  }

  function unregisterOwnedPrompt(promptId) {
    const id = String(promptId || "").trim();
    if (!id) return;
    ownedPromptIds.delete(id);
    persistOwnedPromptIds();
  }

  function normalizeStoredQueueEntry(item) {
    if (!item || typeof item !== "object") return null;
    const promptId = String(item.prompt_id || "").trim();
    if (!promptId) return null;
    const now = Date.now();
    return {
      prompt_id: promptId,
      status: normalizeQueueStatus(item.status || "unknown"),
      title: String(item.title || "ComfyUI 任务"),
      mode: String(item.mode || "任务"),
      created_at: Number(item.created_at) || now,
      updated_at: Number(item.updated_at) || now,
      number: item.number ?? "",
      media_count: Number(item.media_count) || 0,
      media_preview: firstMediaPreview(item.media_preview),
      error: item.error ? String(item.error) : "",
      missing_polls: Number(item.missing_polls) || 0,
      execution_start_time: Number(item.execution_start_time) || undefined,
      execution_end_time: Number(item.execution_end_time) || undefined,
    };
  }

  function loadQueueEntries() {
    try {
      const raw = localStorage.getItem(queueEntriesStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const entries = parsed
        .map((item) => normalizeStoredQueueEntry(item))
        .filter(Boolean)
        .slice(-MAX_QUEUE_ITEMS);
      for (const entry of entries) {
        if (entry.prompt_id) ownedPromptIds.add(entry.prompt_id);
      }
      return entries;
    } catch {
      return [];
    }
  }

  function persistQueueEntries() {
    try {
      localStorage.setItem(queueEntriesStorageKey(), JSON.stringify(queueEntries.slice(-MAX_QUEUE_ITEMS)));
    } catch {
      // Ignore storage write failures.
    }
  }

  function isOwnedPromptId(promptId) {
    const id = String(promptId || "").trim();
    return Boolean(id && ownedPromptIds.has(id));
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, mergeStudioRequestOptions(options));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && !options.skipAuthRecovery && studioMultiUserEnabled) {
        handleStudioSessionExpired(data.error || "请先登录后再运行任务");
      }
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function toDateKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function createConversationId() {
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensureConversationId(entry, fallbackConversationId) {
    const existing = String(entry?.conversation_id || "").trim();
    if (existing) return existing;
    return fallbackConversationId || createConversationId();
  }

  function loadChatHistoryEntries() {
    try {
      const raw = localStorage.getItem(chatHistoryStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const defaultConversationId = createConversationId();
      return parsed
        .filter((item) => item && typeof item === "object" && Number.isFinite(item.ts) && item.role)
        .map((item) => ({ ...item, conversation_id: ensureConversationId(item, defaultConversationId) }))
        .slice(-MAX_CHAT_HISTORY_ITEMS);
    } catch {
      return [];
    }
  }

  function loadQueueLabelMap() {
    try {
      const raw = localStorage.getItem(queueLabelsStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
    }
  }

  function loadQueueCollapsedState() {
    try {
      return localStorage.getItem(QUEUE_COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setQueueCollapsedState(collapsed, { persist = true } = {}) {
    if (!queuePanel || !btnQueueToggle) return;
    const isCollapsed = Boolean(collapsed);
    queuePanel.classList.toggle("is-collapsed", isCollapsed);
    btnQueueToggle.classList.toggle("is-collapsed", isCollapsed);
    btnQueueToggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    btnQueueToggle.setAttribute("aria-label", isCollapsed ? "展开任务队列" : "收起任务队列");
    btnQueueToggle.setAttribute("title", isCollapsed ? "展开" : "收起");
    if (persist) {
      try {
        localStorage.setItem(QUEUE_COLLAPSED_STORAGE_KEY, isCollapsed ? "1" : "0");
      } catch {
        // Ignore storage failures.
      }
    }
  }

  function persistQueueLabelMap() {
    try {
      localStorage.setItem(queueLabelsStorageKey(), JSON.stringify(queueLabelMap || {}));
    } catch {
      // Ignore storage write failures.
    }
  }

  function bindQueueLabel(promptId, rawText) {
    const id = String(promptId || "").trim();
    if (!id) return;
    const text = String(rawText || "").trim();
    if (!text) return;
    queueLabelMap[id] = text;
    persistQueueLabelMap();
  }

  function getBoundQueueLabel(promptId) {
    const id = String(promptId || "").trim();
    if (!id) return "";
    return String(queueLabelMap[id] || "").trim();
  }

  function persistChatHistoryEntries() {
    try {
      localStorage.setItem(chatHistoryStorageKey(), JSON.stringify(chatHistoryEntries.slice(-MAX_CHAT_HISTORY_ITEMS)));
    } catch {
      // Ignore quota errors; UI should remain functional.
    }
  }

  function htmlToPlainText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = String(html || "");
    return (temp.textContent || "").replace(/\s+/g, " ").trim();
  }

  function systemHtmlToPlainText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = String(html || "");
    // 结果卡片里的文件名/按钮文案由媒体卡片展示，不需要并入系统文本。
    temp.querySelectorAll(".result-grid").forEach((el) => el.remove());
    return (temp.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractMediaFromMessageHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = String(html || "");
    const media = [];
    const cards = temp.querySelectorAll(".result-card");
    if (cards.length) {
      cards.forEach((card) => {
        const img = card.querySelector("img.result-media");
        const video = card.querySelector("video.result-media");
        const downloadLink = card.querySelector(".result-download");
        const nameEl = card.querySelector(".result-name");
        const name = (nameEl?.textContent || "").trim();
        const downloadUrl = downloadLink?.getAttribute("href") || "";
        if (img instanceof HTMLImageElement) {
          const src = img.getAttribute("src") || "";
          if (src) media.push({ kind: "image", url: src, name, download_url: downloadUrl });
          return;
        }
        if (video instanceof HTMLVideoElement) {
          const src = video.getAttribute("src") || "";
          if (src) media.push({ kind: "video", url: src, name, download_url: downloadUrl });
        }
      });
      return media;
    }
    return media;
  }

  function pushChatHistoryEntry(entry, options = {}) {
    const preferredConversationId = String(options?.conversationId || "").trim();
    const conversationId = preferredConversationId || ensureConversationId(entry, currentConversationId || createConversationId());
    if (!currentConversationId) currentConversationId = conversationId;
    chatHistoryEntries.push({ ...entry, conversation_id: conversationId });
    if (chatHistoryEntries.length > MAX_CHAT_HISTORY_ITEMS) {
      chatHistoryEntries = chatHistoryEntries.slice(-MAX_CHAT_HISTORY_ITEMS);
    }
    persistChatHistoryEntries();
    renderConversationList();
  }

  function removeConversationMessageByKey(conversationId, messageKey) {
    const id = String(conversationId || "").trim();
    const key = String(messageKey || "").trim();
    if (!id || !key) return;
    const before = chatHistoryEntries.length;
    chatHistoryEntries = chatHistoryEntries.filter(
      (item) => !(String(item.conversation_id || "") === id && String(item.message_key || "") === key)
    );
    if (chatHistoryEntries.length === before) return;
    persistChatHistoryEntries();
    renderConversationList();
    if (currentConversationId === id) {
      renderChatForConversation(id);
    }
  }

  function replaceConversationSystemMessageByKey(conversationId, messageKey, html) {
    const id = String(conversationId || "").trim();
    const key = String(messageKey || "").trim();
    if (!id || !key) return false;
    const idx = chatHistoryEntries.findIndex(
      (item) =>
        String(item.conversation_id || "") === id &&
        String(item.message_key || "") === key &&
        item.role === "system"
    );
    if (idx < 0) return false;
    const plainText = systemHtmlToPlainText(html);
    chatHistoryEntries[idx] = {
      ...chatHistoryEntries[idx],
      role: "system",
      text: plainText,
      plain: plainText,
      media: extractMediaFromMessageHtml(html),
    };
    persistChatHistoryEntries();
    renderConversationList();
    if (currentConversationId === id) {
      renderChatForConversation(id);
    }
    return true;
  }

  function getConversationEntries(conversationId) {
    const id = String(conversationId || "").trim();
    return chatHistoryEntries
      .filter((item) => String(item.conversation_id || "") === id)
      .sort((a, b) => a.ts - b.ts);
  }

  function getConversationPreviewTitle(conversationId) {
    const list = getConversationEntries(conversationId);
    const firstUser = list.find((item) => item.role === "user" && String(item.text || "").trim());
    if (firstUser) {
      const raw = String(firstUser.text || "").trim();
      return raw.length > 18 ? `${raw.slice(0, 18)}…` : raw;
    }
    return CHAT_CONVERSATION_DEFAULT_TITLE;
  }

  function getConversationSummaryList() {
    const map = new Map();
    for (const item of chatHistoryEntries) {
      const id = String(item.conversation_id || "").trim();
      if (!id) continue;
      const prev = map.get(id);
      if (!prev || item.ts > prev.lastTs) {
        map.set(id, { id, lastTs: item.ts });
      }
    }
    const list = Array.from(map.values())
      .sort((a, b) => b.lastTs - a.lastTs)
      .map((x) => ({
        id: x.id,
        title: getConversationPreviewTitle(x.id),
        lastTs: x.lastTs,
      }));
    if (!list.length && currentConversationId) {
      return [{ id: currentConversationId, title: CHAT_CONVERSATION_DEFAULT_TITLE, lastTs: Date.now() }];
    }
    return list;
  }

  function renderConversationList() {
    if (!conversationList) return;
    const list = getConversationSummaryList();
    if (!list.length) {
      conversationList.innerHTML = '<p class="conversation-empty">暂无对话</p>';
      return;
    }
    conversationList.innerHTML = list
      .map((item) => {
        const active = item.id === currentConversationId;
        return `
          <article class="conversation-item ${active ? "is-active" : ""}" data-conversation-id="${escapeHtml(item.id)}">
            <button type="button" class="conversation-item__main" data-conversation-open="${escapeHtml(item.id)}">
              <span class="conversation-item__title">${escapeHtml(item.title)}</span>
            </button>
            <button type="button" class="conversation-item__delete" data-conversation-delete="${escapeHtml(item.id)}" aria-label="删除对话">×</button>
          </article>
        `;
      })
      .join("");
  }

  function buildMediaCardsHtml(mediaList) {
    const media = Array.isArray(mediaList) ? mediaList : [];
    if (!media.length) return "";
    const cards = media
      .map((m, i) => {
        const kind = String(m.kind || "").toLowerCase();
        const url = String(m.url || "").trim();
        const name = escapeHtml(String(m.name || `media-${i + 1}`));
        const dl = escapeHtml(String(m.download_url || ""));
        if (!url) return "";
        const mediaEl =
          kind === "video"
            ? `<video class="result-media" src="${escapeHtml(url)}" controls preload="metadata"></video>`
            : `<img class="result-media" src="${escapeHtml(url)}" alt="${name}" loading="lazy" />`;
        const refBtn =
          kind !== "video"
            ? `<button type="button" class="result-use-ref" data-set-reference-url="${escapeHtml(url)}" data-set-reference-name="${name}">设为参考图</button>`
            : "";
        return `
          <div class="result-card">
            <div class="result-media-wrap">${mediaEl}</div>
            <div class="result-meta">
              <span class="result-name">${name}</span>
              <div class="result-meta-actions">
                ${refBtn}
                ${dl ? `<a class="result-download" href="${dl}" download>下载</a>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    return cards ? `<div class="result-grid">${cards}</div>` : "";
  }

  function renderChatForConversation(conversationId) {
    const list = getConversationEntries(conversationId);
    chat.innerHTML = "";
    if (!list.length) {
      chat.classList.add("chat--empty");
      const span = document.createElement("span");
      span.id = "chatPlaceholder";
      span.textContent = "在下方选择创作类型，输入创意或上传参考图后开始创作";
      chat.appendChild(span);
      return;
    }
    chat.classList.remove("chat--empty");
    for (const item of list) {
      if (item.role === "user") {
        const user = document.createElement("div");
        user.className = "msg msg--user";
        user.textContent = String(item.text || "");
        chat.appendChild(user);
        if (Array.isArray(item.meta) && item.meta.length) {
          const meta = document.createElement("div");
          meta.className = "msg msg--meta";
          meta.textContent = item.meta.join(" · ");
          chat.appendChild(meta);
        }
        const referenceMedia = Array.isArray(item.reference_media) ? item.reference_media : [];
        if (referenceMedia.length) {
          const quoteWrap = document.createElement("div");
          quoteWrap.className = "msg-user-quote";
          referenceMedia.forEach((m, idx) => {
            const src = String(m?.url || "").trim();
            if (!src) return;
            const name = String(m?.name || `参考图 ${idx + 1}`);
            const quote = document.createElement("button");
            quote.type = "button";
            quote.className = "msg-user-quote-card";
            quote.setAttribute("data-user-ref-url", src);
            quote.setAttribute("data-user-ref-name", name);
            quote.innerHTML = `
              <img class="msg-user-quote-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" />
              <span class="msg-user-quote-text">
                <span class="msg-user-quote-label">引用图片</span>
                <span class="msg-user-quote-name">${escapeHtml(name)}</span>
              </span>
            `;
            quoteWrap.appendChild(quote);
          });
          if (quoteWrap.childElementCount > 0) {
            chat.appendChild(quoteWrap);
          }
        }
      } else {
        const sys = document.createElement("div");
        sys.className = "msg msg--system";
        const text = escapeHtml(String(item.text || item.plain || ""));
        sys.innerHTML = `${text ? `<div>${text}</div>` : ""}${buildMediaCardsHtml(item.media)}`;
        chat.appendChild(sys);
      }
    }
    chat.scrollTop = chat.scrollHeight;
  }

  function switchConversation(conversationId) {
    const id = String(conversationId || "").trim();
    if (!id) return;
    currentConversationId = id;
    renderConversationList();
    renderChatForConversation(id);
  }

  function createNewConversation() {
    const id = createConversationId();
    currentConversationId = id;
    renderConversationList();
    renderChatForConversation(id);
  }

  function deleteConversation(conversationId) {
    const id = String(conversationId || "").trim();
    if (!id) return;
    chatHistoryEntries = chatHistoryEntries.filter((item) => String(item.conversation_id || "") !== id);
    persistChatHistoryEntries();
    const summaries = getConversationSummaryList();
    if (!summaries.length) {
      createNewConversation();
      return;
    }
    if (currentConversationId === id) {
      switchConversation(summaries[0].id);
    } else {
      renderConversationList();
    }
  }

  function renderChatHistoryByDate(dateKey) {
    if (!chatHistoryList) return;
    const list = chatHistoryEntries
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => toDateKey(item.ts) === dateKey);
    if (!list.length) {
      chatHistoryList.innerHTML = '<p class="chat-history-empty">该日期暂无聊天记录。</p>';
      return;
    }
    chatHistoryList.innerHTML = list
      .map(({ item, idx }) => {
        const t = new Date(item.ts).toLocaleTimeString("zh-CN", { hour12: false });
        const roleLabel = item.role === "user" ? "你" : "系统";
        const roleClass = item.role === "user" ? "chat-history-item--user" : "chat-history-item--system";
        const content = item.role === "user"
          ? escapeHtml(String(item.text || ""))
          : escapeHtml(String(item.text || item.plain || ""));
        const recallAction = item.role === "user" && String(item.text || "").trim()
          ? `<button type="button" class="chat-history-recall" data-history-recall="${idx}">回填到输入框</button>`
          : "";
        const meta = item.role === "user" && Array.isArray(item.meta) && item.meta.length
          ? `<div class="chat-history-item__meta">${escapeHtml(item.meta.join(" · "))}</div>`
          : "";
        const mediaPreview = Array.isArray(item.media) && item.media.length
          ? `
            <div class="chat-history-media">
              ${item.media
                .map((m, i) => {
                  const kind = String(m.kind || "").toLowerCase();
                  const src = escapeHtml(String(m.url || ""));
                  const nameSafe = escapeHtml(String(m.name || `media-${i + 1}`));
                  const downloadUrl = escapeHtml(String(m.download_url || ""));
                  const mediaEl = kind === "video"
                    ? `<video class="chat-history-media-item" data-media-kind="video" data-media-url="${src}" src="${src}" preload="metadata" muted controls></video>`
                    : `<img class="chat-history-media-item" data-media-kind="image" data-media-url="${src}" src="${src}" alt="${nameSafe}" loading="lazy" />`;
                  const dl = downloadUrl
                    ? `<button type="button" class="chat-history-media-download" data-download-url="${downloadUrl}">下载</button>`
                    : "";
                  return `
                    <div class="chat-history-media-card">
                      ${mediaEl}
                      <div class="chat-history-media-meta">
                        <span>${nameSafe}</span>
                        ${dl}
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : "";
        return `
          <article class="chat-history-item ${roleClass}">
            <div class="chat-history-item__head">
              <span>${roleLabel}</span>
              <time>${t}</time>
            </div>
            <div class="chat-history-item__body">${content || "（空）"}</div>
            ${meta}
            ${mediaPreview}
            ${recallAction}
          </article>
        `;
      })
      .join("");
  }

  function getSelectedHistoryDate() {
    if (chatHistoryDate && chatHistoryDate.value) return chatHistoryDate.value;
    return toDateKey(Date.now());
  }

  function deleteHistoryByDate(dateKey) {
    chatHistoryEntries = chatHistoryEntries.filter((item) => toDateKey(item.ts) !== dateKey);
    persistChatHistoryEntries();
    renderChatHistoryByDate(dateKey);
  }

  function clearAllHistory() {
    chatHistoryEntries = [];
    persistChatHistoryEntries();
    renderChatHistoryByDate(getSelectedHistoryDate());
  }

  async function tryDownloadHistoryMedia(url) {
    if (!url) return;
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) {
        window.alert("该文件下载失败：历史记录已被清理，请重新生成。");
        return;
      }
      window.location.href = url;
    } catch {
      window.alert("该文件下载失败：历史记录已被清理，请重新生成。");
    }
  }

  function extractDownloadFilename(url, fallback = "download.bin") {
    try {
      const u = new URL(url, window.location.origin);
      const byQuery = (u.searchParams.get("filename") || "").trim();
      if (byQuery) return byQuery;
      const byPath = (u.pathname.split("/").pop() || "").trim();
      if (byPath && byPath.includes(".")) return byPath;
    } catch {
      // Ignore parse errors and fallback.
    }
    return fallback;
  }

  async function tryDownloadResultMedia(url) {
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        window.alert("下载失败：文件可能已被清理，请重新生成后再下载。");
        return;
      }
      const blob = await response.blob();
      if (!blob || blob.size <= 0) {
        window.alert("下载失败：文件内容为空，请重新生成后再试。");
        return;
      }
      const fileName = extractDownloadFilename(url, "result.bin");
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.alert("下载失败：网络异常或文件已失效，请稍后重试。");
    }
  }

  function recallHistoryToPrompt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= chatHistoryEntries.length) return;
    const item = chatHistoryEntries[index];
    if (!item || item.role !== "user") return;
    const text = String(item.text || "").trim();
    if (!text) return;
    promptEl.value = text;
    promptEl.focus();
    closeChatHistoryModal();
  }

  function openChatHistoryModal() {
    if (!chatHistoryModal || !chatHistoryDate) return;
    const latestTs = chatHistoryEntries.length ? chatHistoryEntries[chatHistoryEntries.length - 1].ts : Date.now();
    const defaultDate = chatHistoryDate.value || toDateKey(latestTs);
    chatHistoryDate.value = defaultDate;
    renderChatHistoryByDate(defaultDate);
    chatHistoryModal.hidden = false;
    document.body.classList.add("chat-history-open");
  }

  function closeChatHistoryModal() {
    if (!chatHistoryModal) return;
    chatHistoryModal.hidden = true;
    document.body.classList.remove("chat-history-open");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** @type {Record<string, string>} */
  let studioUsersMap = { default: "default" };

  function isStudioUserAuthed() {
    try {
      const id = studioUserId || "";
      const token = getStudioSessionToken();
      if (!studioMultiUserEnabled) return Boolean(id);
      return Boolean(
        token &&
        id &&
        sessionStorage.getItem(STUDIO_AUTH_SESSION_KEY) === id,
      );
    } catch {
      return false;
    }
  }

  function syncComfyUserIdentity(userId, displayName) {
    try {
      window.RhStudioAuth?.syncComfyUser?.(userId, displayName);
    } catch {
      // Ignore sync failures.
    }
  }

  function markStudioUserAuthed(userId) {
    try {
      sessionStorage.setItem(STUDIO_AUTH_SESSION_KEY, String(userId || "").trim());
    } catch {
      // Ignore storage failures.
    }
  }

  function clearStudioUserAuth() {
    try {
      sessionStorage.removeItem(STUDIO_AUTH_SESSION_KEY);
      sessionStorage.removeItem(STUDIO_SESSION_TOKEN_KEY);
    } catch {
      // Ignore storage failures.
    }
    window.RhStudioAuth?.clearPersistentSession?.();
  }

  function applyStudioLoginRememberState() {
    const remember = window.RhStudioAuth?.isRememberLoginEnabled?.() ?? false;
    if (studioLoginRemember) studioLoginRemember.checked = remember;
    if (!remember) return;
    const saved = window.RhStudioAuth?.loadSavedCredentials?.();
    if (saved?.username && studioLoginUsername) {
      studioLoginUsername.value = saved.username;
    }
    if (saved?.password && studioLoginPassword) {
      studioLoginPassword.value = saved.password;
    }
  }

  function isStudioLoginRememberRequested() {
    if (isStudioLoginModalOpen()) {
      return Boolean(studioLoginRemember?.checked);
    }
    return window.RhStudioAuth?.isRememberLoginEnabled?.() ?? false;
  }

  function syncStudioLoginRememberUi() {
    if (studioLoginRemember) {
      studioLoginRemember.checked = window.RhStudioAuth?.isRememberLoginEnabled?.() ?? false;
    }
  }

  function clearStudioLoginFields() {
    const remember = window.RhStudioAuth?.isRememberLoginEnabled?.() ?? false;
    if (studioLoginPassword && !remember) studioLoginPassword.value = "";
    if (studioLoginNewName) studioLoginNewName.value = "";
    if (studioLoginNewPassword) studioLoginNewPassword.value = "";
    if (studioLoginConfirmPassword) studioLoginConfirmPassword.value = "";
  }

  function validateStudioPassword(password, label = "密码") {
    const value = String(password || "");
    if (value.length < STUDIO_MIN_PASSWORD_LENGTH) {
      return `${label}至少 ${STUDIO_MIN_PASSWORD_LENGTH} 位`;
    }
    return "";
  }

  function getStudioUserDisplayName() {
    return studioUsersMap[studioUserId] || studioUserId || "default";
  }

  function resolveStudioUserId(usernameOrId) {
    const text = String(usernameOrId || "").trim();
    if (!text) return "";
    if (studioUsersMap[text]) return text;
    const lower = text.toLowerCase();
    for (const [userId, displayName] of Object.entries(studioUsersMap)) {
      const name = String(displayName || "").trim();
      if (name === text || name.toLowerCase() === lower) return userId;
      if (String(userId) === text) return userId;
    }
    return "";
  }

  function syncAuthBadgeUi({ labelEl, btnEl, dropdownEl, logoutBtnEl }) {
    if (!labelEl || !btnEl) return;
    const authed = isStudioUserAuthed();
    // studioIsFirstSetup：服务器有用户系统但尚无用户，需要引导注册
    const requiresAuth = studioMultiUserEnabled || studioIsFirstSetup;
    const menuAvailable = !requiresAuth || authed;
    const name = getStudioUserDisplayName();
    if (studioIsFirstSetup) labelEl.textContent = "注册 / 登录";
    else if (!studioMultiUserEnabled) labelEl.textContent = "默认用户";
    else if (authed) labelEl.textContent = name;
    else labelEl.textContent = "登录";
    btnEl.classList.toggle("is-logged-in", authed || (!requiresAuth));
    btnEl.setAttribute("aria-haspopup", menuAvailable ? "menu" : "dialog");
    btnEl.setAttribute("aria-controls", menuAvailable ? (dropdownEl?.id || "") : "studioLoginModal");
    if (!authed) btnEl.setAttribute("aria-expanded", "false");
    if (!menuAvailable && dropdownEl) dropdownEl.classList.add("is-hidden");
    if (logoutBtnEl) logoutBtnEl.hidden = !studioMultiUserEnabled || !authed;
  }

  function updateStudioUserUi() {
    syncAuthBadgeUi({ labelEl: homeLoginLabel, btnEl: btnHomeLogin, dropdownEl: homeAuthDropdown, logoutBtnEl: btnHomeLogout });
    syncAuthBadgeUi({ labelEl: chatLoginLabel, btnEl: btnChatLogin, dropdownEl: chatAuthDropdown, logoutBtnEl: btnChatLogout });
    if (!isStudioUserAuthed() && studioMultiUserEnabled) {
      closeHomeAuthDropdown();
      closeChatAuthDropdown();
    }
  }

  function openStudioApiSettings() {
    closeHomeAuthDropdown();
    closeChatAuthDropdown();
    window.RhApiSettings?.open?.();
  }

  function openHomeAuthDropdown() {
    if (!homeAuthDropdown || !btnHomeLogin) return;
    closeChatAuthDropdown();
    homeAuthDropdown.classList.remove("is-hidden");
    btnHomeLogin.setAttribute("aria-expanded", "true");
  }

  function closeHomeAuthDropdown() {
    if (!homeAuthDropdown || !btnHomeLogin) return;
    homeAuthDropdown.classList.add("is-hidden");
    btnHomeLogin.setAttribute("aria-expanded", "false");
  }

  function toggleHomeAuthDropdown() {
    if (!homeAuthDropdown) return;
    if (homeAuthDropdown.classList.contains("is-hidden")) openHomeAuthDropdown();
    else closeHomeAuthDropdown();
  }

  function openChatAuthDropdown() {
    if (!chatAuthDropdown || !btnChatLogin) return;
    closeHomeAuthDropdown();
    chatAuthDropdown.classList.remove("is-hidden");
    btnChatLogin.setAttribute("aria-expanded", "true");
  }

  function closeChatAuthDropdown() {
    if (!chatAuthDropdown || !btnChatLogin) return;
    chatAuthDropdown.classList.add("is-hidden");
    btnChatLogin.setAttribute("aria-expanded", "false");
  }

  function toggleChatAuthDropdown() {
    if (!chatAuthDropdown) return;
    if (chatAuthDropdown.classList.contains("is-hidden")) openChatAuthDropdown();
    else closeChatAuthDropdown();
  }

  async function logoutStudioUser() {
    closeHomeAuthDropdown();
    closeChatAuthDropdown();
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
    clearStudioUserAuth();
    updateStudioUserUi();
    syncStudioLoginRememberUi();
    window.RhStudioAuth?.notifyAuthChange?.();
    if (typeof window.$message?.success === "function") {
      window.$message.success("已退出登录");
    }
  }

  function isStudioLoginModalOpen() {
    return Boolean(studioLoginModal && !studioLoginModal.classList.contains("is-hidden"));
  }

  function openStudioLoginModal() {
    if (!studioLoginModal) return;
    if (isStudioLoginModalOpen()) return;

    clearStudioLoginFields();
    if (studioLoginUsername) {
      studioLoginUsername.value = getStudioUserDisplayName();
    }
    applyStudioLoginRememberState();
    studioLoginModal.classList.remove("is-hidden");
    document.body.classList.add("studio-login-open");

    const hasUsername = Boolean(String(studioLoginUsername?.value || "").trim());
    window.requestAnimationFrame(() => {
      if (hasUsername) studioLoginPassword?.focus();
      else studioLoginUsername?.focus();
    });
  }

  function closeStudioLoginModal() {
    if (!studioLoginModal) return;
    studioLoginModal.classList.add("is-hidden");
    document.body.classList.remove("studio-login-open");
    clearStudioLoginFields();
  }

  function requireStudioLoginBeforeEnter(next) {
    if (!studioMultiUserEnabled) {
      next();
      return;
    }
    if (studioUserId && studioUsersMap[studioUserId] && isStudioUserAuthed()) {
      next();
      return;
    }
    openStudioLoginModal();
    window.$message?.warning?.("请先登录后再进入");
  }

  async function loginStudioUser(usernameOrId, password, options = {}) {
    const silent = Boolean(options.silent);
    const id = resolveStudioUserId(usernameOrId);
    const pwd = String(password || "");
    const pwdErr = validateStudioPassword(pwd);
    if (!String(usernameOrId || "").trim()) {
      if (!silent) window.alert("请输入用户名");
      return false;
    }
    if (!id) {
      if (!silent) window.alert("找不到该用户名，请检查输入或先注册");
      return false;
    }
    if (pwdErr) {
      if (!silent) window.alert(pwdErr);
      return false;
    }
    try {
      const data = await requestJson("/rh/api/studio/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, password: pwd }),
      });
      // 重要：必须先写入 token，再调用 switchStudioUser。
      // switchStudioUser 会触发 reloadUserScopedState → refreshQueueFromServer，
      // 如果 token 尚未写入 sessionStorage，请求会因没有认证而触发 handleStudioSessionExpired，
      // 清除刚写入的登录态并再次弹出登录框。
      setStudioSessionToken(data?.session_token || "");
      markStudioUserAuthed(id);
      if (id !== studioUserId) {
        await switchStudioUser(id);
      }
      const remember = isStudioLoginRememberRequested();
      window.RhStudioAuth?.applyRememberLogin?.({
        remember,
        username: String(studioLoginUsername?.value || usernameOrId || "").trim(),
        password: pwd,
        token: data?.session_token || "",
        userId: id,
      });
      syncComfyUserIdentity(id, studioUsersMap[id] || id);
      updateStudioUserUi();
      window.RhStudioAuth?.notifyAuthChange?.();
      closeStudioLoginModal();
      if (data?.first_time_setup && !silent) {
        window.alert("首次登录，密码已设置成功");
      }
      return true;
    } catch (err) {
      if (!silent) window.alert(err?.message || "登录失败");
      return false;
    }
  }

  async function reloadUserScopedState() {
    ownedPromptIds = loadOwnedPromptIds();
    chatHistoryEntries = loadChatHistoryEntries();
    queueLabelMap = loadQueueLabelMap();
    queueEntries = loadQueueEntries();
    if (chatHistoryEntries.length) {
      currentConversationId = String(chatHistoryEntries[chatHistoryEntries.length - 1].conversation_id || "").trim();
    } else {
      currentConversationId = createConversationId();
    }
    renderConversationList();
    renderChatForConversation(currentConversationId);
    renderQueueList();
    await refreshQueueFromServer();
  }

  async function switchStudioUser(nextUserId) {
    const id = String(nextUserId || "").trim();
    if (!id || id === studioUserId) return;
    studioUserId = id;
    try {
      localStorage.setItem(STUDIO_USER_STORAGE_KEY, id);
    } catch {
      // Ignore storage failures.
    }
    await reloadUserScopedState();
    updateStudioUserUi();
  }

  async function createStudioUser(username, password, confirmPassword) {
    const name = String(username || "").trim();
    const pwd = String(password || "");
    const confirm = String(confirmPassword || "");
    if (!name) {
      window.alert("请输入用户名");
      return;
    }
    const pwdErr = validateStudioPassword(pwd, "密码");
    if (pwdErr) {
      window.alert(pwdErr);
      return;
    }
    if (pwd !== confirm) {
      window.alert("两次输入的密码不一致");
      return;
    }
    try {
      const data = await requestJson("/rh/api/studio/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pwd }),
      });
      const id = typeof data?.user_id === "string" ? data.user_id : String(data?.user_id || "").trim();
      if (!id) throw new Error("创建用户失败");
      studioUsersMap[id] = name;
      studioMultiUserEnabled = true;
      studioIsFirstSetup = false;
      await switchStudioUser(id);
      setStudioSessionToken(data?.session_token || "");
      markStudioUserAuthed(id);
      const remember = isStudioLoginRememberRequested();
      window.RhStudioAuth?.applyRememberLogin?.({
        remember,
        username: name,
        password: pwd,
        token: data?.session_token || "",
        userId: id,
      });
      syncComfyUserIdentity(id, name);
      updateStudioUserUi();
      window.RhStudioAuth?.notifyAuthChange?.();
      closeStudioLoginModal();
    } catch (err) {
      window.alert(err?.message || "注册失败");
    }
  }

  async function initStudioUser() {
    studioUserId = localStorage.getItem(STUDIO_USER_STORAGE_KEY) || "default";
    try {
      const data = await requestJson("/users");
      if (data?.users && typeof data.users === "object" && Object.keys(data.users).length) {
        studioMultiUserEnabled = true;
        studioIsFirstSetup = false;
        studioUsersMap = data.users;
        if (!studioUsersMap[studioUserId]) {
          studioUserId = Object.keys(studioUsersMap)[0] || "default";
          localStorage.setItem(STUDIO_USER_STORAGE_KEY, studioUserId);
        }
      } else {
        // 服务器有用户系统但尚无账号（首次部署），允许注册
        studioMultiUserEnabled = false;
        studioIsFirstSetup = true;
        studioUserId = "default";
      }
    } catch {
      studioMultiUserEnabled = false;
      studioIsFirstSetup = false;
      studioUserId = "default";
    }
    ownedPromptIds = loadOwnedPromptIds();
    syncComfyUserIdentity(studioUserId, getStudioUserDisplayName());
    syncStudioLoginRememberUi();
    // 注意：故意不在此处调用 updateStudioUserUi()。
    // 必须等待 validateStudioSessionOnInit() 完成后再更新 UI，
    // 否则 sessionStorage 中的旧 token 会导致用户名一闪后立刻弹登录框。
    const sessionValid = await validateStudioSessionOnInit();
    // session 验证结束后统一更新一次 UI：
    // - sessionValid=true：validateStudioSessionOnInit 内部不更新 UI，需要在此处更新
    // - sessionValid=false 且 studioMultiUserEnabled：handleStudioSessionExpired 已更新，但再调一次无害
    // - sessionValid=false 且 !studioMultiUserEnabled（含 studioIsFirstSetup）：validateStudioSessionOnInit
    //   直接返回 true 跳过此 else 分支，但我们改为无条件更新以覆盖 firstSetup 初始化状态
    updateStudioUserUi();
    if (!sessionValid) {
      await tryAutoLoginWithSavedCredentials();
    }
  }

  async function tryAutoLoginWithSavedCredentials() {
    if (!studioMultiUserEnabled || isStudioUserAuthed()) return;
    if (!window.RhStudioAuth?.isRememberLoginEnabled?.()) return;
    const saved = window.RhStudioAuth?.loadSavedCredentials?.();
    if (!saved?.username || !saved?.password) return;
    await loginStudioUser(saved.username, saved.password, { silent: true });
  }

  function bindStudioUserControls() {
    if (btnHomeLogin) {
      btnHomeLogin.addEventListener("click", (event) => {
        event.stopPropagation();
        // 纯默认用户模式（非首次建账）：直接展开菜单
        if (!studioMultiUserEnabled && !studioIsFirstSetup) {
          toggleHomeAuthDropdown();
          return;
        }
        if (!studioIsFirstSetup && isStudioUserAuthed()) toggleHomeAuthDropdown();
        else openStudioLoginModal();
      });
    }
    if (btnHomeApiSettings) {
      btnHomeApiSettings.addEventListener("click", (event) => {
        event.stopPropagation();
        openStudioApiSettings();
      });
    }
    if (btnHomeLogout) {
      btnHomeLogout.addEventListener("click", (event) => {
        event.stopPropagation();
        void logoutStudioUser();
      });
    }
    if (btnChatLogin) {
      btnChatLogin.addEventListener("click", (event) => {
        event.stopPropagation();
        // 纯默认用户模式（非首次建账）：直接展开菜单
        if (!studioMultiUserEnabled && !studioIsFirstSetup) {
          toggleChatAuthDropdown();
          return;
        }
        if (!studioIsFirstSetup && isStudioUserAuthed()) toggleChatAuthDropdown();
        else openStudioLoginModal();
      });
    }
    if (btnChatApiSettings) {
      btnChatApiSettings.addEventListener("click", (event) => {
        event.stopPropagation();
        openStudioApiSettings();
      });
    }
    if (btnChatLogout) {
      btnChatLogout.addEventListener("click", (event) => {
        event.stopPropagation();
        void logoutStudioUser();
      });
    }
    if (homeAuthMenu) {
      homeAuthMenu.addEventListener("click", (event) => event.stopPropagation());
    }
    if (chatAuthMenu) {
      chatAuthMenu.addEventListener("click", (event) => event.stopPropagation());
    }
    document.addEventListener("click", () => {
      closeHomeAuthDropdown();
      closeChatAuthDropdown();
    });
    window.addEventListener("rh-studio-auth-change", () => updateStudioUserUi());
    if (btnCloseStudioLogin) {
      btnCloseStudioLogin.addEventListener("click", closeStudioLoginModal);
    }
    if (studioLoginBackdrop) {
      studioLoginBackdrop.addEventListener("click", closeStudioLoginModal);
    }
    if (btnConfirmStudioLogin) {
      btnConfirmStudioLogin.addEventListener("click", () => {
        void loginStudioUser(studioLoginUsername?.value || "", studioLoginPassword?.value || "");
      });
    }
    if (btnRegisterStudioLogin) {
      btnRegisterStudioLogin.addEventListener("click", () => {
        void createStudioUser(
          studioLoginNewName?.value || "",
          studioLoginNewPassword?.value || "",
          studioLoginConfirmPassword?.value || "",
        );
      });
    }
    if (studioLoginPassword) {
      studioLoginPassword.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void loginStudioUser(studioLoginUsername?.value || "", studioLoginPassword.value);
        }
      });
    }
    if (studioLoginUsername) {
      studioLoginUsername.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          studioLoginPassword?.focus();
        }
      });
    }
    if (studioLoginConfirmPassword) {
      studioLoginConfirmPassword.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void createStudioUser(
            studioLoginNewName?.value || "",
            studioLoginNewPassword?.value || "",
            studioLoginConfirmPassword.value,
          );
        }
      });
    }
    if (studioLoginNewName) {
      studioLoginNewName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          studioLoginNewPassword?.focus();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && studioLoginModal && !studioLoginModal.classList.contains("is-hidden")) {
        closeStudioLoginModal();
      }
    });
  }

  function bindLandingEntrances() {
    if (!homeLanding) return;
    const path = String(window.location.pathname || "");
    const inChatPage = /\/rh\/studio\/chat\/?$/.test(path);
    document.title = inChatPage ? "玄机灵界AI智能体创作平台聊天" : "玄机灵界AI智能体创作平台";
    if (inChatPage) {
      homeLanding.classList.add("is-hidden");
      studioLayout?.classList.remove("is-hidden");
      if (studioMultiUserEnabled && !isStudioUserAuthed()) {
        openStudioLoginModal();
      }
    } else {
      homeLanding.classList.remove("is-hidden");
      studioLayout?.classList.add("is-hidden");
    }
    const openInNewPage = (url) => {
      // Open a blank tab first to avoid browsers returning null when using noopener.
      const opened = window.open("about:blank", "_blank");
      if (!opened) {
        window.alert("浏览器拦截了新页面，请允许本站弹窗后重试。");
        return;
      }
      try {
        opened.opener = null;
      } catch {
        // Ignore cross-window security assignment issues.
      }
      opened.location.href = url;
    };
    if (btnEnterChat) {
      btnEnterChat.addEventListener("click", () => {
        requireStudioLoginBeforeEnter(() => openInNewPage("/rh/studio/chat"));
      });
    }
    if (btnEnterPortal) {
      btnEnterPortal.addEventListener("click", () => {
        requireStudioLoginBeforeEnter(() => openInNewPage("/rh"));
      });
    }
    if (btnEnterCanvas) {
      btnEnterCanvas.addEventListener("click", () => {
        requireStudioLoginBeforeEnter(() => openInNewPage("/rh/canvas2"));
      });
    }
    if (btnGoStudioHome) {
      btnGoStudioHome.addEventListener("click", () => {
        window.location.href = "/rh/studio";
      });
    }
  }

  async function waitForPromptResult(promptId, { timeoutMs = 30000, intervalMs = 2000 } = {}) {
    const deadline = Date.now() + Math.max(timeoutMs, intervalMs);
    let latestResult = null;
    while (Date.now() < deadline) {
      if (cancelledPromptIds.has(promptId)) {
        const cancelError = new Error("任务已取消");
        cancelError.name = "AbortError";
        throw cancelError;
      }
      latestResult = await requestJson(
        `/rh/api/studio/result?prompt_id=${encodeURIComponent(promptId)}`
      );
      const media = Array.isArray(latestResult.media) ? latestResult.media : [];
      if (media.length) {
        return { result: latestResult, media };
      }
      if (latestResult.completed && latestResult.status === "success") {
        break;
      }
      await sleep(intervalMs);
    }
    return { result: latestResult, media: [] };
  }

  function releaseSendLockIfActive(promptId) {
    if (promptId && activeRunPromptId && promptId !== activeRunPromptId) return;
    if (btnSend) btnSend.disabled = false;
    promptEl.focus();
  }

  function markPromptCancelled(promptId) {
    const id = String(promptId || "").trim();
    if (!id) return;
    cancelledPromptIds.add(id);
    if (activeRunPromptId === id) {
      if (activeRunController) {
        try {
          activeRunController.abort();
        } catch {
          // Ignore abort errors.
        }
      }
      releaseSendLockIfActive(id);
    }
  }

  function closeAllPrettySelects(except) {
    document.querySelectorAll(".pretty-select.is-open").forEach((el) => {
      if (except && el === except) return;
      el.classList.remove("is-open");
    });
  }

  function buildPrettySelect(selectEl) {
    if (!selectEl || prettySelectStore.has(selectEl)) return;

    selectEl.classList.add("native-select-hidden");
    const pretty = document.createElement("div");
    pretty.className = "pretty-select";
    pretty.tabIndex = 0;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pretty-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");

    const label = document.createElement("span");
    label.className = "pretty-select__label";
    trigger.appendChild(label);

    const list = document.createElement("ul");
    list.className = "pretty-select__list";
    list.setAttribute("role", "listbox");

    pretty.appendChild(trigger);
    pretty.appendChild(list);
    selectEl.parentElement.appendChild(pretty);

    function refresh() {
      const options = Array.from(selectEl.options);
      list.innerHTML = "";
      options.forEach((opt) => {
        const item = document.createElement("li");
        item.className = "pretty-select__option";
        item.setAttribute("role", "option");
        item.dataset.value = opt.value;
        item.textContent = opt.textContent || opt.value;
        if (opt.value === selectEl.value) {
          item.classList.add("is-selected");
          item.setAttribute("aria-selected", "true");
        } else {
          item.setAttribute("aria-selected", "false");
        }
        item.addEventListener("click", () => {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          closeAllPrettySelects();
        });
        list.appendChild(item);
      });
      const selected = options.find((o) => o.value === selectEl.value) || options[0];
      label.textContent = selected ? selected.textContent || selected.value : "";
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = pretty.classList.contains("is-open");
      closeAllPrettySelects(pretty);
      if (!isOpen) pretty.classList.add("is-open");
    });

    pretty.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        pretty.classList.remove("is-open");
      }
    });

    selectEl.addEventListener("change", refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

    prettySelectStore.set(selectEl, { refresh, observer });
    refresh();
  }

  function setupPrettySelects() {
    buildPrettySelect(modeSelect);
    buildPrettySelect(workflowApp);
  }

  function isParamsPopoverOpen() {
    return paramsPopAnchor?.classList.contains("is-open") ?? false;
  }

  function updateParamsPopoverPlacement() {
    if (!paramsPopAnchor || !composerParamsBody) return;
    const gap = 10;
    const viewportPadding = 12;
    const rect = paramsPopAnchor.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    const spaceAbove = rect.top - viewportPadding - gap;
    const spaceBelow = viewportH - rect.bottom - viewportPadding - gap;
    const useUp = spaceAbove >= spaceBelow;

    paramsPopAnchor.classList.toggle("is-drop-up", useUp);
    paramsPopAnchor.classList.toggle("is-drop-down", !useUp);

    const usable = Math.max(180, Math.min(520, Math.floor(useUp ? spaceAbove : spaceBelow)));
    composerParamsBody.style.maxHeight = `${usable}px`;
  }

  function openParamsPopover() {
    if (!composerParamsBody || !btnParamsTrigger || !paramsPopAnchor) return;
    updateParamsPopoverPlacement();
    paramsPopAnchor?.classList.add("is-open");
    btnParamsTrigger.setAttribute("aria-expanded", "true");
    btnParamsTrigger.classList.add("is-open");
    composerParamsBody.setAttribute("aria-hidden", "false");
    composerParamsBody.removeAttribute("inert");
  }

  function closeParamsPopover() {
    if (!composerParamsBody || !btnParamsTrigger) return;
    paramsPopAnchor?.classList.remove("is-open");
    btnParamsTrigger.setAttribute("aria-expanded", "false");
    btnParamsTrigger.classList.remove("is-open");
    composerParamsBody.setAttribute("aria-hidden", "true");
    composerParamsBody.setAttribute("inert", "");
  }

  function toggleParamsPopover() {
    if (isParamsPopoverOpen()) closeParamsPopover();
    else openParamsPopover();
  }

  function getVisibleDynamicParams(params) {
    let list = Array.isArray(params) ? params.filter((p) => p && !isStudioPromptParam(p)) : [];
    if (needsReferenceMode()) {
      list = list.filter((p) => {
        const t = String(p.type || "text").toLowerCase();
        return t !== "image" && t !== "file";
      });
    }
    return list;
  }

  function updateParamsToolbarVisibility(params) {
    const group = paramsPopAnchor?.closest(".toolbar-group--params-pop");
    if (!group) return;
    const visibleParams = getVisibleDynamicParams(params);
    const hasVisibleParams = visibleParams.length > 0;
    group.hidden = !hasVisibleParams;
    if (!hasVisibleParams) {
      closeParamsPopover();
    }
  }

  function ensureImagePreviewOverlay() {
    if (imagePreviewOverlay && imagePreviewImg && imagePreviewVideo) return;
    const overlay = document.createElement("div");
    overlay.className = "image-preview-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <button type="button" class="image-preview-close" aria-label="关闭预览">×</button>
      <img class="image-preview-img" alt="图片预览" />
      <video class="image-preview-video" controls preload="metadata"></video>
    `;
    document.body.appendChild(overlay);
    imagePreviewOverlay = overlay;
    imagePreviewImg = overlay.querySelector(".image-preview-img");
    imagePreviewVideo = overlay.querySelector(".image-preview-video");

    overlay.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (target.classList.contains("image-preview-overlay") || target.closest(".image-preview-close")) {
        closeImagePreview();
      }
    });
  }

  function openImagePreview(src, altText) {
    if (!src) return;
    ensureImagePreviewOverlay();
    if (!imagePreviewOverlay || !imagePreviewImg || !imagePreviewVideo) return;
    imagePreviewImg.src = src;
    imagePreviewImg.alt = altText || "图片预览";
    imagePreviewImg.hidden = false;
    imagePreviewVideo.hidden = true;
    imagePreviewVideo.pause();
    imagePreviewVideo.removeAttribute("src");
    imagePreviewOverlay.hidden = false;
    document.body.classList.add("image-preview-open");
  }

  function openVideoPreview(src) {
    if (!src) return;
    ensureImagePreviewOverlay();
    if (!imagePreviewOverlay || !imagePreviewImg || !imagePreviewVideo) return;
    imagePreviewImg.hidden = true;
    imagePreviewImg.removeAttribute("src");
    imagePreviewVideo.src = src;
    imagePreviewVideo.hidden = false;
    imagePreviewOverlay.hidden = false;
    document.body.classList.add("image-preview-open");
    imagePreviewVideo.play().catch(() => {});
  }

  function closeImagePreview() {
    if (!imagePreviewOverlay || !imagePreviewImg || !imagePreviewVideo) return;
    imagePreviewOverlay.hidden = true;
    imagePreviewImg.removeAttribute("src");
    imagePreviewImg.hidden = false;
    imagePreviewVideo.pause();
    imagePreviewVideo.removeAttribute("src");
    imagePreviewVideo.hidden = true;
    document.body.classList.remove("image-preview-open");
  }

  function formatDynControlValue(el, def) {
    const type = String(def.type || "text");
    if (type === "toggle") {
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        return el.checked ? "是" : "否";
      }
      return "—";
    }
    if (el instanceof HTMLSelectElement) {
      const opt = el.options[el.selectedIndex];
      const t = (opt?.textContent || opt?.value || "").trim();
      return t || "—";
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const raw = (el.value ?? "").trim();
      return raw || "—";
    }
    return "—";
  }

  function refreshParamsSummary() {
    if (!paramsSummaryText || !dynamicParams) return;
    const defs = Array.isArray(currentAppDetail?.params) ? currentAppDetail.params : [];
    const byKey = {};
    for (const p of defs) {
      if (p && typeof p === "object" && p.key && !isStudioPromptParam(p)) {
        byKey[String(p.key)] = p;
      }
    }

    const nodes = dynamicParams.querySelectorAll("[data-dyn-param]");
    if (!nodes.length) {
      paramsSummaryText.textContent = "无暴露参数";
      if (btnParamsTrigger) btnParamsTrigger.removeAttribute("title");
      return;
    }

    const valueParts = [];
    const tooltipLines = [];
    for (const el of nodes) {
      const key = el.getAttribute("data-dyn-param");
      if (!key) continue;
      const def = byKey[key] || {};
      const field = el.closest(".params-pop-section") || el.closest(".field");
      const labelEl = field?.querySelector(".params-pop-section__title") || field?.querySelector(":scope > label");
      const label = (labelEl?.textContent || def.label || key).trim();
      const display = formatDynControlValue(el, def);
      valueParts.push(display);
      tooltipLines.push(`${label}: ${display}`);
    }

    const joined = valueParts.join(" · ");
    const MAX_VISIBLE = 96;
    paramsSummaryText.textContent =
      joined.length > MAX_VISIBLE ? `${joined.slice(0, MAX_VISIBLE - 1)}…` : joined;
    if (btnParamsTrigger) {
      btnParamsTrigger.title = tooltipLines.join("\n");
    }
  }

  function needsReferenceMode() {
    return generationMode === "i2i" || generationMode === "i2v";
  }

  /** Portal 发布时暴露的图片 / 文件类参数（顺序与 manifest 一致） */
  function getImageParamMeta() {
    const defs = Array.isArray(currentAppDetail?.params) ? currentAppDetail.params : [];
    const keys = [];
    const labels = [];
    for (const p of defs) {
      if (!p || typeof p !== "object" || !p.key) continue;
      const t = String(p.type || "text").toLowerCase();
      if (t === "image" || t === "file") {
        keys.push(String(p.key));
        labels.push(String(p.label || p.key));
      }
    }
    return { keys, labels };
  }

  function getReferenceImageCap() {
    const { keys } = getImageParamMeta();
    if (keys.length > 0) return keys.length;
    return MAX_REFERENCE_IMAGES;
  }

  /** 切换模板后若「声明了 N 张」则裁掉多传的参考图 */
  function trimReferenceToCap() {
    const { keys } = getImageParamMeta();
    if (!keys.length) return;
    const cap = keys.length;
    let changed = false;
    while (referenceItems.length > cap) {
      const last = referenceItems.pop();
      if (last?.objectUrl) URL.revokeObjectURL(last.objectUrl);
      changed = true;
    }
    if (changed) renderReferencePreview();
    else syncRefAddDisabled();
  }

  function updateReferenceHint() {
    if (!composerRefHint) return;
    if (!needsReferenceMode()) {
      composerRefHint.hidden = true;
      return;
    }
    const { keys, labels } = getImageParamMeta();
    if (keys.length > 0) {
      composerRefHint.textContent = `需上传 ${keys.length} 张图，与发布时暴露的图片类参数一一对应（从左到右）：${labels.join(" → ")}`;
      composerRefHint.hidden = false;
    } else {
      composerRefHint.textContent = "模板未单独声明图片类暴露参数时，请至少上传 1 张参考图。";
      composerRefHint.hidden = false;
    }
  }

  function isVideoMode() {
    return generationMode === "t2v" || generationMode === "i2v";
  }

  function modeLabelFromValue(mode) {
    const map = {
      t2i: "文生图",
      t2v: "文生视频",
      i2i: "图生图",
      i2v: "图生视频",
    };
    return map[mode] || mode;
  }

  function clearReferenceImages() {
    for (const it of referenceItems) {
      URL.revokeObjectURL(it.objectUrl);
    }
    referenceItems = [];
    if (fileInput) fileInput.value = "";
    renderReferencePreview();
    syncRefAddDisabled();
  }

  function removeReferenceById(id) {
    const idx = referenceItems.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const [removed] = referenceItems.splice(idx, 1);
    URL.revokeObjectURL(removed.objectUrl);
    renderReferencePreview();
    syncRefAddDisabled();
  }

  function syncRefAddDisabled() {
    if (!btnRefAdd) return;
    const cap = getReferenceImageCap();
    const atMax = referenceItems.length >= cap;
    btnRefAdd.disabled = atMax;
    const capLabel = cap < MAX_REFERENCE_IMAGES ? `本模板 ${cap} 张` : `${MAX_REFERENCE_IMAGES} 张`;
    btnRefAdd.title = atMax ? `已达上限（${capLabel}）` : "添加参考图";
    btnRefAdd.setAttribute("aria-label", atMax ? `已达上限（${capLabel}）` : "添加参考图");
  }

  function renderReferencePreview() {
    if (!composerRefPreview || !btnRefAdd) return;
    composerRefPreview.innerHTML = "";
    const { labels } = getImageParamMeta();
    for (let idx = 0; idx < referenceItems.length; idx += 1) {
      const it = referenceItems[idx];
      const col = document.createElement("div");
      col.className = "composer-ref-thumb-col";
      const wrap = document.createElement("div");
      wrap.className = "composer-ref-thumb-wrap";
      const img = document.createElement("img");
      img.src = it.objectUrl;
      img.alt = it.file.name || "参考图";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "composer-ref-remove";
      rm.setAttribute("aria-label", "移除此参考图");
      rm.textContent = "×";
      rm.addEventListener("click", (e) => {
        e.preventDefault();
        removeReferenceById(it.id);
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      const capEl = document.createElement("div");
      capEl.className = "composer-ref-thumb-caption";
      capEl.textContent = labels[idx] || `参考图 ${idx + 1}`;
      col.appendChild(wrap);
      col.appendChild(capEl);
      composerRefPreview.appendChild(col);
    }
    syncRefAddDisabled();
  }

  async function uploadImageToComfy(file) {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("type", "input");
    fd.append("overwrite", "true");
    const response = await fetch("/upload/image", mergeStudioRequestOptions({
      method: "POST",
      body: fd,
    }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : `上传失败 HTTP ${response.status}`);
    }
    const name = data.name;
    if (!name) {
      throw new Error("上传成功但未返回文件名");
    }
    return name;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeQueueStatus(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "running" || raw === "pending" || raw === "completed" || raw === "failed" || raw === "error") {
      return raw;
    }
    if (raw === "in_progress") return "running";
    if (raw === "cancelled" || raw === "canceled" || raw === "interrupted") {
      return "cancelled";
    }
    if (raw === "success" || raw === "done") return "completed";
    return "unknown";
  }

  function isQueueTerminalStatus(status) {
    const s = normalizeQueueStatus(status);
    return s === "completed" || s === "failed" || s === "error" || s === "cancelled";
  }

  function queueStatusLabel(status) {
    const s = normalizeQueueStatus(status);
    const map = {
      running: "执行中",
      pending: "排队中",
      completed: "已完成",
      failed: "失败",
      error: "异常",
      cancelled: "已取消",
      unknown: "未知",
    };
    return map[s] || "未知";
  }

  function formatQueueTime(ts) {
    if (!Number.isFinite(ts)) return "--:--:--";
    return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
  }

  function formatDurationMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "--";
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function getQueueTaskDurationText(item) {
    const execStartTs = Number(item?.execution_start_time);
    const execEndTs = Number(item?.execution_end_time);
    const status = normalizeQueueStatus(item?.status);
    const startTs = Number.isFinite(execStartTs) && execStartTs > 0 ? execStartTs : Number(item?.created_at);
    if (!Number.isFinite(startTs) || startTs <= 0) return "--";
    const endTs = isQueueTerminalStatus(status)
      ? ((Number.isFinite(execEndTs) && execEndTs > 0) ? execEndTs : (Number(item?.updated_at) || Date.now()))
      : Date.now();
    const elapsedMs = Math.max(0, endTs - startTs);
    return formatDurationMs(elapsedMs);
  }

  function queueSortRank(status) {
    const s = normalizeQueueStatus(status);
    if (s === "running") return 1;
    if (s === "pending") return 2;
    if (s === "unknown") return 3;
    if (s === "failed" || s === "error") return 4;
    if (s === "cancelled") return 5;
    return 6;
  }

  function pruneAndSortQueueEntries() {
    queueEntries = queueEntries
      .sort((a, b) => {
        const rankDelta = queueSortRank(a.status) - queueSortRank(b.status);
        if (rankDelta !== 0) return rankDelta;
        const aStatus = normalizeQueueStatus(a.status);
        const bStatus = normalizeQueueStatus(b.status);
        if (aStatus === "pending" && bStatus === "pending") {
          const na = Number(a.number);
          const nb = Number(b.number);
          if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        }
        return (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0);
      })
      .slice(0, MAX_QUEUE_ITEMS);
  }

  function upsertQueueEntry(entryPatch) {
    const promptId = String(entryPatch?.prompt_id || "").trim();
    if (!promptId) return;
    const now = Date.now();
    const nextStatus = normalizeQueueStatus(entryPatch.status || "unknown");
    const isTerminal = isQueueTerminalStatus(nextStatus);
    const idx = queueEntries.findIndex((item) => item.prompt_id === promptId);
    if (idx < 0) {
      registerOwnedPrompt(promptId);
      queueEntries.push({
        prompt_id: promptId,
        status: nextStatus,
        title: String(entryPatch.title || "ComfyUI 任务"),
        mode: String(entryPatch.mode || "任务"),
        created_at: Number(entryPatch.created_at) || now,
        updated_at: Number(entryPatch.updated_at) || now,
        number: entryPatch.number ?? "",
        media_count: Number(entryPatch.media_count) || 0,
        media_preview: firstMediaPreview(entryPatch.media_preview),
        error: entryPatch.error ? String(entryPatch.error) : "",
        missing_polls: isTerminal ? 0 : Number(entryPatch.missing_polls) || 0,
      });
    } else {
      const prev = queueEntries[idx];
      const mergedStatus = normalizeQueueStatus(entryPatch.status || prev.status);
      const mergedTerminal = isQueueTerminalStatus(mergedStatus);
      queueEntries[idx] = {
        ...prev,
        ...entryPatch,
        status: mergedStatus,
        title: String(entryPatch.title || prev.title || "ComfyUI 任务"),
        mode: String(entryPatch.mode || prev.mode || "任务"),
        created_at: Number(entryPatch.created_at) || prev.created_at || now,
        updated_at: Number(entryPatch.updated_at) || now,
        media_count: Number(entryPatch.media_count ?? prev.media_count) || 0,
        media_preview:
          firstMediaPreview(entryPatch.media_preview) || firstMediaPreview(prev.media_preview) || null,
        error: entryPatch.error ? String(entryPatch.error) : String(prev.error || ""),
        missing_polls: mergedTerminal ? 0 : Number(entryPatch.missing_polls ?? prev.missing_polls) || 0,
      };
    }
    if (isTerminal) {
      cancellingQueuePromptIds.delete(promptId);
    }
    pruneAndSortQueueEntries();
    persistQueueEntries();
  }

  function removeQueueEntry(promptId) {
    const id = String(promptId || "").trim();
    cancellingQueuePromptIds.delete(id);
    queueEntries = queueEntries.filter((item) => item.prompt_id !== id);
    unregisterOwnedPrompt(id);
    persistQueueEntries();
    renderQueueList();
  }

  function buildQueueTitleFromPrompt(text) {
    const cleaned = String(text || "").trim();
    if (!cleaned) return "仅参考图任务";
    return cleaned.length > 28 ? `${cleaned.slice(0, 28)}…` : cleaned;
  }

  function getQueueEntryByPromptId(promptId) {
    return queueEntries.find((item) => item.prompt_id === promptId) || null;
  }

  function buildQueueActionMessageTaskText(promptId) {
    const entry = getQueueEntryByPromptId(promptId);
    const full = getBoundQueueLabel(promptId) || String(entry?.title || "").trim();
    if (!full) return "";
    return full.length > 48 ? `${full.slice(0, 48)}…` : full;
  }

  function getQueueDisplayTaskText(item) {
    if (!item) return "";
    const full = getBoundQueueLabel(item.prompt_id) || String(item.title || "").trim();
    if (!full) return "";
    return full.length > 56 ? `${full.slice(0, 56)}…` : full;
  }

  function firstMediaPreview(mediaValue) {
    if (Array.isArray(mediaValue) && mediaValue.length) return mediaValue[0];
    if (mediaValue && typeof mediaValue === "object") return mediaValue;
    return null;
  }

  function isVideoMediaItem(mediaItem) {
    const kind = String(mediaItem?.kind || "").toLowerCase();
    const filename = String(mediaItem?.filename || "").toLowerCase();
    return (
      kind.includes("video") ||
      kind.includes("gif") ||
      filename.endsWith(".mp4") ||
      filename.endsWith(".webm") ||
      filename.endsWith(".mov") ||
      filename.endsWith(".mkv") ||
      filename.endsWith(".avi") ||
      filename.endsWith(".gif")
    );
  }

  function queueMediaPreviewHtml(item) {
    const media = firstMediaPreview(item?.media_preview);
    if (!media) return "";
    const src = String(media.view_url || media.url || "").trim();
    if (!src) return "";
    const safeSrc = escapeHtml(src);
    const safeName = escapeHtml(String(media.filename || media.name || "preview"));
    if (isVideoMediaItem(media)) {
      return `<div class="queue-item__preview"><video class="queue-media-thumb" data-queue-media-kind="video" data-queue-media-url="${safeSrc}" src="${safeSrc}" preload="metadata" muted></video><span class="queue-media-badge">视频</span></div>`;
    }
    return `<div class="queue-item__preview"><img class="queue-media-thumb" data-queue-media-kind="image" data-queue-media-url="${safeSrc}" src="${safeSrc}" alt="${safeName}" loading="lazy" /><span class="queue-media-badge">图片</span></div>`;
  }

  function renderQueueList() {
    if (!queueList) return;
    if (!queueEntries.length) {
      queueList.innerHTML = '<p class="queue-empty">暂无任务。</p>';
      return;
    }
    queueList.innerHTML = queueEntries
      .map((item) => {
        const status = normalizeQueueStatus(item.status);
        const actionButtons = [];
        if (status === "running" || status === "pending") {
          const isCancelling = cancellingQueuePromptIds.has(String(item.prompt_id || "").trim());
          actionButtons.push(
            `<button type="button" class="queue-action-btn" data-action="cancel" data-prompt-id="${escapeHtml(item.prompt_id)}" ${isCancelling ? "disabled aria-busy=\"true\"" : ""}>${isCancelling ? "取消中" : "取消"}</button>`
          );
        }
        if (status === "pending") {
          actionButtons.push(
            `<button type="button" class="queue-action-btn" data-action="queue-up" data-prompt-id="${escapeHtml(item.prompt_id)}">上移</button>`
          );
          actionButtons.push(
            `<button type="button" class="queue-action-btn" data-action="queue-down" data-prompt-id="${escapeHtml(item.prompt_id)}">下移</button>`
          );
        }
        if (isQueueTerminalStatus(status)) {
          actionButtons.push(
            `<button type="button" class="queue-action-btn" data-action="remove" data-prompt-id="${escapeHtml(item.prompt_id)}">移除</button>`
          );
        }
        return `
          <article class="queue-item">
            <div class="queue-item__top">
              <span class="queue-item__title">${escapeHtml(item.mode || "任务")} · ${escapeHtml(item.title || "ComfyUI 任务")}</span>
              <span class="queue-status-badge" data-status="${escapeHtml(status)}">${queueStatusLabel(status)}</span>
            </div>
            <div class="queue-item__meta">
              ${getQueueDisplayTaskText(item) ? `<span class="queue-item__time">任务：${escapeHtml(getQueueDisplayTaskText(item))}</span>` : ""}
              <span class="queue-item__time">任务用时：${escapeHtml(getQueueTaskDurationText(item))}</span>
            </div>
            ${queueMediaPreviewHtml(item)}
            <div class="queue-item__actions">${actionButtons.join("")}</div>
          </article>
        `;
      })
      .join("");
  }

  function extractPromptIdFromQueueRow(row) {
    if (Array.isArray(row) && row.length > 1) {
      return String(row[1] || "").trim();
    }
    if (row && typeof row === "object") {
      return String(row.prompt_id || row.id || "").trim();
    }
    return "";
  }

  function extractClientIdFromQueueRow(row) {
    if (!Array.isArray(row) || row.length < 4) return "";
    const extra = row[3];
    if (!extra || typeof extra !== "object") return "";
    return String(extra.client_id || "").trim();
  }

  function isOwnQueueRow(row) {
    const clientId = extractClientIdFromQueueRow(row);
    if (clientId) return clientId === getStudioClientId();
    const promptId = extractPromptIdFromQueueRow(row);
    return isOwnedPromptId(promptId);
  }

  function pruneQueueEntriesToOwned() {
    queueEntries = queueEntries.filter((item) => isOwnedPromptId(item.prompt_id));
  }

  function extractQueueTextFromQueueRow(row) {
    if (!Array.isArray(row) || row.length < 4) return "";
    const extra = row[3];
    if (!extra || typeof extra !== "object") return "";
    const inputs = extra.rh_portal_inputs;
    if (!inputs || typeof inputs !== "object") return "";
    const candidates = [
      inputs.prompt,
      inputs.text,
      inputs.positive,
      inputs.positive_prompt,
      inputs.negative_prompt,
    ];
    for (const value of candidates) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  }

  function jobSourceLabel(source) {
    const value = String(source || "").trim().toLowerCase();
    if (value === "studio") return "创作工坊";
    if (value === "portal") return "应用";
    if (value === "canvas") return "画布";
    return "任务";
  }

  function applyServerJobs(jobs) {
    const nextEntries = [];
    for (const job of jobs) {
      if (!job || typeof job !== "object") continue;
      const promptId = String(job.prompt_id || job.id || "").trim();
      if (!promptId) continue;
      registerOwnedPrompt(promptId);
      const boundLabel = getBoundQueueLabel(promptId);
      const serverTitle = String(job.title || "").trim();
      if (serverTitle && !boundLabel) bindQueueLabel(promptId, serverTitle);
      const label = boundLabel || serverTitle;
      nextEntries.push({
        prompt_id: promptId,
        status: normalizeQueueStatus(job.status || "unknown"),
        title: label ? buildQueueTitleFromPrompt(label) : "ComfyUI 任务",
        mode: jobSourceLabel(job.source),
        source: String(job.source || ""),
        created_at: Number(job.create_time) || Date.now(),
        updated_at: Number(job.updated_at) || Number(job.execution_end_time) || Number(job.create_time) || Date.now(),
        number: job.number ?? "",
        execution_start_time: Number(job.execution_start_time) || 0,
        execution_end_time: Number(job.execution_end_time) || 0,
        media_count: Number(job.media_count) || (Array.isArray(job.media) ? job.media.length : 0),
        media_preview: Array.isArray(job.media) ? job.media : [],
        error: "",
        missing_polls: 0,
      });
    }
    queueEntries = nextEntries;
    persistQueueEntries();
    renderQueueList();
  }

  async function refreshQueueFromServer() {
    if (!queueList || queueRefreshInFlight) return;
    if (studioMultiUserEnabled && !isStudioUserAuthed()) return;
    queueRefreshInFlight = true;
    try {
      // skipAuthRecovery: true — 后台轮询遇到 401 (session 过期) 时只静默失败，
      // 不调用 handleStudioSessionExpired，避免每 3 秒弹一次登录框。
      // 真正的 session 失效提示应在用户主动发起操作时触发。
      const data = await requestJson("/rh/api/jobs?limit=50&max_items=120", { skipAuthRecovery: true });
      applyServerJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch {
      // Ignore queue refresh errors to avoid spamming user.
    } finally {
      queueRefreshInFlight = false;
    }
  }

  function isPromptRunningInQueue(promptId) {
    return queueEntries.some(
      (item) => item.prompt_id === promptId && normalizeQueueStatus(item.status) === "running"
    );
  }

  async function postInterruptRequest(body) {
    const payload = body && typeof body === "object" ? body : {};
    const endpoints = ["/interrupt", "/api/interrupt"];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        await requestJson(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("取消请求失败");
  }

  async function interruptQueueTask(promptId) {
    // 先做定向中断，命中时不会影响其他任务。
    await postInterruptRequest({ prompt_id: promptId });
    markPromptCancelled(promptId);
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    await refreshQueueFromServer();

    // 某些时机会被后端判定为「当前不在 running」，追加一次全局中断兜底。
    if (isPromptRunningInQueue(promptId)) {
      await postInterruptRequest({});
      markPromptCancelled(promptId);
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      await refreshQueueFromServer();
    }

    // 若仍可见 running，提示失败；否则标记为取消中（等待后端最终状态）。
    if (isPromptRunningInQueue(promptId)) {
      throw new Error("任务仍在执行，后端未响应取消。请再点一次取消或检查 ComfyUI 主界面。");
    }
    upsertQueueEntry({
      prompt_id: promptId,
      status: "cancelled",
      updated_at: Date.now(),
    });
    renderQueueList();
  }

  async function cancelPendingQueueTask(promptId) {
    await requestJson("/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: [promptId] }),
    });
    upsertQueueEntry({
      prompt_id: promptId,
      status: "cancelled",
      updated_at: Date.now(),
    });
    renderQueueList();
    void refreshQueueFromServer();
  }

  async function reorderPendingQueueTask(promptId, direction) {
    const dir = direction === "down" ? "down" : "up";
    const response = await fetch("/rh/api/studio/queue/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId, direction: dir }),
    });
    if (!response.ok) {
      if (response.status === 405) {
        throw new Error("当前服务还未加载队列重排接口，请重启 ComfyUI 后再试。");
      }
      if (response.status === 404) {
        throw new Error("该任务已不在排队中（可能已开始执行），无法调整顺序。");
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    await refreshQueueFromServer();
  }

  async function postToAnyEndpoint(endpoints, body) {
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        await requestJson(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return true;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return false;
  }

  async function removeQueueTaskFromBackend(promptId) {
    const result = await requestJson("/rh/api/studio/task/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId }),
    });

    if (result?.is_running) {
      throw new Error("任务仍在执行，请先取消后再移除。");
    }
    if (!result?.removed_any) {
      // 幂等删除：后端找不到时，视为“已被清理”，前端直接移除卡片即可。
      removeQueueEntry(promptId);
      return;
    }
    if (queueLabelMap[promptId]) {
      delete queueLabelMap[promptId];
      persistQueueLabelMap();
    }
    removeQueueEntry(promptId);
    await refreshQueueFromServer();
  }

  function normalizeSelectOptions(param) {
    const options = Array.isArray(param.options) ? param.options : [];
    return options
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return { value: String(item), label: String(item) };
        }
        if (item && typeof item === "object") {
          const value = item.value ?? item.id ?? item.key;
          const label = item.label ?? item.name ?? value;
          if (value === undefined || value === null) return null;
          return { value: String(value), label: String(label ?? value) };
        }
        return null;
      })
      .filter(Boolean);
  }

  const CHIP_OPTIONS_MIN = 2;
  const CHIP_OPTIONS_MAX = 12;

  function appendHint(parent, description) {
    if (!description) return;
    const p = document.createElement("p");
    p.className = "params-pop-hint";
    p.textContent = String(description);
    parent.appendChild(p);
  }

  function renderSelectSection(param, key, options, defaultValue) {
    const wrapper = document.createElement("div");
    wrapper.className = "params-pop-section";

    const titleEl = document.createElement("div");
    titleEl.className = "params-pop-section__title";
    titleEl.textContent = String(param.label || key);
    wrapper.appendChild(titleEl);

    const select = document.createElement("select");
    select.setAttribute("data-dyn-param", key);
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (String(defaultValue) === opt.value) o.selected = true;
      select.appendChild(o);
    }

    const useChips = options.length >= CHIP_OPTIONS_MIN && options.length <= CHIP_OPTIONS_MAX;

    if (useChips) {
      select.className = "params-pop-select-native";
      select.setAttribute("aria-hidden", "true");
      select.tabIndex = -1;

      const scroll = document.createElement("div");
      scroll.className = options.length === 2 ? "params-pop-pair" : "params-pop-chip-scroll";
      const chipHost =
        options.length === 2
          ? scroll
          : (() => {
              const inner = document.createElement("div");
              inner.className = "params-pop-chip-row";
              scroll.appendChild(inner);
              return inner;
            })();

      function syncChips() {
        const v = select.value;
        chipHost.querySelectorAll(".params-pop-chip").forEach((btn) => {
          btn.classList.toggle("is-selected", btn.getAttribute("data-value") === v);
        });
      }

      for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "params-pop-chip";
        btn.setAttribute("data-value", opt.value);
        btn.textContent = opt.label;
        if (String(defaultValue) === opt.value) btn.classList.add("is-selected");
        btn.addEventListener("click", () => {
          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncChips();
        });
        chipHost.appendChild(btn);
      }
      wrapper.appendChild(scroll);
      wrapper.appendChild(select);
    } else {
      select.className = "params-pop-select";
      wrapper.appendChild(select);
    }

    appendHint(wrapper, param.description);
    dynamicParams.appendChild(wrapper);
  }

  function renderDynamicParams(params) {
    updateParamsToolbarVisibility(params);
    dynamicParams.innerHTML = "";
    const list = getVisibleDynamicParams(params);
    if (!list.length) {
      dynamicParams.innerHTML =
        '<div class="params-pop-empty">当前模板未暴露可调参数，或仅有提示词节点（提示词请用上方输入框）。</div>';
      refreshParamsSummary();
      return;
    }

    for (const param of list) {
      if (!param || typeof param !== "object" || !param.key) continue;
      const key = String(param.key);
      const type = String(param.type || "text");
      const defaultValue = param.default ?? "";

      if (type === "select") {
        const options = normalizeSelectOptions(param);
        if (options.length) {
          renderSelectSection(param, key, options, defaultValue);
        } else {
          const wrapper = document.createElement("div");
          wrapper.className = "params-pop-section";
          const titleEl = document.createElement("div");
          titleEl.className = "params-pop-section__title";
          titleEl.textContent = String(param.label || key);
          const input = document.createElement("input");
          input.className = "params-pop-input";
          input.type = "text";
          input.setAttribute("data-dyn-param", key);
          input.value = defaultValue != null ? String(defaultValue) : "";
          wrapper.appendChild(titleEl);
          wrapper.appendChild(input);
          appendHint(wrapper, param.description);
          dynamicParams.appendChild(wrapper);
        }
        continue;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "params-pop-section";

      const titleEl = document.createElement("div");
      titleEl.className = "params-pop-section__title";
      titleEl.textContent = String(param.label || key);

      if (type === "number") {
        wrapper.appendChild(titleEl);
        const input = document.createElement("input");
        input.className = "params-pop-input";
        input.type = "number";
        input.setAttribute("data-dyn-param", key);
        input.value = defaultValue != null ? String(defaultValue) : "";
        if (Number.isFinite(Number(param.min))) input.min = String(param.min);
        if (Number.isFinite(Number(param.max))) input.max = String(param.max);
        if (Number.isFinite(Number(param.step))) input.step = String(param.step);
        else input.step = "any";
        wrapper.appendChild(input);
      } else if (type === "toggle") {
        const row = document.createElement("div");
        row.className = "params-pop-section__switch-row";
        const lab = document.createElement("label");
        lab.className = "params-pop-switch";
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.setAttribute("data-dyn-param", key);
        if (defaultValue) inp.checked = true;
        const track = document.createElement("span");
        track.className = "params-pop-switch__track";
        const thumb = document.createElement("span");
        thumb.className = "params-pop-switch__thumb";
        track.appendChild(thumb);
        lab.appendChild(inp);
        lab.appendChild(track);
        row.appendChild(titleEl);
        row.appendChild(lab);
        wrapper.appendChild(row);
      } else if (type === "textarea") {
        wrapper.appendChild(titleEl);
        const ta = document.createElement("textarea");
        ta.className = "params-pop-textarea";
        ta.setAttribute("data-dyn-param", key);
        ta.textContent = defaultValue != null ? String(defaultValue) : "";
        wrapper.appendChild(ta);
      } else {
        wrapper.appendChild(titleEl);
        const input = document.createElement("input");
        input.className = "params-pop-input";
        input.type = "text";
        input.setAttribute("data-dyn-param", key);
        input.value = defaultValue != null ? String(defaultValue) : "";
        wrapper.appendChild(input);
      }

      appendHint(wrapper, param.description);
      dynamicParams.appendChild(wrapper);
    }
    refreshParamsSummary();
  }

  function getDynamicParamsFromForm() {
    const result = {};
    const defs = Array.isArray(currentAppDetail?.params) ? currentAppDetail.params : [];
    const byKey = {};
    for (const p of defs) {
      if (p && typeof p === "object" && p.key) byKey[String(p.key)] = p;
    }

    const nodes = dynamicParams.querySelectorAll("[data-dyn-param]");
    for (const el of nodes) {
      const key = el.getAttribute("data-dyn-param");
      if (!key) continue;
      const def = byKey[key] || {};
      const type = String(def.type || "text");
      let value;
      if (type === "toggle" && el instanceof HTMLInputElement) {
        value = el.checked;
      } else if (type === "number" && el instanceof HTMLInputElement) {
        const num = Number(el.value);
        value = Number.isFinite(num) ? num : 0;
      } else {
        value = el.value;
      }
      result[key] = value;
    }
    return result;
  }

  function getParams() {
    const d = getDynamicParamsFromForm();
    const pickNum = (keys, fb) => {
      for (const k of keys) {
        if (d[k] === undefined || d[k] === null || d[k] === "") continue;
        const n = Number(d[k]);
        if (Number.isFinite(n)) return n;
      }
      return fb;
    };
    const pickStr = (keys) => {
      for (const k of keys) {
        if (typeof d[k] === "string") return d[k].trim();
      }
      return "";
    };
    return {
      width: pickNum(["width"], 1024),
      height: pickNum(["height"], 1024),
      steps: pickNum(["steps"], 20),
      durationSec: pickNum(["duration_sec", "duration"], 5),
      fps: pickNum(["fps"], 24),
      seed: pickNum(["seed"], -1),
      negative: pickStr(["negative_prompt", "negative"]),
    };
  }

  function updateModeUI() {
    const needRef = needsReferenceMode();
    if (composerRefRow) {
      composerRefRow.hidden = !needRef;
    }
    if (!needRef) {
      clearReferenceImages();
      if (composerRefHint) composerRefHint.hidden = true;
    } else {
      if (currentAppDetail && workflowApp?.value) {
        renderDynamicParams(currentAppDetail.params || []);
        trimReferenceToCap();
      }
      updateReferenceHint();
    }

    const placeholders = {
      t2i: "描述画面内容，例如：赛博朋克风格的傍晚街道……",
      t2v: "描述镜头与画面，例如：无人机掠过海面，金色落日……",
      i2i: "结合参考图，说明要如何修改或风格化（也可只描述细微调整）……",
      i2v: "结合参考图，描述动态与镜头，例如：镜头缓慢推进……",
    };
    if (promptEl) {
      promptEl.placeholder = placeholders[generationMode] || placeholders.t2i;
    }
    refreshParamsSummary();
  }

  function appendUserMessage(text, metaLines, options = {}) {
    const targetConversationId = String(options?.conversationId || currentConversationId || "").trim();
    const shouldRenderInCurrentChat = !targetConversationId || targetConversationId === currentConversationId;

    if (shouldRenderInCurrentChat) {
      if (placeholder) placeholder.remove();
      chat.classList.remove("chat--empty");

      const div = document.createElement("div");
      div.className = "msg msg--user";
      div.textContent = text;
      chat.appendChild(div);

      if (metaLines && metaLines.length) {
        const meta = document.createElement("div");
        meta.className = "msg msg--meta";
        meta.textContent = metaLines.join(" · ");
        chat.appendChild(meta);
      }
    }
    const referenceMedia = Array.isArray(options.referenceMedia) ? options.referenceMedia : [];
    if (shouldRenderInCurrentChat && referenceMedia.length) {
      const quoteWrap = document.createElement("div");
      quoteWrap.className = "msg-user-quote";
      referenceMedia.forEach((m, idx) => {
        const src = String(m?.url || "").trim();
        if (!src) return;
        const name = String(m?.name || `参考图 ${idx + 1}`);
        const quote = document.createElement("button");
        quote.type = "button";
        quote.className = "msg-user-quote-card";
        quote.setAttribute("data-user-ref-url", src);
        quote.setAttribute("data-user-ref-name", name);
        quote.innerHTML = `
          <img class="msg-user-quote-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" />
          <span class="msg-user-quote-text">
            <span class="msg-user-quote-label">引用图片</span>
            <span class="msg-user-quote-name">${escapeHtml(name)}</span>
          </span>
        `;
        quoteWrap.appendChild(quote);
      });
      if (quoteWrap.childElementCount > 0) {
        chat.appendChild(quoteWrap);
      }
    }
    pushChatHistoryEntry({
      ts: Date.now(),
      role: "user",
      text: String(text || ""),
      meta: Array.isArray(metaLines) ? metaLines.map((x) => String(x)) : [],
      reference_media: referenceMedia.map((m, idx) => ({
        url: String(m?.url || "").trim(),
        name: String(m?.name || `参考图 ${idx + 1}`),
      })).filter((m) => m.url),
    }, { conversationId: targetConversationId });
    if (shouldRenderInCurrentChat) chat.scrollTop = chat.scrollHeight;
  }

  function appendSystemMessage(html, options = {}) {
    const targetConversationId = String(options?.conversationId || currentConversationId || "").trim();
    const messageKey = String(options?.messageKey || "").trim();
    const shouldRenderInCurrentChat = !targetConversationId || targetConversationId === currentConversationId;
    if (shouldRenderInCurrentChat) {
      const div = document.createElement("div");
      div.className = "msg msg--system";
      div.innerHTML = html;
      chat.appendChild(div);
    }
    const plainText = systemHtmlToPlainText(html);
    pushChatHistoryEntry({
      ts: Date.now(),
      role: "system",
      text: plainText,
      plain: plainText,
      media: extractMediaFromMessageHtml(html),
      message_key: messageKey || undefined,
    }, { conversationId: targetConversationId });
    if (shouldRenderInCurrentChat) chat.scrollTop = chat.scrollHeight;
  }

  function mediaPreviewHtml(mediaItem, index) {
    const kind = String(mediaItem?.kind || "").toLowerCase();
    const filename = String(mediaItem?.filename || "");
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const viewUrl = String(mediaItem?.view_url || "");
    const downloadUrl = String(mediaItem?.download_url || "");
    const isVideo = kind.includes("video") || kind.includes("gif") || ["mp4", "webm", "mov", "mkv", "avi", "gif"].includes(ext);
    const safeName = escapeHtml(filename || `result-${index + 1}`);

    const mediaTag = isVideo
      ? `<video class="result-media" src="${viewUrl}" controls preload="metadata"></video>`
      : `<img class="result-media" src="${viewUrl}" alt="${safeName}" loading="lazy" />`;
    const refBtn = !isVideo && viewUrl
      ? `<button type="button" class="result-use-ref" data-set-reference-url="${escapeHtml(viewUrl)}" data-set-reference-name="${safeName}">设为参考图</button>`
      : "";

    return `
      <div class="result-card">
        <div class="result-media-wrap">${mediaTag}</div>
        <div class="result-meta">
          <span class="result-name">${safeName}</span>
          <div class="result-meta-actions">
            ${refBtn}
            <a class="result-download" href="${downloadUrl}" download>下载</a>
          </div>
        </div>
      </div>
    `;
  }

  function fileNameFromUrl(url, fallbackBase = "reference") {
    try {
      const u = new URL(url, window.location.origin);
      const base = u.pathname.split("/").pop() || "";
      if (base && base.includes(".")) return base;
    } catch {
      // Ignore parse failure and fallback.
    }
    return `${fallbackBase}-${Date.now()}.png`;
  }

  async function addReferenceImageFromResult(url, preferredName = "", preferredMode = "") {
    if (!url) throw new Error("缺少图片地址");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`图片读取失败 HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const mime = String(blob.type || "").toLowerCase();
    if (!mime.startsWith("image/")) {
      throw new Error("仅图片支持设为参考图");
    }

    const name = preferredName && preferredName.includes(".")
      ? preferredName
      : fileNameFromUrl(url, preferredName || "reference");
    const file = new File([blob], name, { type: blob.type || "image/png" });

    const targetMode =
      preferredMode === "i2i" || preferredMode === "i2v"
        ? preferredMode
        : generationMode === "i2v"
          ? "i2v"
          : "i2i";
    if (generationMode !== targetMode) {
      generationMode = targetMode;
      if (modeSelect) {
        modeSelect.value = targetMode;
        modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        updateModeUI();
      }
    }

    const cap = getReferenceImageCap();
    if (referenceItems.length >= cap) {
      throw new Error(`参考图已达上限（${cap} 张）`);
    }

    referenceItemSeq += 1;
    const id = `ref-${referenceItemSeq}`;
    const objectUrl = URL.createObjectURL(file);
    referenceItems.push({ id, file, objectUrl });
    renderReferencePreview();
    promptEl.focus();
  }

  function buildPayload() {
    const text = (promptEl.value || "").trim();
    const modeLabel = modeLabelFromValue(generationMode);
    return {
      mode: generationMode,
      modeLabel,
      provider: "comfy",
      prompt: text,
      params: getParams(),
      hasReferenceImage: Boolean(referenceItems.length && needsReferenceMode()),
      referenceFileNames: referenceItems.map((it) => it.file.name),
    };
  }

  /**
   * 流程模板是否出现在当前「创作类型」下：
   * - 必须在 Portal 勾选创作工坊分类（manifest.studio_modes）后才会展示。
   * - 未填写或为空时，一律视为“不发布到创作工坊”。
   */
  function appMatchesCurrentMode(app) {
    if (!app || typeof app !== "object") return false;
    const modes = app.studio_modes;
    if (!Array.isArray(modes) || modes.length === 0) {
      return false;
    }
    return modes.includes(generationMode);
  }

  function populateWorkflowAppSelect() {
    const apps = workflowAppsCache.filter(appMatchesCurrentMode);
    const previous = workflowApp.value;
    workflowApp.innerHTML = "";
    if (!apps.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent =
        "当前创作类型下无模板：请在 Portal 发布时勾选「发布到创作工坊」并选择分类。";
      workflowApp.appendChild(opt);
      prettySelectStore.get(workflowApp)?.refresh?.();
      loadWorkflowDetail("");
      return;
    }
    for (const app of apps) {
      const opt = document.createElement("option");
      opt.value = app.id || "";
      opt.textContent = `${app.name || app.id}`;
      workflowApp.appendChild(opt);
    }
    const still = apps.some((a) => a.id === previous);
    if (still && previous) {
      workflowApp.value = previous;
    }
    prettySelectStore.get(workflowApp)?.refresh?.();
    loadWorkflowDetail(workflowApp.value);
  }

  async function loadWorkflowApps() {
    try {
      const data = await requestJson("/rh/api/apps");
      const apps = Array.isArray(data.apps) ? data.apps : [];
      workflowAppsCache = apps;
      populateWorkflowAppSelect();
    } catch (error) {
      workflowAppsCache = [];
      workflowApp.innerHTML = `<option value="">加载模板失败：${error.message}</option>`;
      prettySelectStore.get(workflowApp)?.refresh?.();
      renderDynamicParams([]);
      updateReferenceHint();
    }
  }

  async function loadWorkflowDetail(appId) {
    if (!appId) {
      currentAppDetail = null;
      renderDynamicParams([]);
      updateReferenceHint();
      return;
    }
    try {
      const detail = await requestJson(`/rh/api/apps/${encodeURIComponent(appId)}`);
      currentAppDetail = detail;
      renderDynamicParams(detail.params || []);
      trimReferenceToCap();
      updateReferenceHint();
    } catch (error) {
      currentAppDetail = null;
      renderDynamicParams([]);
      updateReferenceHint();
      appendSystemMessage(`<strong>加载模板参数失败</strong><br />${error.message}`);
    }
  }

  function buildComfyParams(promptText, uploadedImageNames) {
    const p = getParams();
    const dynamic = getDynamicParamsFromForm();
    const o = {
      prompt: promptText,
      text: promptText,
      positive: promptText,
      positive_prompt: promptText,
      negative: p.negative,
      negative_prompt: p.negative,
      width: p.width,
      height: p.height,
      steps: p.steps,
      seed: p.seed,
      duration: p.durationSec,
      duration_sec: p.durationSec,
      fps: p.fps,
      mode: generationMode,
      ...dynamic,
    };
    const names = Array.isArray(uploadedImageNames)
      ? uploadedImageNames
      : uploadedImageNames
        ? [uploadedImageNames]
        : [];
    if (names.length) {
      const { keys: imageKeys } = getImageParamMeta();
      if (imageKeys.length > 0) {
        imageKeys.forEach((key, i) => {
          if (names[i]) o[key] = names[i];
        });
      }
      const first = names[0];
      o.image = first;
      o.uploaded_image = first;
      o.reference_image = first;
      o.load_image = first;
      o.input_image = first;
      o.reference_images = names;
      for (let i = 1; i < names.length; i += 1) {
        const n = i + 1;
        o[`image_${n}`] = names[i];
        o[`reference_image_${n}`] = names[i];
        o[`load_image_${n}`] = names[i];
        o[`input_image_${n}`] = names[i];
      }
    }
    return o;
  }

  async function onSend() {
    const text = (promptEl.value || "").trim();
    const needRef = needsReferenceMode();
    if (!text && !(needRef && referenceItems.length)) {
      appendSystemMessage("<strong>请输入描述</strong>或（图生图/图生视频下）<strong>上传参考图</strong>。");
      promptEl.focus();
      return;
    }
    const imageKeys = getImageParamMeta().keys;
    if (needRef) {
      if (imageKeys.length > 0) {
        if (referenceItems.length !== imageKeys.length) {
          appendSystemMessage(
            `<strong>参考图数量与模板不一致</strong><br />当前模板暴露了 <strong>${imageKeys.length}</strong> 个图片类参数，请上传 <strong>${imageKeys.length}</strong> 张参考图（当前 ${referenceItems.length} 张）。`
          );
          return;
        }
      } else if (!referenceItems.length) {
        appendSystemMessage("<strong>请先上传参考图</strong><br />图生图 / 图生视频至少需要一张参考图片。");
        return;
      }
    }
    if (!workflowApp.value) {
      appendSystemMessage("<strong>缺少流程模板</strong><br />请先在 Portal 发布至少一个 app（`creative-studio-ui/data/apps/*.json`）。");
      return;
    }

    const p = buildPayload();
    const meta = [p.modeLabel, `${p.params.width}×${p.params.height}`];
    if (isVideoMode()) meta.push(`${p.params.durationSec}s @ ${p.params.fps}fps`);
    else meta.push(`${p.params.steps} steps`);
    if (p.hasReferenceImage) {
      const n = p.referenceFileNames?.length || 0;
      meta.push(n > 1 ? `含 ${n} 张参考图` : "含参考图");
    }

    const displayText = text || "（仅参考图）";
    const runConversationId = currentConversationId || createConversationId();
    if (!currentConversationId) {
      currentConversationId = runConversationId;
      renderConversationList();
      renderChatForConversation(runConversationId);
    }
    const loadingMessageKey = `run-loading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const appendRunSystemMessage = (html, extraOptions = {}) =>
      appendSystemMessage(html, { conversationId: runConversationId, ...extraOptions });
    const upsertRunStatusMessage = (html) => {
      const replaced = replaceConversationSystemMessageByKey(runConversationId, loadingMessageKey, html);
      if (!replaced) {
        appendRunSystemMessage(html, { messageKey: loadingMessageKey });
      }
    };
    // 为聊天引用卡片创建独立 URL，避免发送成功后清空参考图区时图片失效。
    const userReferenceMedia = needRef
      ? referenceItems.map((it) => ({ url: URL.createObjectURL(it.file), name: it.file?.name || "参考图" }))
      : [];

    btnSend.disabled = true;
    const runController = new AbortController();
    activeRunController = runController;
    activeRunPromptId = "";

    /** @type {string[]} */
    let uploadedNames = [];
    let queuePromptId = "";
    try {
      appendUserMessage(displayText, meta, { referenceMedia: userReferenceMedia, conversationId: runConversationId });
      // 聊天式体验：成功发起任务后立即清空输入框。
      promptEl.value = "";
      appendRunSystemMessage(
        `<strong>正在生成中...</strong>`,
        { messageKey: loadingMessageKey }
      );

      if (needRef && referenceItems.length) {
        uploadedNames = await Promise.all(referenceItems.map((it) => uploadImageToComfy(it.file)));
      }

      const runResult = await requestJson("/rh/api/studio/run-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: runController.signal,
        body: JSON.stringify({
          app_id: workflowApp.value,
          prompt: text,
          negative_prompt: p.params.negative,
          params: buildComfyParams(text, uploadedNames),
          client_id: getStudioClientId(),
          user_id: studioUserId,
          source: "studio",
          conversation_id: runConversationId,
          title: displayText,
          wait: true,
          timeout_sec: 600,
        }),
      });
      // 任务提交成功后，清空本次参考图，避免下一次误带。
      if (needRef && referenceItems.length) {
        clearReferenceImages();
      }

      let effectiveResult = runResult;
      let media = Array.isArray(runResult.media) ? runResult.media : [];
      const promptId = runResult.prompt_id || "";
      queuePromptId = promptId;
      activeRunPromptId = promptId || activeRunPromptId;
      if (promptId) {
        bindQueueLabel(promptId, displayText);
        upsertQueueEntry({
          prompt_id: promptId,
          status: runResult.completed ? runResult.status || "completed" : "running",
          number: runResult.number ?? "",
          mode: p.modeLabel,
          title: buildQueueTitleFromPrompt(displayText),
          media_count: media.length,
          media_preview: media,
          updated_at: Date.now(),
          created_at: Date.now(),
        });
        renderQueueList();
      }

      // Long-running tasks may return timeout first; keep polling by prompt_id.
      if (promptId && (runResult.status === "timeout" || (!runResult.completed && !media.length))) {
        upsertQueueEntry({ prompt_id: promptId, status: "running", updated_at: Date.now() });
        upsertRunStatusMessage(
          `<strong>任务仍在执行中</strong><br />正在继续拉取结果...`
        );
        const polled = await waitForPromptResult(promptId, {
          timeoutMs: 30 * 60 * 1000,
          intervalMs: 3000,
        });
        effectiveResult = polled.result || runResult;
        media = polled.media;
      } else if (promptId && !media.length && runResult.completed) {
        // Give the history writer a short grace period in case outputs land slightly later.
        const polled = await waitForPromptResult(promptId, { timeoutMs: 20000, intervalMs: 2000 });
        effectiveResult = polled.result || runResult;
        media = polled.media;
      }

      if (!media.length) {
        if (!effectiveResult?.completed || effectiveResult?.status === "timeout") {
          if (promptId) upsertQueueEntry({ prompt_id: promptId, status: "running", updated_at: Date.now() });
          upsertRunStatusMessage(
            `<strong>任务仍在后台执行</strong><br />可在右侧任务队列查看进度。`
          );
        } else {
          if (promptId) {
            upsertQueueEntry({
              prompt_id: promptId,
              status: normalizeQueueStatus(effectiveResult?.status || "completed"),
              media_count: 0,
              media_preview: [],
              updated_at: Date.now(),
            });
          }
          upsertRunStatusMessage(
            `<strong>执行完成，但未发现可下载媒体</strong><br />请确认模板里有 SaveImage/视频保存节点。`
          );
        }
      } else {
        if (promptId) {
          upsertQueueEntry({
            prompt_id: promptId,
            status: normalizeQueueStatus(effectiveResult?.status || "completed"),
            media_count: media.length,
            media_preview: media,
            updated_at: Date.now(),
          });
        }
        const previews = media
          .map((m, idx) => mediaPreviewHtml(m, idx))
          .join("");
        upsertRunStatusMessage(
          `<strong>生成完成</strong><div class="result-grid">${previews}</div>`
        );
      }
    } catch (error) {
      const isAbort = error?.name === "AbortError" || (queuePromptId && cancelledPromptIds.has(queuePromptId));
      if (isAbort) {
        if (queuePromptId) {
          upsertQueueEntry({
            prompt_id: queuePromptId,
            status: "cancelled",
            updated_at: Date.now(),
          });
          renderQueueList();
        }
        upsertRunStatusMessage(
          `<strong>任务已取消</strong><br />已停止等待结果，可继续提交新任务。`
        );
        return;
      }
      if (queuePromptId) {
        upsertQueueEntry({
          prompt_id: queuePromptId,
          status: "failed",
          error: error?.message || "unknown error",
          updated_at: Date.now(),
        });
        renderQueueList();
      }
      try {
        upsertRunStatusMessage(`<strong>生成失败</strong><br />${error.message}`);
      } catch (nestedError) {
        console.warn("appendSystemMessage failed:", nestedError);
        window.alert(`生成失败：${error?.message || "未知错误"}`);
      }
    } finally {
      releaseSendLockIfActive(queuePromptId);
      if (activeRunPromptId === queuePromptId) {
        activeRunPromptId = "";
        activeRunController = null;
      }
      void refreshQueueFromServer();
    }
  }

  modeSelect.addEventListener("change", () => {
    generationMode = /** @type {any} */ (modeSelect.value);
    updateModeUI();
    populateWorkflowAppSelect();
  });

  btnRefAdd.addEventListener("click", () => fileInput.click());
  if (btnParamsTrigger) {
    btnParamsTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleParamsPopover();
    });
  }
  if (composerParamsBody) {
    composerParamsBody.addEventListener("click", (e) => e.stopPropagation());
    composerParamsBody.addEventListener("input", refreshParamsSummary);
    composerParamsBody.addEventListener("change", refreshParamsSummary);
  }
  workflowApp.addEventListener("change", () => {
    loadWorkflowDetail(workflowApp.value);
  });
  fileInput.addEventListener("change", () => {
    const list = fileInput.files;
    if (!list || !list.length) {
      fileInput.value = "";
      return;
    }
    const cap = getReferenceImageCap();
    let room = cap - referenceItems.length;
    for (let i = 0; i < list.length && room > 0; i += 1) {
      const f = list[i];
      if (!f || !f.type.startsWith("image/")) continue;
      referenceItemSeq += 1;
      const id = `ref-${referenceItemSeq}`;
      const objectUrl = URL.createObjectURL(f);
      referenceItems.push({ id, file: f, objectUrl });
      room -= 1;
    }
    fileInput.value = "";
    renderReferencePreview();
  });

  if (btnChatHistory) {
    btnChatHistory.addEventListener("click", () => {
      openChatHistoryModal();
    });
  }
  if (btnCloseChatHistory) {
    btnCloseChatHistory.addEventListener("click", () => {
      closeChatHistoryModal();
    });
  }
  if (chatHistoryBackdrop) {
    chatHistoryBackdrop.addEventListener("click", () => {
      closeChatHistoryModal();
    });
  }
  if (chatHistoryDate) {
    chatHistoryDate.addEventListener("change", () => {
      renderChatHistoryByDate(chatHistoryDate.value);
    });
  }
  if (chatHistoryList) {
    chatHistoryList.addEventListener("click", async (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const downloadBtn = target.closest("[data-download-url]");
      if (downloadBtn instanceof HTMLElement) {
        e.preventDefault();
        await tryDownloadHistoryMedia(downloadBtn.getAttribute("data-download-url") || "");
        return;
      }
      const downloadLink = target.closest(".chat-history-media-download");
      if (downloadLink instanceof HTMLAnchorElement) {
        e.preventDefault();
        await tryDownloadHistoryMedia(downloadLink.getAttribute("href") || "");
        return;
      }
      const media = target.closest(".chat-history-media-item");
      if (media) {
        const kind = media.getAttribute("data-media-kind");
        const src = media.getAttribute("data-media-url") || "";
        if (kind === "video") {
          openVideoPreview(src);
        } else {
          const alt = media instanceof HTMLImageElement ? media.alt : "";
          openImagePreview(src, alt);
        }
        return;
      }
      const btn = target.closest("[data-history-recall]");
      if (!btn) return;
      const raw = btn.getAttribute("data-history-recall");
      const idx = raw == null ? NaN : Number(raw);
      if (!Number.isInteger(idx)) return;
      recallHistoryToPrompt(idx);
    });
  }
  if (btnDeleteChatHistoryDate) {
    btnDeleteChatHistoryDate.addEventListener("click", () => {
      const dateKey = getSelectedHistoryDate();
      const ok = window.confirm(
        `确认删除 ${dateKey} 的聊天记录吗？\n历史记录删除后无法恢复，请提前下载重要图片/视频文件。`
      );
      if (!ok) return;
      deleteHistoryByDate(dateKey);
    });
  }
  if (btnClearAllChatHistory) {
    btnClearAllChatHistory.addEventListener("click", () => {
      const ok = window.confirm(
        "确认清空全部历史聊天记录吗？\n清空后无法恢复，请提前下载重要图片/视频文件。"
      );
      if (!ok) return;
      clearAllHistory();
    });
  }
  if (btnQueueRefresh) {
    btnQueueRefresh.addEventListener("click", () => {
      void refreshQueueFromServer();
    });
  }
  if (btnQueueToggle) {
    btnQueueToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const collapsed = queuePanel?.classList.contains("is-collapsed");
      setQueueCollapsedState(!collapsed, { persist: true });
    });
  }
  if (queueList) {
    queueList.addEventListener("click", async (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const preview = target.closest("[data-queue-media-kind][data-queue-media-url]");
      if (preview instanceof HTMLElement) {
        const kind = String(preview.getAttribute("data-queue-media-kind") || "");
        const src = String(preview.getAttribute("data-queue-media-url") || "");
        if (src) {
          if (kind === "video") openVideoPreview(src);
          else openImagePreview(src, "任务产出预览");
        }
        return;
      }
      const btn = target.closest("[data-action][data-prompt-id]");
      if (!(btn instanceof HTMLElement)) return;
      const action = String(btn.getAttribute("data-action") || "");
      const promptId = String(btn.getAttribute("data-prompt-id") || "").trim();
      if (!promptId) return;
      try {
        if (action === "cancel") {
          cancellingQueuePromptIds.add(promptId);
          renderQueueList();
          const status = normalizeQueueStatus(
            queueEntries.find((item) => item.prompt_id === promptId)?.status || ""
          );
          if (status === "running") {
            await interruptQueueTask(promptId);
          } else {
            await cancelPendingQueueTask(promptId);
          }
          return;
        }
        if (action === "queue-up" || action === "queue-down") {
          const dir = action === "queue-down" ? "down" : "up";
          await reorderPendingQueueTask(promptId, dir);
          return;
        }
        if (action === "remove") {
          await removeQueueTaskFromBackend(promptId);
        }
      } catch (error) {
        if (action !== "cancel") {
          cancellingQueuePromptIds.delete(promptId);
          renderQueueList();
        } else {
          // 取消请求可能因为后端短暂状态不一致而失败，保持“取消中”避免按钮闪回。
          void refreshQueueFromServer();
        }
        // 队列操作信息不进入聊天对话框，仅在控制台保留错误，避免打扰对话流。
        console.warn("Queue action failed:", error);
      }
    });
  }
  if (btnConversationNew) {
    btnConversationNew.addEventListener("click", () => {
      createNewConversation();
    });
  }
  if (conversationList) {
    conversationList.addEventListener("click", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const openBtn = target.closest("[data-conversation-open]");
      if (openBtn instanceof HTMLElement) {
        const id = String(openBtn.getAttribute("data-conversation-open") || "").trim();
        if (id) switchConversation(id);
        return;
      }
      const delBtn = target.closest("[data-conversation-delete]");
      if (delBtn instanceof HTMLElement) {
        const id = String(delBtn.getAttribute("data-conversation-delete") || "").trim();
        if (!id) return;
        const ok = window.confirm("确认删除该对话吗？删除后不可恢复。");
        if (!ok) return;
        deleteConversation(id);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isParamsPopoverOpen()) closeParamsPopover();
    if (e.key === "Escape" && imagePreviewOverlay && !imagePreviewOverlay.hidden) closeImagePreview();
    if (e.key === "Escape" && chatHistoryModal && !chatHistoryModal.hidden) closeChatHistoryModal();
  });

  btnSend.addEventListener("click", onSend);
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  // announcementClose.addEventListener("click", () => {
  //   announcement.hidden = true;
  // });
  window.addEventListener("resize", () => {
    if (isParamsPopoverOpen()) updateParamsPopoverPlacement();
  });
  chat.addEventListener("click", async (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const resultDownload = target.closest(".result-download");
    if (resultDownload instanceof HTMLAnchorElement) {
      e.preventDefault();
      await tryDownloadResultMedia(resultDownload.getAttribute("href") || "");
      return;
    }
    const userRef = target.closest("[data-user-ref-url]");
    if (userRef instanceof HTMLElement) {
      const src = userRef.getAttribute("data-user-ref-url") || "";
      const alt = userRef.getAttribute("data-user-ref-name") || "参考图";
      if (src) openImagePreview(src, alt);
      return;
    }
    const setRefBtn = target.closest("[data-set-reference-url]");
    if (setRefBtn instanceof HTMLElement) {
      e.preventDefault();
      const src = setRefBtn.getAttribute("data-set-reference-url") || "";
      const name = setRefBtn.getAttribute("data-set-reference-name") || "";
      const desiredMode = generationMode === "i2v" ? "i2v" : "i2i";
      addReferenceImageFromResult(src, name, desiredMode)
        .then(() => {
          appendSystemMessage(
            `<strong>已设为参考图</strong><br />已切换到${modeLabelFromValue(desiredMode)}，可直接继续生成。`
          );
        })
        .catch((error) => {
          appendSystemMessage(`<strong>设为参考图失败</strong><br />${error.message}`);
        });
      return;
    }
    const media = target.closest(".result-media");
    if (!media) return;
    if (media instanceof HTMLImageElement) {
      openImagePreview(media.currentSrc || media.src, media.alt || "");
      return;
    }
    if (media instanceof HTMLVideoElement) {
      openVideoPreview(media.currentSrc || media.src);
    }
  });
  composerRefPreview.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const img = target.closest(".composer-ref-thumb-wrap img");
    if (!(img instanceof HTMLImageElement)) return;
    openImagePreview(img.currentSrc || img.src, img.alt || "");
  });
  document.addEventListener("click", (e) => {
    closeAllPrettySelects();
  });

  void (async () => {
    await initStudioUser();
    chatHistoryEntries = loadChatHistoryEntries();
    if (chatHistoryEntries.length) {
      currentConversationId = String(chatHistoryEntries[chatHistoryEntries.length - 1].conversation_id || "").trim();
    }
    if (!currentConversationId) {
      currentConversationId = createConversationId();
    }
    renderConversationList();
    renderChatForConversation(currentConversationId);
    ownedPromptIds = loadOwnedPromptIds();
    queueLabelMap = loadQueueLabelMap();
    queueEntries = loadQueueEntries();
    setQueueCollapsedState(loadQueueCollapsedState(), { persist: false });
    renderQueueList();
    void refreshQueueFromServer();
    if (queueList) {
      queuePollTimer = window.setInterval(() => {
        void refreshQueueFromServer();
      }, QUEUE_POLL_INTERVAL_MS);
    }
    generationMode = modeSelect.value || "t2i";
    updateModeUI();
    bindLandingEntrances();
    bindStudioUserControls();
    window.RhTheme?.bindToggleButtons?.();
    setupPrettySelects();
    loadWorkflowApps();
  })();
  window.addEventListener("beforeunload", () => {
    if (queuePollTimer) {
      window.clearInterval(queuePollTimer);
      queuePollTimer = null;
    }
  });
})();
