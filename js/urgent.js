(function () {
  if (!window.PronoteInitBoard) return;

  function pluralRu(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  function migrateUrgentStatuses() {
    try {
      const raw = localStorage.getItem("pronote.urgent.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const needsMigrate = parsed.some(function (item) {
        return item.status === "bug" || item.status === "block";
      });
      if (!needsMigrate) return;
      localStorage.setItem(
        "pronote.urgent.v1",
        JSON.stringify(
          parsed.map(function (item) {
            if (item.status === "bug" || item.status === "block") {
              return Object.assign({}, item, { status: "main" });
            }
            return item;
          })
        )
      );
    } catch (err) {
      console.warn("Pronote: миграция срочных задач", err);
    }
  }

  migrateUrgentStatuses();

  const api = window.PronoteInitBoard({
    id: "urgent",
    storageKey: "pronote.urgent.v1",
    eyebrow: "Срочно",
    emptyMeta: "Нет задач",
    plural: function (count) {
      return pluralRu(count, "задача", "задачи", "задач");
    },
    itemTag: "срочно",
    addSection: "main",
    deleteSections: ["main"],
    deleteTitle: "Удалить задачу?",
    deleteMessageSuffix: "будет удалена без восстановления.",
    deleteFallbackName: "эта задача",
    deleteAriaLabel: "Удалить задачу",
    titleError: "Введите заголовок задачи.",
    formId: "urgentForm",
    formErrorId: "urgentFormError",
    formPanelId: "urgentFormPanel",
    formToggleId: "urgentFormToggle",
    sections: [{ id: "main", title: "Срочные задачи" }],
    seed: [],
  });

  function renderHomeUrgentPreview() {
    const listEl = document.getElementById("homeUrgentList");
    if (!listEl) return;

    let items = [];
    try {
      const raw = localStorage.getItem("pronote.urgent.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed.map(function (item) {
            if (item.status === "bug" || item.status === "block") {
              return Object.assign({}, item, { status: "main" });
            }
            return item;
          });
        }
      }
    } catch (err) {
      console.warn("Pronote: превью срочных", err);
    }

    items = items
      .filter(function (item) {
        return item.status === "main";
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    const maxItems = 6;
    const slice = items.slice(0, maxItems);

    listEl.innerHTML = "";

    if (slice.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = '<span class="board-col__empty">Нет срочных задач</span>';
      listEl.appendChild(li);
      return;
    }

    slice.forEach(function (item) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#/urgent";
      a.setAttribute("data-route", "urgent");
      a.textContent = item.title || "Без названия";
      li.appendChild(a);
      listEl.appendChild(li);
    });

    if (items.length > maxItems) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#/urgent";
      a.setAttribute("data-route", "urgent");
      a.textContent = "Ещё " + (items.length - maxItems) + "…";
      li.appendChild(a);
      listEl.appendChild(li);
    }
  }

  window.renderHomeUrgentPreview = renderHomeUrgentPreview;

  if (api && api.render) {
    const baseRender = api.render;
    api.render = function () {
      baseRender();
      renderHomeUrgentPreview();
    };
  }

  renderHomeUrgentPreview();
})();
