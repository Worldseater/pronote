(function () {
  const STORAGE_KEY = "pronote.theme.v1";

  const THEMES = [
    { id: "default", label: "Тёмная" },
    { id: "gold", label: "Золотистая" },
    { id: "leather", label: "Кожаная" },
    { id: "milk", label: "Молочная" },
    { id: "white", label: "Белая" },
  ];

  const toggleBtn = document.getElementById("themeToggle");

  function getThemeIndex(id) {
    const index = THEMES.findIndex(function (theme) {
      return theme.id === id;
    });
    return index === -1 ? 0 : index;
  }

  function isValidTheme(id) {
    return THEMES.some(function (theme) {
      return theme.id === id;
    });
  }

  function getStoredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidTheme(stored)) {
      return stored;
    }
    return "default";
  }

  function applyTheme(themeId) {
    const theme = THEMES[getThemeIndex(themeId)] || THEMES[0];
    const root = document.documentElement;

    if (theme.id === "default") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme.id);
    }

    localStorage.setItem(STORAGE_KEY, theme.id);
    updateToggle(theme);
  }

  function updateToggle(theme) {
    if (!toggleBtn) return;
    toggleBtn.title = "Тема: " + theme.label + ". Нажмите для смены.";
    toggleBtn.setAttribute("aria-label", "Сменить тему. Сейчас: " + theme.label);
  }

  function cycleTheme() {
    const current = getStoredTheme();
    const next = THEMES[(getThemeIndex(current) + 1) % THEMES.length];
    applyTheme(next.id);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", cycleTheme);
  }

  applyTheme(getStoredTheme());

  window.PronoteThemes = {
    THEMES: THEMES,
    getCurrent: getStoredTheme,
    apply: applyTheme,
    cycle: cycleTheme,
  };
})();
