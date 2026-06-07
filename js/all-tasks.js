(function () {
  const FILTERS_STORAGE_KEY = "pronote.all-tasks.filters.v1";
  const LEGACY_SORT_KEY = "pronote.all-tasks.sort.v1";

  const BOARDS = [
    {
      route: "ideas",
      storageKey: "pronote.ideas.v1",
      tag: "Идея",
      boardLabel: "Идеи",
      defaultSection: "new",
      sections: [
        { id: "new", label: "Новые" },
        { id: "discuss", label: "Обсуждаются" },
        { id: "discussed", label: "Обсудились" },
        { id: "future", label: "В будущем" },
      ],
      normalizeStatus: null,
    },
    {
      route: "dev",
      storageKey: "pronote.dev.v1",
      tag: "Разработка",
      boardLabel: "Разработка",
      defaultSection: "planned",
      sections: [
        { id: "planned", label: "Планируются" },
        { id: "progress", label: "Делаются" },
        { id: "postponed", label: "Отложены" },
        { id: "waiting", label: "Ожидание" },
      ],
      normalizeStatus: null,
    },
    {
      route: "urgent",
      storageKey: "pronote.urgent.v1",
      tag: "Срочно",
      boardLabel: "Срочно",
      defaultSection: "main",
      sections: [{ id: "main", label: "Срочные задачи" }],
      normalizeStatus: function (status) {
        if (status === "bug" || status === "block") return "main";
        return status;
      },
    },
  ];

  const BOARD_ORDER = {
    ideas: ["ideas", "dev", "urgent"],
    dev: ["dev", "ideas", "urgent"],
    urgent: ["urgent", "ideas", "dev"],
  };

  const DEFAULT_FILTERS = {
    dateSort: "created",
    boardOrder: "none",
    boardFilter: "all",
    statusFilter: "all",
  };

  const boardByRoute = {};
  const boardOrderIndex = {};
  BOARDS.forEach(function (board, index) {
    boardByRoute[board.route] = board;
    boardOrderIndex[board.route] = index;
  });

  const dateSortSelect = document.getElementById("allTasksDateSort");
  const boardOrderSelect = document.getElementById("allTasksBoardOrder");
  const boardFilterSelect = document.getElementById("allTasksBoardFilter");
  const statusFilterSelect = document.getElementById("allTasksStatusFilter");
  const listEl = document.getElementById("allTasksList");
  const metaEl = document.getElementById("allTasksMeta");

  let currentFilters = loadFilters();

  function migrateLegacySort() {
    try {
      const legacy = localStorage.getItem(LEGACY_SORT_KEY);
      if (!legacy) return null;
      localStorage.removeItem(LEGACY_SORT_KEY);
      if (legacy === "created" || legacy === "updated") {
        return {
          dateSort: legacy,
          boardOrder: "none",
          boardFilter: "all",
          statusFilter: "all",
        };
      }
      if (legacy === "board-ideas") {
        return Object.assign({}, DEFAULT_FILTERS, { boardOrder: "ideas" });
      }
      if (legacy === "board-dev") {
        return Object.assign({}, DEFAULT_FILTERS, { boardOrder: "dev" });
      }
      if (legacy === "board-urgent") {
        return Object.assign({}, DEFAULT_FILTERS, { boardOrder: "urgent" });
      }
    } catch (err) {
      console.warn("Pronote: миграция фильтров", err);
    }
    return null;
  }

  function loadFilters() {
    const migrated = migrateLegacySort();
    if (migrated) {
      saveFilters(migrated);
      return migrated;
    }

    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_FILTERS);
      const parsed = JSON.parse(raw);
      return {
        dateSort:
          parsed.dateSort === "created" ||
          parsed.dateSort === "updated" ||
          parsed.dateSort === "completed"
            ? parsed.dateSort
            : DEFAULT_FILTERS.dateSort,
        boardOrder:
          parsed.boardOrder === "none" ||
          parsed.boardOrder === "ideas" ||
          parsed.boardOrder === "dev" ||
          parsed.boardOrder === "urgent"
            ? parsed.boardOrder
            : DEFAULT_FILTERS.boardOrder,
        boardFilter:
          parsed.boardFilter === "all" ||
          parsed.boardFilter === "ideas" ||
          parsed.boardFilter === "dev" ||
          parsed.boardFilter === "urgent"
            ? parsed.boardFilter
            : DEFAULT_FILTERS.boardFilter,
        statusFilter:
          parsed.statusFilter === "all" ||
          parsed.statusFilter === "active" ||
          parsed.statusFilter === "done"
            ? parsed.statusFilter
            : DEFAULT_FILTERS.statusFilter,
      };
    } catch (err) {
      console.warn("Pronote: чтение фильтров", err);
      return Object.assign({}, DEFAULT_FILTERS);
    }
  }

  function saveFilters(filters) {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (err) {
      console.warn("Pronote: сохранение фильтров", err);
    }
  }

  function syncFilterControls() {
    if (dateSortSelect) dateSortSelect.value = currentFilters.dateSort;
    if (boardOrderSelect) boardOrderSelect.value = currentFilters.boardOrder;
    if (boardFilterSelect) boardFilterSelect.value = currentFilters.boardFilter;
    if (statusFilterSelect) statusFilterSelect.value = currentFilters.statusFilter;
  }

  function loadBoardItems(board) {
    try {
      const raw = localStorage.getItem(board.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn("Pronote: чтение всех задач", board.storageKey, err);
      return [];
    }
  }

  function getSectionLabel(board, status) {
    const section = (board.sections || []).find(function (s) {
      return s.id === status;
    });
    return section ? section.label : status || "";
  }

  function normalizeStatus(board, item) {
    let status = item.status || board.defaultSection;
    if (board.normalizeStatus) {
      status = board.normalizeStatus(status);
    }
    return status;
  }

  function collectAllTasks() {
    const all = [];

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        const status = normalizeStatus(board, item);
        all.push({
          id: item.id,
          title: item.title || "Без названия",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          completedAt: item.completedAt,
          route: board.route,
          tag: board.tag,
          boardLabel: board.boardLabel,
          sectionLabel: getSectionLabel(board, status),
          boardOrder: boardOrderIndex[board.route],
        });
      });
    });

    return all;
  }

  function getSortTimestamp(item, dateSort) {
    if (dateSort === "updated") {
      return new Date(item.updatedAt || item.createdAt || 0).getTime();
    }
    if (dateSort === "completed") {
      return new Date(item.completedAt || item.createdAt || 0).getTime();
    }
    return new Date(item.createdAt || 0).getTime();
  }

  function applyFilters(items, filters) {
    let result = items.slice();

    if (filters.boardFilter !== "all") {
      result = result.filter(function (item) {
        return item.route === filters.boardFilter;
      });
    }

    if (filters.statusFilter === "active") {
      result = result.filter(function (item) {
        return !item.completedAt;
      });
    } else if (filters.statusFilter === "done") {
      result = result.filter(function (item) {
        return !!item.completedAt;
      });
    }

    return result;
  }

  function sortTasks(items, filters) {
    const sorted = items.slice();
    const dateSort = filters.dateSort;

    if (filters.boardOrder === "none") {
      sorted.sort(function (a, b) {
        return getSortTimestamp(b, dateSort) - getSortTimestamp(a, dateSort);
      });
      return sorted;
    }

    const order = BOARD_ORDER[filters.boardOrder] || BOARD_ORDER.ideas;
    const rank = {};
    order.forEach(function (route, index) {
      rank[route] = index;
    });

    sorted.sort(function (a, b) {
      const boardDiff = (rank[a.route] ?? 99) - (rank[b.route] ?? 99);
      if (boardDiff !== 0) return boardDiff;
      return getSortTimestamp(b, dateSort) - getSortTimestamp(a, dateSort);
    });

    return sorted;
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    const datePart = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return datePart + ", " + timePart;
  }

  function pluralRu(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "задач";
    if (n1 > 1 && n1 < 5) return "задачи";
    if (n1 === 1) return "задача";
    return "задач";
  }

  function getDisplayDate(item, dateSort) {
    if (dateSort === "updated") {
      return {
        iso: item.updatedAt || item.createdAt,
        label: item.updatedAt ? "Изменено" : "Создано",
      };
    }
    if (dateSort === "completed") {
      return {
        iso: item.completedAt || item.createdAt,
        label: item.completedAt ? "Завершено" : "Создано",
      };
    }
    return {
      iso: item.createdAt,
      label: "Создано",
    };
  }

  function updateMeta(totalCount, visibleCount) {
    if (!metaEl) return;

    if (totalCount === 0) {
      metaEl.textContent = "Нет задач";
      return;
    }

    if (visibleCount === totalCount) {
      metaEl.textContent = visibleCount + " " + pluralRu(visibleCount);
      return;
    }

    metaEl.textContent =
      visibleCount + " из " + totalCount + " " + pluralRu(totalCount);
  }

  function renderAllTasksPage() {
    if (!listEl) return;

    const allItems = collectAllTasks();
    const filtered = applyFilters(allItems, currentFilters);
    const items = sortTasks(filtered, currentFilters);
    listEl.innerHTML = "";

    updateMeta(allItems.length, items.length);

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent =
        allItems.length === 0 ? "Задач пока нет" : "Нет задач по выбранным фильтрам";
      listEl.appendChild(li);
      return;
    }

    items.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "today-list__row all-tasks-list__row";

      const titleCell = document.createElement("div");
      titleCell.className = "today-list__title-cell";

      const a = document.createElement("a");
      a.className = "today-list__title";
      a.href = "#/all";
      a.setAttribute("data-route", "all");
      a.textContent = item.title;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
          window.PronoteEditItem.open(item.route, item.id);
        }
      });
      titleCell.appendChild(a);

      if (item.sectionLabel) {
        const section = document.createElement("span");
        section.className = "all-tasks-list__section";
        section.textContent = item.sectionLabel;
        titleCell.appendChild(section);
      }

      if (item.updatedAt) {
        const modified = document.createElement("span");
        modified.className = "today-list__modified";
        modified.textContent = "Изменено";
        titleCell.appendChild(modified);
      }

      li.appendChild(titleCell);

      const tag = document.createElement("span");
      tag.className = "today-list__tag";
      tag.textContent = item.tag;
      li.appendChild(tag);

      const status = document.createElement("span");
      status.className =
        "all-tasks-list__status" + (item.completedAt ? " all-tasks-list__status--done" : "");
      status.textContent = item.completedAt ? "Готово" : "Активна";
      li.appendChild(status);

      const displayDate = getDisplayDate(item, currentFilters.dateSort);
      const time = document.createElement("time");
      time.className = "today-list__time all-tasks-list__time";
      time.dateTime = displayDate.iso || "";
      time.title = displayDate.label;
      time.textContent = formatDateTime(displayDate.iso);
      li.appendChild(time);

      listEl.appendChild(li);
    });
  }

  function handleFilterChange() {
    currentFilters = {
      dateSort: dateSortSelect ? dateSortSelect.value : DEFAULT_FILTERS.dateSort,
      boardOrder: boardOrderSelect ? boardOrderSelect.value : DEFAULT_FILTERS.boardOrder,
      boardFilter: boardFilterSelect ? boardFilterSelect.value : DEFAULT_FILTERS.boardFilter,
      statusFilter: statusFilterSelect
        ? statusFilterSelect.value
        : DEFAULT_FILTERS.statusFilter,
    };
    saveFilters(currentFilters);
    renderAllTasksPage();
  }

  syncFilterControls();

  [dateSortSelect, boardOrderSelect, boardFilterSelect, statusFilterSelect].forEach(function (
    select
  ) {
    if (select) {
      select.addEventListener("change", handleFilterChange);
    }
  });

  window.renderAllTasksPage = renderAllTasksPage;
})();
