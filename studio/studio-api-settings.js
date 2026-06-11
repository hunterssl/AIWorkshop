/**
 * 主界面 / 创作工坊 / 无限画布 — 共用 API 设置弹窗（localStorage 与 canvas pinia 一致）
 */
(function () {
  const STORAGE = {
    PROVIDER: "api-provider",
    API_KEYS: "api-keys-by-provider",
    BASE_URLS: "base-urls-by-provider",
    CUSTOM_CHAT: "custom-chat-models",
    CUSTOM_IMAGE: "custom-image-models",
    CUSTOM_VIDEO: "custom-video-models",
    CUSTOM_CHAT_BY_PROVIDER: "custom-chat-models-by-provider",
    CUSTOM_IMAGE_BY_PROVIDER: "custom-image-models-by-provider",
    CUSTOM_VIDEO_BY_PROVIDER: "custom-video-models-by-provider",
  };

  const PROVIDERS = {
    chatfire: {
      label: "火宝 (Chatfire)",
      defaultBaseUrl: "https://api.chatfire.site",
      endpoints: {
        chat: "/v1/chat/completions",
        image: "/v1/images/generations",
        video: "/v1/video/generations",
        videoQuery: "/v1/video/task/{taskId}",
      },
    },
    openai: {
      label: "OpenAI",
      defaultBaseUrl: "https://api.chatfire.cn",
      endpoints: {
        chat: "/v1/chat/completions",
        image: "/v1/images/generations",
        video: "/v1/videos",
        videoQuery: "/v1/videos/{taskId}",
      },
    },
    default: "chatfire",
  };

  const MODAL_HTML = `
    <div class="studio-api-modal is-hidden" id="studioApiModal" role="dialog" aria-modal="true" aria-labelledby="studioApiTitle">
      <div class="studio-api-modal__backdrop" id="studioApiBackdrop"></div>
      <div class="studio-api-modal__panel">
        <header class="studio-api-modal__head">
          <h2 id="studioApiTitle">API 设置</h2>
          <button type="button" class="studio-api-modal__close" id="btnCloseStudioApi" aria-label="关闭">×</button>
        </header>
        <div class="studio-api-modal__tabs" role="tablist" aria-label="API 设置分类">
          <button type="button" class="studio-api-modal__tab is-active" data-api-tab="api" role="tab" aria-selected="true">API 配置</button>
          <button type="button" class="studio-api-modal__tab" data-api-tab="models" role="tab" aria-selected="false">模型配置</button>
        </div>
        <div class="studio-api-modal__body">
          <div class="studio-api-modal__pane is-active" data-api-pane="api" role="tabpanel">
            <label class="studio-api-modal__label" for="studioApiProvider">渠道</label>
            <select id="studioApiProvider" class="studio-api-modal__input"></select>
            <label class="studio-api-modal__label" for="studioApiBaseUrl">Base URL</label>
            <input id="studioApiBaseUrl" class="studio-api-modal__input" type="text" placeholder="https://api.chatfire.site" autocomplete="off" />
            <label class="studio-api-modal__label" for="studioApiKey">API Key</label>
            <input id="studioApiKey" class="studio-api-modal__input" type="password" placeholder="请输入 API Key" autocomplete="off" />
            <p class="studio-api-modal__section-title">端点路径</p>
            <div class="studio-api-modal__endpoints" id="studioApiEndpoints"></div>
            <div class="studio-api-modal__status is-warn" id="studioApiStatus"></div>
          </div>
          <div class="studio-api-modal__pane" data-api-pane="models" role="tabpanel" hidden>
            <section class="studio-api-modal__model-group" data-model-group="chat">
              <div class="studio-api-modal__model-head">
                <h3>问答模型</h3>
                <span class="studio-api-modal__model-count" id="studioApiChatCount">0 个</span>
              </div>
              <div class="studio-api-modal__model-add">
                <input id="studioApiChatInput" class="studio-api-modal__input" type="text" placeholder="输入模型名称，如 gpt-4o" autocomplete="off" />
                <button type="button" class="studio-api-modal__btn studio-api-modal__btn--primary" data-add-model="chat">添加</button>
              </div>
              <div class="studio-api-modal__model-tags" id="studioApiChatTags"></div>
            </section>
            <section class="studio-api-modal__model-group" data-model-group="image">
              <div class="studio-api-modal__model-head">
                <h3>图片模型</h3>
                <span class="studio-api-modal__model-count" id="studioApiImageCount">0 个</span>
              </div>
              <div class="studio-api-modal__model-add">
                <input id="studioApiImageInput" class="studio-api-modal__input" type="text" placeholder="输入模型名称，如 dall-e-3" autocomplete="off" />
                <button type="button" class="studio-api-modal__btn studio-api-modal__btn--primary" data-add-model="image">添加</button>
              </div>
              <div class="studio-api-modal__model-tags" id="studioApiImageTags"></div>
            </section>
            <section class="studio-api-modal__model-group" data-model-group="video">
              <div class="studio-api-modal__model-head">
                <h3>视频模型</h3>
                <span class="studio-api-modal__model-count" id="studioApiVideoCount">0 个</span>
              </div>
              <div class="studio-api-modal__model-add">
                <input id="studioApiVideoInput" class="studio-api-modal__input" type="text" placeholder="输入模型名称，如 sora-2" autocomplete="off" />
                <button type="button" class="studio-api-modal__btn studio-api-modal__btn--primary" data-add-model="video">添加</button>
              </div>
              <div class="studio-api-modal__model-tags" id="studioApiVideoTags"></div>
            </section>
          </div>
        </div>
        <footer class="studio-api-modal__foot">
          <a href="https://api.chatfire.site/login?inviteCode=EEE80324" target="_blank" rel="noopener" class="studio-api-modal__link">没有 API Key？点击注册</a>
          <div class="studio-api-modal__actions">
            <button type="button" class="studio-api-modal__btn" id="btnClearStudioApi">清除配置</button>
            <button type="button" class="studio-api-modal__btn" id="btnCancelStudioApi">取消</button>
            <button type="button" class="studio-api-modal__btn studio-api-modal__btn--primary" id="btnSaveStudioApi">保存</button>
          </div>
        </footer>
      </div>
    </div>
  `;

  let initialized = false;
  let activeTab = "api";
  /** @type {Record<string, any>} */
  let ui = {};

  function getCatalog() {
    return window.RhModelsCatalog || { CHAT_MODELS: [], IMAGE_MODELS: [], VIDEO_MODELS: [] };
  }

  function ensureModalDom() {
    if (!document.getElementById("studioApiModal")) {
      document.body.insertAdjacentHTML("beforeend", MODAL_HTML);
    }
  }

  function bindUiRefs() {
    const modal = document.getElementById("studioApiModal");
    const catalog = getCatalog();
    ui = {
      modal,
      backdrop: document.getElementById("studioApiBackdrop"),
      btnClose: document.getElementById("btnCloseStudioApi"),
      btnCancel: document.getElementById("btnCancelStudioApi"),
      btnSave: document.getElementById("btnSaveStudioApi"),
      btnClear: document.getElementById("btnClearStudioApi"),
      providerSelect: document.getElementById("studioApiProvider"),
      baseUrlInput: document.getElementById("studioApiBaseUrl"),
      apiKeyInput: document.getElementById("studioApiKey"),
      statusBox: document.getElementById("studioApiStatus"),
      endpointList: document.getElementById("studioApiEndpoints"),
      tabButtons: modal ? modal.querySelectorAll("[data-api-tab]") : [],
      tabPanes: modal ? modal.querySelectorAll("[data-api-pane]") : [],
      modelUi: {
        chat: {
          input: document.getElementById("studioApiChatInput"),
          tags: document.getElementById("studioApiChatTags"),
          count: document.getElementById("studioApiChatCount"),
          storage: STORAGE.CUSTOM_CHAT,
          storageByProvider: STORAGE.CUSTOM_CHAT_BY_PROVIDER,
          builtins: catalog.CHAT_MODELS,
        },
        image: {
          input: document.getElementById("studioApiImageInput"),
          tags: document.getElementById("studioApiImageTags"),
          count: document.getElementById("studioApiImageCount"),
          storage: STORAGE.CUSTOM_IMAGE,
          storageByProvider: STORAGE.CUSTOM_IMAGE_BY_PROVIDER,
          builtins: catalog.IMAGE_MODELS,
        },
        video: {
          input: document.getElementById("studioApiVideoInput"),
          tags: document.getElementById("studioApiVideoTags"),
          count: document.getElementById("studioApiVideoCount"),
          storage: STORAGE.CUSTOM_VIDEO,
          storageByProvider: STORAGE.CUSTOM_VIDEO_BY_PROVIDER,
          builtins: catalog.VIDEO_MODELS,
        },
      },
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getDefaultProvider() {
    return PROVIDERS.default || "chatfire";
  }

  function getProviderConfig(key) {
    return PROVIDERS[key] || PROVIDERS[getDefaultProvider()];
  }

  function getCurrentProvider() {
    const stored = localStorage.getItem(STORAGE.PROVIDER) || getDefaultProvider();
    if (stored === "comfyui_local" || !PROVIDERS[stored]) {
      const fallback = getDefaultProvider();
      if (stored === "comfyui_local") {
        localStorage.setItem(STORAGE.PROVIDER, fallback);
      }
      return fallback;
    }
    return stored;
  }

  function setCurrentProvider(provider) {
    localStorage.setItem(STORAGE.PROVIDER, provider);
  }

  function getApiKeys() {
    return readJson(STORAGE.API_KEYS, {});
  }

  function getBaseUrls() {
    return readJson(STORAGE.BASE_URLS, {});
  }

  function isConfigured() {
    const provider = getCurrentProvider();
    const keys = getApiKeys();
    return Boolean(String(keys[provider] || "").trim());
  }

  function getAllModels(kind, provider) {
    const cfg = ui.modelUi[kind];
    if (!cfg) return [];
    const builtins = (cfg.builtins || []).map((m) => ({
      label: m.label || m.key,
      key: m.key,
      isCustom: false,
    }));
    const globalCustom = readJson(cfg.storage, []).map((m) => ({
      label: m.label || m.key,
      key: m.key,
      isCustom: true,
      customScope: "global",
    }));
    const byProvider = (readJson(cfg.storageByProvider, {})[provider] || []).map((m) => ({
      label: m.label || m.key,
      key: m.key,
      isCustom: true,
      customScope: "provider",
    }));
    return [...builtins, ...globalCustom, ...byProvider];
  }

  function addCustomModel(kind, modelKey) {
    const key = String(modelKey || "").trim();
    if (!key) return false;
    const cfg = ui.modelUi[kind];
    const list = readJson(cfg.storage, []);
    if (list.some((m) => m.key === key)) return false;
    list.push({ key, label: key });
    writeJson(cfg.storage, list);
    return true;
  }

  function removeCustomModel(kind, modelKey, customScope) {
    const cfg = ui.modelUi[kind];
    if (customScope === "provider") {
      const provider = ui.providerSelect?.value || getCurrentProvider();
      const map = readJson(cfg.storageByProvider, {});
      const list = map[provider] || [];
      const idx = list.findIndex((m) => m.key === modelKey);
      if (idx === -1) return false;
      list.splice(idx, 1);
      map[provider] = list;
      writeJson(cfg.storageByProvider, map);
      return true;
    }
    const list = readJson(cfg.storage, []);
    const idx = list.findIndex((m) => m.key === modelKey);
    if (idx === -1) return false;
    list.splice(idx, 1);
    writeJson(cfg.storage, list);
    return true;
  }

  function clearAllCustomModels() {
    writeJson(STORAGE.CUSTOM_CHAT, []);
    writeJson(STORAGE.CUSTOM_IMAGE, []);
    writeJson(STORAGE.CUSTOM_VIDEO, []);
    writeJson(STORAGE.CUSTOM_CHAT_BY_PROVIDER, {});
    writeJson(STORAGE.CUSTOM_IMAGE_BY_PROVIDER, {});
    writeJson(STORAGE.CUSTOM_VIDEO_BY_PROVIDER, {});
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;");
  }

  function renderModelTags(kind) {
    const cfg = ui.modelUi[kind];
    if (!cfg?.tags) return;
    const provider = ui.providerSelect?.value || getCurrentProvider();
    const models = getAllModels(kind, provider);
    if (cfg.count) cfg.count.textContent = `${models.length} 个`;
    cfg.tags.innerHTML = models
      .map((m) => {
        const tone = kind === "chat" ? "info" : kind === "image" ? "success" : "warning";
        const removeBtn = m.isCustom
          ? `<button type="button" class="studio-api-modal__tag-remove" data-remove-model="${kind}" data-model-key="${escapeAttr(m.key)}" data-model-scope="${m.customScope || "global"}" aria-label="删除 ${escapeAttr(m.label)}">×</button>`
          : "";
        return `<span class="studio-api-modal__tag is-${tone}${m.isCustom ? " is-custom" : ""}">${escapeHtml(m.label)}${removeBtn}</span>`;
      })
      .join("");
  }

  function renderAllModelTags() {
    renderModelTags("chat");
    renderModelTags("image");
    renderModelTags("video");
  }

  function setActiveTab(tab) {
    activeTab = tab === "models" ? "models" : "api";
    ui.tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute("data-api-tab") === activeTab;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    ui.tabPanes.forEach((pane) => {
      const isActive = pane.getAttribute("data-api-pane") === activeTab;
      pane.classList.toggle("is-active", isActive);
      pane.hidden = !isActive;
    });
    if (activeTab === "models") renderAllModelTags();
  }

  function populateProviderOptions() {
    if (!ui.providerSelect) return;
    ui.providerSelect.innerHTML = "";
    Object.entries(PROVIDERS)
      .filter(([key]) => key !== "default")
      .forEach(([key, value]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = value.label;
        ui.providerSelect.appendChild(opt);
      });
  }

  function renderEndpoints(provider) {
    if (!ui.endpointList) return;
    const config = getProviderConfig(provider);
    const endpoints = config.endpoints || {};
    const rows = [
      ["问答", endpoints.chat, "info"],
      ["生图", endpoints.image, "success"],
      ["视频生成", endpoints.video, "warning"],
      ["结果查询", endpoints.videoQuery, "warning"],
    ];
    ui.endpointList.innerHTML = rows
      .map(
        ([label, path, tone]) => `
          <div class="studio-api-modal__endpoint">
            <span class="studio-api-modal__endpoint-label">${label}</span>
            <code class="studio-api-modal__endpoint-tag is-${tone}">${path || "—"}</code>
          </div>
        `,
      )
      .join("");
  }

  function syncFormFromStorage() {
    const provider = getCurrentProvider();
    const keys = getApiKeys();
    const urls = getBaseUrls();
    const config = getProviderConfig(provider);
    if (ui.providerSelect) ui.providerSelect.value = provider;
    if (ui.apiKeyInput) ui.apiKeyInput.value = keys[provider] || "";
    if (ui.baseUrlInput) ui.baseUrlInput.value = urls[provider] || config.defaultBaseUrl || "";
    renderEndpoints(provider);
    updateStatus();
    renderAllModelTags();
  }

  function updateStatus() {
    if (!ui.statusBox) return;
    const configured = isConfigured();
    ui.statusBox.className = `studio-api-modal__status ${configured ? "is-ok" : "is-warn"}`;
    ui.statusBox.innerHTML = configured
      ? "<strong>已配置</strong><span>API 已就绪，无限画布与 AI 功能可使用。</span>"
      : `<strong>未配置</strong><span>请填写 API Key 后保存。画布 AI 功能需要此配置。</span>
         <a href="https://api.chatfire.site/login?inviteCode=EEE80324" target="_blank" rel="noopener">点击获取 API Key（新用户注册）</a>`;
  }

  function open() {
    init();
    if (!ui.modal) return;
    setActiveTab("api");
    syncFormFromStorage();
    ui.modal.classList.remove("is-hidden");
    document.body.classList.add("studio-api-open");
    ui.providerSelect?.focus();
  }

  function close() {
    if (!ui.modal) return;
    ui.modal.classList.add("is-hidden");
    document.body.classList.remove("studio-api-open");
  }

  function save() {
    const provider = ui.providerSelect?.value || getCurrentProvider();
    const apiKey = String(ui.apiKeyInput?.value || "").trim();
    const baseUrl = String(ui.baseUrlInput?.value || "").trim();
    setCurrentProvider(provider);
    const keys = getApiKeys();
    const urls = getBaseUrls();
    keys[provider] = apiKey;
    urls[provider] = baseUrl;
    writeJson(STORAGE.API_KEYS, keys);
    writeJson(STORAGE.BASE_URLS, urls);
    updateStatus();
    close();
    window.dispatchEvent(new CustomEvent("rh-api-settings-change"));
    if (typeof window.$message?.success === "function") {
      window.$message.success("API 配置已保存");
    }
  }

  function clearConfig() {
    const provider = ui.providerSelect?.value || getCurrentProvider();
    const keys = getApiKeys();
    const urls = getBaseUrls();
    delete keys[provider];
    delete urls[provider];
    writeJson(STORAGE.API_KEYS, keys);
    writeJson(STORAGE.BASE_URLS, urls);
    clearAllCustomModels();
    if (ui.apiKeyInput) ui.apiKeyInput.value = "";
    if (ui.baseUrlInput) ui.baseUrlInput.value = getProviderConfig(provider).defaultBaseUrl || "";
    updateStatus();
    renderAllModelTags();
    window.dispatchEvent(new CustomEvent("rh-api-settings-change"));
    if (typeof window.$message?.info === "function") {
      window.$message.info("已清除当前渠道与自定义模型配置");
    }
  }

  function onProviderChange() {
    const provider = ui.providerSelect.value;
    const keys = getApiKeys();
    const urls = getBaseUrls();
    const config = getProviderConfig(provider);
    if (ui.apiKeyInput) ui.apiKeyInput.value = keys[provider] || "";
    if (ui.baseUrlInput) ui.baseUrlInput.value = urls[provider] || config.defaultBaseUrl || "";
    renderEndpoints(provider);
    updateStatus();
    renderAllModelTags();
  }

  function bindEvents() {
    ui.btnClose?.addEventListener("click", close);
    ui.btnCancel?.addEventListener("click", close);
    ui.backdrop?.addEventListener("click", close);
    ui.btnSave?.addEventListener("click", save);
    ui.btnClear?.addEventListener("click", clearConfig);
    ui.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-api-tab")));
    });
    ui.providerSelect?.addEventListener("change", onProviderChange);
    ui.modal?.querySelectorAll("[data-add-model]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-add-model");
        const cfg = ui.modelUi[kind];
        if (!cfg?.input) return;
        if (!addCustomModel(kind, cfg.input.value)) {
          window.$message?.warning?.("模型已存在或名称无效");
          return;
        }
        cfg.input.value = "";
        renderModelTags(kind);
        window.dispatchEvent(new CustomEvent("rh-api-settings-change"));
      });
    });
    ui.modal?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-remove-model]");
      if (!btn) return;
      const kind = btn.getAttribute("data-remove-model");
      const modelKey = btn.getAttribute("data-model-key");
      const scope = btn.getAttribute("data-model-scope") || "global";
      if (removeCustomModel(kind, modelKey, scope)) {
        renderModelTags(kind);
        window.dispatchEvent(new CustomEvent("rh-api-settings-change"));
      }
    });
    ["chat", "image", "video"].forEach((kind) => {
      ui.modelUi[kind].input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        ui.modal?.querySelector(`[data-add-model="${kind}"]`)?.click();
      });
    });
  }

  function init() {
    if (initialized) return;
    ensureModalDom();
    bindUiRefs();
    populateProviderOptions();
    bindEvents();
    initialized = true;
  }

  function bootstrap() {
    init();
    window.addEventListener("rh-open-api-settings", open);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && ui.modal && !ui.modal.classList.contains("is-hidden")) {
        close();
      }
    });
  }

  window.RhApiSettings = { open, close, isConfigured, init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
