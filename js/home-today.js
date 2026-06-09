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
    },
    {
      route: "urgent",
      storageKey: "pronote.urgent.v1",
      tag: "Срочно",
      defaultSection: "main",
      sections: [{ id: "main", label: "Срочные задачи" }],
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

  const modal = document.getElementById("todayCreateModal");
  const backdrop = document.getElementById("todayCreateModalBackdrop");
  const modalCancel = document.getElementById("todayCreateModalCancel");
  const formToggle = document.getElementById("todayFormToggle");
  const form = document.getElementById("todayCreateForm");
  const formError = document.getElementById("todayCreateFormError");
  const boardSelect = document.getElementById("todayBoardSelect");
  const sectionSelect = document.getElementById("todaySectionSelect");
  const taskFields = document.getElementById("todayCreateTaskFields");
  const textLabel = document.getElementById("todayCreateTextLabel");
  const textInput = document.getElementById("todayCreateTextInput");
  const typeNoteBtn = document.getElementById("todayTypeNote");
  const typeTaskBtn = document.getElementById("todayTypeTask");
  const typeButtons = [typeNoteBtn, typeTaskBtn].filter(Boolean);

  let activeType = "note";
  let activeBoardRoute = null;
  let lastFocus = null;

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

  function loadTodayNotes() {
    if (window.PronoteNotes && typeof window.PronoteNotes.getAll === "function") {
      return window.PronoteNotes.getAll().filter(function (note) {
        return isCreatedToday(note.createdAt);
      });
    }

    try {
      const raw = localStorage.getItem("pronote.notes.v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (note) {
        return note && isCreatedToday(note.createdAt);
      });
    } catch (err) {
      console.warn("Pronote: чтение заметок за сегодня", err);
      return [];
    }
  }

  function getSectionLabel(board, status) {
    const section = (board.sections || []).find(function (entry) {
      return entry.id === status;
    });
    return section ? section.label : "";
  }

  function getNoteSectionLabel(note) {
    if (!note.boardRoute || !note.section) return "";
    if (
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.getSectionLabel === "function"
    ) {
      return window.PronoteNoteBoardPicker.getSectionLabel(note.boardRoute, note.section);
    }
    return "";
  }

  function collectTodayItems() {
    const today = [];

    loadTodayNotes().forEach(function (note) {
      today.push({
        kind: "note",
        id: note.id,
        title: note.title || "Без названия",
        createdAt: note.createdAt,
        projectId: note.projectId,
        assigneeId: note.assigneeId,
        statusLabel: getNoteSectionLabel(note),
      });
    });

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        if (item.completedAt) return;
        if (!isCreatedToday(item.createdAt)) return;

        let status = item.status || board.defaultSection;
        if (board.normalizeStatus) {
          status = board.normalizeStatus(status);
        }

        today.push({
          kind: "task",
          id: item.id,
          title: item.title || "Без названия",
          createdAt: item.createdAt,
          projectId: item.projectId,
          assigneeId: item.assigneeId,
          route: board.route,
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
      if (!window.PronoteRenderHomeTaskRow) return;

      if (item.kind === "note") {
        window.PronoteRenderHomeTaskRow(listEl, {
          title: item.title,
          boardTag: "Заметка",
          statusLabel: item.statusLabel || "",
          projectId: item.projectId,
          assigneeId: item.assigneeId,
          createdAt: item.createdAt,
          onTitleClick: function () {
            if (
              window.PronoteNotes &&
              typeof window.PronoteNotes.openEdit === "function"
            ) {
              window.PronoteNotes.openEdit(item.id);
            }
          },
        });
        return;
      }

      window.PronoteRenderHomeTaskRow(listEl, {
        title: item.title,
        boardTag: item.boardTag,
        statusLabel: item.statusLabel,
        projectId: item.projectId,
        assigneeId: item.assigneeId,
        createdAt: item.createdAt,
        onTitleClick: function () {
          if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
            window.PronoteEditItem.open(item.route, item.id);
          }
        },
      });
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

  function resolveBoardLink(formEl) {
    if (
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.resolve === "function"
    ) {
      return window.PronoteNoteBoardPicker.resolve(formEl);
    }
    return null;
  }

  function resetPickers() {
    if (
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.reset === "function"
    ) {
      window.PronoteNoteBoardPicker.reset(form);
    }
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
  }

  function refreshPickers() {
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
  }

  function setNoteBoardPickerVisible(visible) {
    const picker = form && form.querySelector("[data-note-board-picker]");
    if (!picker) return;
    picker.hidden = !visible;
  }

  function setCreateType(type) {
    activeType = type === "task" ? "task" : "note";

    typeButtons.forEach(function (btn) {
      const isActive = btn.dataset.todayType === activeType;
      btn.classList.toggle("today-type-switch__btn--active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    if (taskFields) {
      taskFields.hidden = activeType !== "task";
    }

    setNoteBoardPickerVisible(activeType === "note");

    if (textLabel) {
      textLabel.textContent = activeType === "task" ? "Описание" : "Текст";
    }
    if (textInput) {
      textInput.maxLength = activeType === "task" ? 2000 : 4000;
      textInput.placeholder =
        activeType === "task" ? "Детали, контекст…" : "Содержание заметки…";
    }

    const titleInput = form && form.querySelector('[name="title"]');
    if (titleInput) {
      titleInput.placeholder =
        activeType === "task" ? "Кратко, о чём задача" : "Кратко, о чём заметка";
    }

    showFormError("");
  }

  function updateBoardColAddButtons(formOpen) {
    document.querySelectorAll("[data-board-add-home]").forEach(function (btn) {
      const isActive =
        formOpen &&
        activeType === "task" &&
        activeBoardRoute &&
        btn.dataset.boardAddHome === activeBoardRoute;
      btn.setAttribute("aria-expanded", String(isActive));
      btn.classList.toggle("page-head__add--active", isActive);
    });
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
    activeBoardRoute = boardSelect.value;
    showFormError("");
    if (modal && !modal.hidden) {
      updateBoardColAddButtons(true);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    activeBoardRoute = null;
    showFormError("");
    updateBoardColAddButtons(false);
    if (formToggle) {
      formToggle.setAttribute("aria-expanded", "false");
      formToggle.classList.remove("page-head__add--active");
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function openModal(options) {
    const opts = options || {};
    if (!modal || !form) return;

    lastFocus = document.activeElement;
    setCreateType(opts.type || "note");

    if (opts.type === "task" && opts.boardRoute && boardSelect) {
      boardSelect.value = opts.boardRoute;
      fillSectionSelect(opts.boardRoute);
      if (sectionSelect && opts.section) {
        sectionSelect.value = opts.section;
      }
      activeBoardRoute = opts.boardRoute;
    } else if (boardSelect) {
      boardSelect.value = "ideas";
      fillSectionSelect("ideas");
      activeBoardRoute = null;
    }

    form.reset();
    resetPickers();
    if (opts.type === "task") {
      handleBoardChange();
    } else {
      setCreateType("note");
    }

    modal.hidden = false;
    document.body.classList.add("modal-open");

    if (formToggle) {
      const fromBoardCol = !!(opts.boardRoute && opts.type === "task");
      formToggle.setAttribute("aria-expanded", String(!fromBoardCol));
      formToggle.classList.toggle("page-head__add--active", !fromBoardCol);
    }
    updateBoardColAddButtons(true);

    const titleInput = form.querySelector('[name="title"]');
    if (titleInput) {
      window.requestAnimationFrame(function () {
        titleInput.focus();
      });
    }
  }

  function openFormForBoard(boardRoute, section) {
    if (modal && !modal.hidden && activeType === "task" && activeBoardRoute === boardRoute) {
      closeModal();
      return;
    }

    openModal({
      type: "task",
      boardRoute: boardRoute,
      section: section,
    });

    const todaySection = document.querySelector(".glass-bar--today");
    if (todaySection) {
      window.requestAnimationFrame(function () {
        todaySection.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function submitNote(payload) {
    if (!window.PronoteNotes || typeof window.PronoteNotes.add !== "function") {
      return false;
    }

    return window.PronoteNotes.add({
      title: payload.title,
      text: payload.text,
      projectId: payload.projectId,
      assigneeId: payload.assigneeId,
      boardLink: payload.boardLink,
    });
  }

  function submitTask(payload) {
    const handler =
      window.PronoteBoardHandlers && window.PronoteBoardHandlers[payload.boardRoute];
    if (!handler || typeof handler.addItem !== "function") {
      return false;
    }

    return handler.addItem({
      title: payload.title,
      text: payload.text,
      comment: payload.comment,
      status: payload.section,
      projectId: payload.projectId,
      assigneeId: payload.assigneeId,
    });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!form) return;

    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const text = String(fd.get("text") || "").trim();

    if (!title) {
      showFormError(
        activeType === "task" ? "Введите заголовок задачи." : "Введите заголовок заметки."
      );
      return;
    }

    const projectId =
      window.PronoteProjectPicker && typeof window.PronoteProjectPicker.resolve === "function"
        ? window.PronoteProjectPicker.resolve(form)
        : null;
    const assigneeId =
      window.PronoteAssigneePicker && typeof window.PronoteAssigneePicker.resolve === "function"
        ? window.PronoteAssigneePicker.resolve(form)
        : null;

    let ok = false;

    if (activeType === "note") {
      ok = submitNote({
        title: title,
        text: text,
        projectId: projectId,
        assigneeId: assigneeId,
        boardLink: resolveBoardLink(form),
      });
      if (!ok) {
        showFormError("Не удалось сохранить заметку.");
        return;
      }
    } else {
      if (!boardSelect || !sectionSelect) return;
      ok = submitTask({
        title: title,
        text: text,
        comment: String(fd.get("comment") || ""),
        boardRoute: boardSelect.value,
        section: sectionSelect.value,
        projectId: projectId,
        assigneeId: assigneeId,
      });
      if (!ok) {
        showFormError("Не удалось сохранить задачу.");
        return;
      }
      if (boardSelect.value === "urgent" && typeof window.renderHomeUrgentPreview === "function") {
        window.renderHomeUrgentPreview();
      }
    }

    refreshPickers();
    closeModal();
    renderHomeToday();
  }

  typeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setCreateType(btn.dataset.todayType);
    });
  });

  if (boardSelect) {
    boardSelect.addEventListener("change", handleBoardChange);
    fillSectionSelect(boardSelect.value);
  }

  if (form) {
    form.addEventListener("submit", handleFormSubmit);
    form.addEventListener("input", function () {
      showFormError("");
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
      if (modal && modal.hidden) {
        openModal({ type: "note" });
      } else {
        closeModal();
      }
    });
  }

  if (modalCancel) {
    modalCancel.addEventListener("click", closeModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  window.addEventListener("keydown", function (e) {
    if (!modal || modal.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  });

  window.renderHomeToday = renderHomeToday;
  window.openTodayFormForBoard = openFormForBoard;
  renderHomeToday();
})();
