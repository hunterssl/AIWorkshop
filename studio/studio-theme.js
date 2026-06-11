/**
 * 灵影平台共享主题：与无限画布共用 localStorage theme（light / dark）
 * 图标与 canvas AppHeader 一致：ionicons5 SunnyOutline / MoonOutline
 */
(function () {
  const STORAGE_KEY = "theme";

  /** @type {Record<string, string>} */
  const THEME_TOGGLE_SVG = {
    sun: `<svg class="rh-theme-toggle__sun" viewBox="0 0 512 512" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path>
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path>
      <circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>
    </svg>`,
    moon: `<svg class="rh-theme-toggle__moon" viewBox="0 0 512 512" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z"></path>
    </svg>`,
  };

  function readStoredDark() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark") return true;
      if (stored === "light") return false;
    } catch {
      // Ignore storage failures.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function persistTheme(dark) {
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      // Ignore storage failures.
    }
  }

  function ensureToggleIcons(btn) {
    if (!(btn instanceof HTMLElement)) return;
    btn.dataset.rhThemeIconsReady = "1";
  }

  function updateToggleButtons() {
    const dark = isDark();
    document.querySelectorAll("[data-rh-theme-toggle]").forEach((btn) => {
      ensureToggleIcons(btn);
      btn.innerHTML = dark ? THEME_TOGGLE_SVG.sun : THEME_TOGGLE_SVG.moon;
      btn.setAttribute("aria-label", dark ? "切换到亮色模式" : "切换到暗色模式");
      btn.setAttribute("title", dark ? "亮色模式" : "暗色模式");
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }

  function applyTheme(dark, { persist = true } = {}) {
    document.documentElement.classList.toggle("dark", Boolean(dark));
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    if (persist) persistTheme(Boolean(dark));
    updateToggleButtons();
  }

  function toggleTheme() {
    applyTheme(!isDark());
  }

  function bindToggleButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-rh-theme-toggle]").forEach((btn) => {
      ensureToggleIcons(btn);
      if (btn.dataset.rhThemeBound === "1") return;
      btn.dataset.rhThemeBound = "1";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleTheme();
      });
    });
    updateToggleButtons();
  }

  applyTheme(readStoredDark(), { persist: false });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === "dark") applyTheme(true, { persist: false });
    else if (event.newValue === "light") applyTheme(false, { persist: false });
  });

  window.RhTheme = {
    applyTheme,
    toggleTheme,
    isDark,
    bindToggleButtons,
    updateToggleButtons,
    ensureToggleIcons,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bindToggleButtons());
  } else {
    bindToggleButtons();
  }
})();
