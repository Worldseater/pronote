(function () {
  const BOARDS = [
    {
      route: "ideas",
      storageKey: "pronote.ideas.v1",
      tag: "Идея",
      defaultSection: "new",
      sections: [
        { id: "new", label: "Новые" },
        { id: "discuss", label: "Обсуждаются" },
        { id: "discussed", label: "Обсудились" },
        { id: "future", label: "В будущем" },
      ],
      sectionHash: {
        new: "#/ideas/new",
        discuss: "#/ideas/discuss",
        discussed: "#/ideas/discussed",
        future: "#/ideas/future",
      },
    },
    {
      route: "dev",
      storageKey: "pronote.dev.v1",
      tag: "Разработка",
      defaultSection: "planned",
      sections: [
        { id: "planned", label: "Планируются" },
        { id: "progress", label: "Делаются" },
        { id: "postponed", label: "Отложены" },
        { id: "waiting", label: "Ожидание" },
      ],
      sectionHash: {
        planned: "#/dev/planned",
        progress: "#/dev/progress",
        postponed: "#/dev/postponed",
        waiting: "#/dev/waiting",
      },
    },
    {
      route: "urgent",
      storageKey: "pronote.urgent.v1",
      tag: "Срочно",
      defaultSection: "main",
      sections: [{ id: "main", label: "Срочные задачи" }],
      sectionHash: {
        main: "#/urgent",
        bug: "#/urgent",
        block: "#/urgent",
      },
      normalizeStatus: function (status) {
        if (status === "bug" || status === "block") return "main";
        return status;
      },
    },
  ];

  const boardByRoute = {};
  BOARDS.forEach(function (board) {
    boardByRoute[board.route] = board;
  });

  const form = document.getElementById("todayForm");
  const formPanel = document.getElementById("todayFormPanel");
  const formToggle = document.getElementById("todayFormToggle");
  const formClose = document.getElementById("todayFormClose");
  const formError = document.getElementById("todayFormError");
  const boardSelect = document.getElementById("todayBoardSelect");
  const sectionSelect = document.getElementById("todaySectionSelect");

  function isCreatedToday(iso) {
    if (!iso) return false;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function loadBoardItems(board) {
    try {
      const raw = localStorage.getItem(board.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn("Pronote: чтение задач за сегодня", board.storageKey, err);
      return [];
    }
  }

  function getItemHash(board, item) {
    let status = item.status || board.defaultSection;
    if (board.normalizeStatus) {
      status = board.normalizeStatus(status);
    }
    const map = board.sectionHash;
    return map[status] || map[board.defaultSection] || "#/";
  }

  function formatDateTimeAdded(iso) {
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

  function getSectionLabel(board, status) {
    const section = (board.sections || []).find(function (entry) {
      return entry.id === status;
    });
    return section ? section.label : "";
  }

  function collectTodayItems() {
    const today = [];

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        if (item.completedAt) return;
        if (!isCreatedToday(item.createdAt)) return;
        let status = item.status || board.defaultSection;
        if (board.normalizeStatus) {
          status = board.normalizeStatus(status);
        }
        today.push({
          id: item.id,
          title: item.title || "Без названия",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          projectId: item.projectId,
          assigneeId: item.assigneeId,
          route: board.route,
          section: status,
          href: getItemHash(board, item),
          boardTag: board.tag,
          statusLabel: getSectionLabel(board, status),
        });
      });
    });

    today.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return today;
  }

  function renderHomeToday() {
    const listEl = document.getElementById("homeTodayList");
    if (!listEl) return;

    const items = collectTodayItems();
    listEl.innerHTML = "";

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Сегодня пока ничего не добавлено";
      listEl.appendChild(li);
      return;
    }

    items.forEach(function (item) {
      if (window.PronoteRenderHomeTaskRow) {
        window.PronoteRenderHomeTaskRow(listEl, {
          title: item.title,
          boardTag: item.boardTag,
          statusLabel: item.statusLabel,
          projectId: item.projectId,
          assigneeId: item.assigneeId,
          onTitleClick: function () {
            if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
              window.PronoteEditItem.open(item.route, item.id);
            }
          },
        });
      }
    });
  }

  function showFormError(message) {
    if (!formError) return;
    if (!message) {
      formError.hidden = true;
      formError.textContent = "";
      return;
    }
    formError.hidden = false;
    formError.textContent = message;
  }

  function updateBoardColAddButtons(activeBoard, formOpen) {
    document.querySelectorAll("[data-board-add-home]").forEach(function (btn) {
      const isActive = formOpen && activeBoard && btn.dataset.boardAddHome === activeBoard;
      btn.setAttribute("aria-expanded", String(isActive));
      btn.classList.toggle("page-head__add--active", isActive);
    });
  }

  function setFormOpen(open, activeBoard) {
    if (!formPanel) return;
    formPanel.hidden = !open;
    if (formToggle) {
      const fromBoardCol = !!activeBoard;
      formToggle.setAttribute("aria-expanded", String(open && !fromBoardCol));
      formToggle.classList.toggle("page-head__add--active", open && !fromBoardCol);
    }
    updateBoardColAddButtons(activeBoard || (boardSelect ? boardSelect.value : null), open);
    if (open && form) {
      const titleInput = form.querySelector('[name="title"]');
      if (titleInput) {
        window.requestAnimationFrame(function () {
          titleInput.focus();
        });
      }
    }
  }

  function openFormForBoard(boardRoute, section) {
    const board = boardByRoute[boardRoute];
    if (!board || !boardSelect) return;

    if (formPanel && !formPanel.hidden && boardSelect.value === boardRoute) {
      setFormOpen(false);
      showFormError("");
      return;
    }

    boardSelect.value = boardRoute;
    fillSectionSelect(boardRoute);

    const targetSection = section || board.defaultSection;
    if (sectionSelect) {
      sectionSelect.value = targetSection;
    }

    showFormError("");
    setFormOpen(true, boardRoute);

    const todaySection = document.querySelector(".glass-bar--today");
    if (todaySection) {
      window.requestAnimationFrame(function () {
        todaySection.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function fillSectionSelect(boardRoute) {
    if (!sectionSelect) return;
    const board = boardByRoute[boardRoute];
    if (!board) return;

    sectionSelect.innerHTML = "";
    board.sections.forEach(function (section) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.label;
      sectionSelect.appendChild(option);
    });

    sectionSelect.disabled = board.sections.length <= 1;
  }

  function handleBoardChange() {
    if (!boardSelect) return;
    fillSectionSelect(boardSelect.value);
    showFormError("");
    if (formPanel && !formPanel.hidden) {
      updateBoardColAddButtons(boardSelect.value, true);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!form || !boardSelect || !sectionSelect) return;

    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const text = String(fd.get("text") || "").trim();
    const boardRoute = boardSelect.value;
    const section = sectionSelect.value;

    if (!title) {
      showFormError("Введите заголовок задачи.");
      return;
    }

    const handler =
      window.PronoteBoardHandlers && window.PronoteBoardHandlers[boardRoute];
    if (!handler || typeof handler.addItem !== "function") {
      showFormError("Не удалось сохранить задачу. Обновите страницу.");
      return;
    }

    const ok = handler.addItem({
      title: title,
      text: text,
      comment: String(fd.get("comment") || ""),
      status: section,
      projectId:
        window.PronoteProjectPicker && typeof window.PronoteProjectPicker.resolve === "function"
          ? window.PronoteProjectPicker.resolve(form)
          : null,
      assigneeId:
        window.PronoteAssigneePicker && typeof window.PronoteAssigneePicker.resolve === "function"
          ? window.PronoteAssigneePicker.resolve(form)
          : null,
    });

    if (!ok) {
      showFormError("Введите заголовок задачи.");
      return;
    }

    if (
      window.PronoteProjectPicker &&
      typeof window.PronoteProjectPicker.refreshAll === "function"
    ) {
      window.PronoteProjectPicker.refreshAll();
    }
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.refreshAll === "function"
    ) {
      window.PronoteAssigneePicker.refreshAll();
    }

    if (boardRoute === "urgent" && typeof window.renderHomeUrgentPreview === "function") {
      window.renderHomeUrgentPreview();
    }

    form.reset();
    if (window.PronoteProjectPicker && typeof window.PronoteProjectPicker.reset === "function") {
      window.PronoteProjectPicker.reset(form);
    }
    if (window.PronoteAssigneePicker && typeof window.PronoteAssigneePicker.reset === "function") {
      window.PronoteAssigneePicker.reset(form);
    }
    handleBoardChange();
    showFormError("");
    setFormOpen(false);
    renderHomeToday();
  }

  if (boardSelect) {
    boardSelect.addEventListener("change", handleBoardChange);
    fillSectionSelect(boardSelect.value);
  }

  if (form) {
    form.addEventListener("submit", handleFormSubmit);
    form.addEventListener("input", function () {
      showFormError("");
    });
    form.addEventListener("reset", function () {
      window.requestAnimationFrame(function () {
        if (
          window.PronoteProjectPicker &&
          typeof window.PronoteProjectPicker.reset === "function"
        ) {
          window.PronoteProjectPicker.reset(form);
        }
        if (
          window.PronoteAssigneePicker &&
          typeof window.PronoteAssigneePicker.reset === "function"
        ) {
          window.PronoteAssigneePicker.reset(form);
        }
        handleBoardChange();
        showFormError("");
      });
    });
  }

  document.querySelectorAll("[data-board-add-home]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const boardRoute = btn.dataset.boardAddHome;
      if (boardRoute) {
        openFormForBoard(boardRoute);
      }
    });
  });

  if (formToggle) {
    formToggle.addEventListener("click", function () {
      if (formPanel && formPanel.hidden) {
        setFormOpen(true);
      } else {
        setFormOpen(false);
        showFormError("");
      }
    });
  }

  if (formClose) {
    formClose.addEventListener("click", function () {
      setFormOpen(false);
      showFormError("");
    });
  }

  window.renderHomeToday = renderHomeToday;
  window.openTodayFormForBoard = openFormForBoard;
  renderHomeToday();
})();
