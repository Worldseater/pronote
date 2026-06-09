(function () {
  const STORAGE_KEY = "pronote.notes.v1";
  const pageListEl = document.getElementById("notesPageList");
  const pageMetaEl = document.getElementById("notesPageMeta");
  const pageForm = document.getElementById("notesPageForm");
  const pageFormPanel = document.getElementById("notesPageFormPanel");
  const pageFormToggle = document.getElementById("notesPageFormToggle");
  const pageFormClose = document.getElementById("notesPageFormClose");
  const pageFormError = document.getElementById("notesPageFormError");

  const editModal = document.getElementById("noteEditModal");
  const editBackdrop = document.getElementById("noteEditModalBackdrop");
  const editForm = document.getElementById("noteEditForm");
  const editFormError = document.getElementById("noteEditFormError");
  const editCancelBtn = document.getElementById("noteEditModalCancel");
  const editDeleteBtn = document.getElementById("noteEditModalDelete");
  const editConvertBtn = document.getElementById("noteEditModalConvert");

  let activeNoteId = null;
  let lastFocus = null;

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "note-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (note) {
        return note && (note.title || "").trim();
      });
    } catch (err) {
      console.warn("Pronote: чтение заметок", err);
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function sortNotes(notes) {
    return notes.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getAllNotes() {
    return sortNotes(loadNotes());
  }

  function getNoteById(id) {
    return (
      loadNotes().find(function (note) {
        return note.id === id;
      }) || null
    );
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

  function pluralRuNotes(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "заметок";
    if (n1 > 1 && n1 < 5) return "заметки";
    if (n1 === 1) return "заметка";
    return "заметок";
  }

  function showFormError(el, message) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function setFormPanelOpen(panel, toggle, open) {
    if (!panel) return;
    panel.hidden = !open;
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("page-head__add--active", open);
    }
    if (open) {
      const form = panel.querySelector("form");
      const titleInput = form && form.querySelector('[name="title"]');
      if (titleInput) {
        window.requestAnimationFrame(function () {
          titleInput.focus();
        });
      }
    }
  }

  function resolveProjectId(form) {
    if (
      window.PronoteProjectPicker &&
      typeof window.PronoteProjectPicker.resolve === "function"
    ) {
      return window.PronoteProjectPicker.resolve(form);
    }
    return null;
  }

  function resolveAssigneeId(form) {
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.resolve === "function"
    ) {
      return window.PronoteAssigneePicker.resolve(form);
    }
    return null;
  }

  function resolveBoardLink(form) {
    if (
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.resolve === "function"
    ) {
      return window.PronoteNoteBoardPicker.resolve(form);
    }
    return null;
  }

  function applyBoardLink(target, boardLink) {
    if (boardLink && boardLink.boardRoute && boardLink.section) {
      target.boardRoute = boardLink.boardRoute;
      target.section = boardLink.section;
      return;
    }
    delete target.boardRoute;
    delete target.section;
  }

  function resetNoteFormPickers(form) {
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

  function addNote(data) {
    const title = (data.title || "").trim();
    if (!title) return false;

    const note = {
      id: createId(),
      title: title,
      text: (data.text || "").trim(),
      createdAt: new Date().toISOString(),
    };

    if (data.projectId) {
      note.projectId = data.projectId;
    }
    if (data.assigneeId) {
      note.assigneeId = data.assigneeId;
    }
    applyBoardLink(note, data.boardLink);

    const notes = loadNotes();
    notes.unshift(note);
    saveNotes(notes);
    return true;
  }

  function updateNote(id, data) {
    const title = (data.title || "").trim();
    if (!title) return false;

    const notes = loadNotes();
    const index = notes.findIndex(function (note) {
      return note.id === id;
    });
    if (index === -1) return false;

    const updated = Object.assign({}, notes[index], {
      title: title,
      text: (data.text || "").trim(),
      updatedAt: new Date().toISOString(),
    });

    if (data.projectId) {
      updated.projectId = data.projectId;
    } else {
      delete updated.projectId;
    }
    if (data.assigneeId) {
      updated.assigneeId = data.assigneeId;
    } else {
      delete updated.assigneeId;
    }
    applyBoardLink(updated, data.boardLink);

    notes[index] = updated;
    saveNotes(notes);
    return true;
  }

  function createTaskId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "task-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function resolveTargetBoard(form, note) {
    const boardLink = resolveBoardLink(form);
    if (boardLink && boardLink.boardRoute) {
      return boardLink;
    }
    if (note.boardRoute && note.section) {
      return {
        boardRoute: note.boardRoute,
        section: note.section,
      };
    }
    return {
      boardRoute: "ideas",
      section: "new",
    };
  }

  function getBoardTargetLabel(boardRoute, section) {
    const boardLabel =
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.getBoardLabel === "function"
        ? window.PronoteNoteBoardPicker.getBoardLabel(boardRoute)
        : boardRoute;
    const sectionLabel =
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.getSectionLabel === "function"
        ? window.PronoteNoteBoardPicker.getSectionLabel(boardRoute, section)
        : section;
    return boardLabel + " → " + sectionLabel;
  }

  function notifyTaskViews() {
    if (typeof window.renderHomeToday === "function") {
      window.renderHomeToday();
    }
    if (typeof window.renderHomeDone === "function") {
      window.renderHomeDone();
    }
    if (typeof window.renderHomeUrgentPreview === "function") {
      window.renderHomeUrgentPreview();
    }
    if (typeof window.renderAllTasksPage === "function") {
      window.renderAllTasksPage();
    }
    if (typeof window.renderProjectsPage === "function") {
      window.renderProjectsPage();
    }
    if (typeof window.renderDonePage === "function") {
      window.renderDonePage();
    }
  }

  function readEditFormData() {
    if (!editForm) {
      return {
        title: "",
        text: "",
        projectId: null,
        assigneeId: null,
        form: null,
      };
    }

    const fd = new FormData(editForm);
    return {
      title: String(fd.get("title") || ""),
      text: String(fd.get("text") || ""),
      projectId: resolveProjectId(editForm),
      assigneeId: resolveAssigneeId(editForm),
      form: editForm,
    };
  }

  function convertNoteToTask(noteId, formData) {
    const note = getNoteById(noteId);
    if (!note) {
      return { ok: false, error: "Заметка не найдена." };
    }

    const title = (formData.title || "").trim();
    if (!title) {
      return { ok: false, error: "Введите заголовок заметки." };
    }

    const target = resolveTargetBoard(formData.form, note);
    const boardId = target.boardRoute;
    const handler =
      window.PronoteBoardHandlers && window.PronoteBoardHandlers[boardId];
    const meta = window.PronoteBoardMeta && window.PronoteBoardMeta[boardId];

    if (!handler || typeof handler.insertItem !== "function") {
      return { ok: false, error: "Не удалось создать задачу." };
    }

    const statuses = (meta && meta.sections ? meta.sections : []).map(function (section) {
      return section.id;
    });
    const status =
      target.section && statuses.indexOf(target.section) !== -1
        ? target.section
        : (meta && meta.defaultSection) || statuses[0];

    const task = {
      id: createTaskId(),
      title: title,
      text: (formData.text || "").trim(),
      status: status,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };

    if (formData.projectId) {
      task.projectId = formData.projectId;
    }
    if (formData.assigneeId) {
      task.assigneeId = formData.assigneeId;
    }

    if (!handler.insertItem(task)) {
      return { ok: false, error: "Не удалось создать задачу." };
    }

    deleteNote(noteId);
    notifyTaskViews();
    refreshViews();

    return {
      ok: true,
      boardId: boardId,
      section: status,
      targetLabel: getBoardTargetLabel(boardId, status),
    };
  }

  function finishConvert(result) {
    closeEditModal();

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

    if (window.PronoteApp && typeof window.PronoteApp.navigate === "function") {
      window.PronoteApp.navigate(result.boardId, { section: result.section });
    }
  }

  function deleteNote(id) {
    const notes = loadNotes();
    const next = notes.filter(function (note) {
      return note.id !== id;
    });
    if (next.length === notes.length) return false;
    saveNotes(next);
    return true;
  }

  function renderNoteRow(note, listEl, options) {
    const opts = options || {};
    const li = document.createElement("li");
    li.className =
      "today-list__row notes-list__row" + (opts.home ? " home-note-row" : "");

    if (opts.home) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "home-note-row__title";
      btn.textContent = note.title;
      btn.addEventListener("click", function () {
        openEditModal(note.id);
      });
      li.appendChild(btn);

      const time = document.createElement("time");
      time.className = "home-note-row__time";
      time.dateTime = note.createdAt || "";
      time.textContent = formatDateTime(note.createdAt);
      li.appendChild(time);

      listEl.appendChild(li);
      return;
    }

    const titleCell = document.createElement("div");
    titleCell.className = "today-list__title-cell";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "today-list__title notes-list__title";
    btn.textContent = note.title;
    btn.addEventListener("click", function () {
      openEditModal(note.id);
    });
    titleCell.appendChild(btn);

    if (note.text) {
      const preview = document.createElement("span");
      preview.className = "notes-list__preview";
      preview.textContent = note.text;
      titleCell.appendChild(preview);
    }

    if (note.updatedAt) {
      const modified = document.createElement("span");
      modified.className = "today-list__modified";
      modified.textContent = "Изменено";
      titleCell.appendChild(modified);
    }

    li.appendChild(titleCell);

    const time = document.createElement("time");
    time.className = "today-list__time";
    time.dateTime = note.createdAt || "";
    time.textContent = formatDateTime(note.createdAt);
    li.appendChild(time);

    listEl.appendChild(li);
  }

  function renderHomeNotes() {
    if (typeof window.renderHomeToday === "function") {
      window.renderHomeToday();
    }
  }

  function renderNotesPage() {
    if (!pageListEl) return;

    const items = getAllNotes();
    pageListEl.innerHTML = "";

    if (pageMetaEl) {
      if (items.length === 0) {
        pageMetaEl.textContent = "Нет заметок";
      } else {
        pageMetaEl.textContent = items.length + " " + pluralRuNotes(items.length);
      }
    }

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Заметок пока нет";
      pageListEl.appendChild(li);
      return;
    }

    items.forEach(function (note) {
      renderNoteRow(note, pageListEl);
    });
  }

  function refreshViews() {
    renderHomeNotes();
    renderNotesPage();
  }

  function handleCreateSubmit(form, errorEl, panel, toggle) {
    return function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        showFormError(errorEl, "Введите заголовок заметки.");
        return;
      }

      if (
        !addNote({
          title: title,
          text: String(fd.get("text") || ""),
          projectId: resolveProjectId(form),
          assigneeId: resolveAssigneeId(form),
          boardLink: resolveBoardLink(form),
        })
      ) {
        showFormError(errorEl, "Не удалось сохранить заметку.");
        return;
      }

      form.reset();
      resetNoteFormPickers(form);
      showFormError(errorEl, "");
      setFormPanelOpen(panel, toggle, false);
      refreshViews();
    };
  }

  function closeEditModal() {
    if (!editModal) return;
    editModal.hidden = true;
    document.body.classList.remove("modal-open");
    activeNoteId = null;
    showFormError(editFormError, "");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function openEditModal(noteId) {
    if (!editModal || !editForm) return;
    const note = getNoteById(noteId);
    if (!note) return;

    lastFocus = document.activeElement;
    activeNoteId = noteId;

    const titleInput = editForm.querySelector('[name="title"]');
    const textInput = editForm.querySelector('[name="text"]');
    if (titleInput) titleInput.value = note.title || "";
    if (textInput) textInput.value = note.text || "";
    if (
      window.PronoteNoteBoardPicker &&
      typeof window.PronoteNoteBoardPicker.setValue === "function"
    ) {
      window.PronoteNoteBoardPicker.setValue(
        editForm,
        note.boardRoute || "",
        note.section || ""
      );
    }
    if (
      window.PronoteProjectPicker &&
      typeof window.PronoteProjectPicker.setValue === "function"
    ) {
      window.PronoteProjectPicker.setValue(editForm, note.projectId || "");
    }
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.setValue === "function"
    ) {
      window.PronoteAssigneePicker.setValue(editForm, note.assigneeId || "");
    }
    showFormError(editFormError, "");

    editModal.hidden = false;
    document.body.classList.add("modal-open");

    if (titleInput) {
      window.requestAnimationFrame(function () {
        titleInput.focus();
        titleInput.select();
      });
    }
  }

  function bindForms() {
    if (pageForm) {
      pageForm.addEventListener("submit", handleCreateSubmit(pageForm, pageFormError, pageFormPanel, pageFormToggle));
      pageForm.addEventListener("input", function () {
        showFormError(pageFormError, "");
      });
    }

    if (pageFormToggle) {
      pageFormToggle.addEventListener("click", function () {
        const open = pageFormPanel && pageFormPanel.hidden;
        setFormPanelOpen(pageFormPanel, pageFormToggle, open);
        if (!open) showFormError(pageFormError, "");
      });
    }

    if (pageFormClose) {
      pageFormClose.addEventListener("click", function () {
        setFormPanelOpen(pageFormPanel, pageFormToggle, false);
        showFormError(pageFormError, "");
      });
    }
  }

  function bindEditModal() {
    if (!editForm) return;

    editForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!activeNoteId) return;

      const fd = new FormData(editForm);
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        showFormError(editFormError, "Введите заголовок заметки.");
        return;
      }

      if (
        !updateNote(activeNoteId, {
          title: title,
          text: String(fd.get("text") || ""),
          projectId: resolveProjectId(editForm),
          assigneeId: resolveAssigneeId(editForm),
          boardLink: resolveBoardLink(editForm),
        })
      ) {
        showFormError(editFormError, "Не удалось сохранить заметку.");
        return;
      }

      refreshViews();
      closeEditModal();
    });

    editForm.addEventListener("input", function () {
      showFormError(editFormError, "");
    });

    if (editCancelBtn) {
      editCancelBtn.addEventListener("click", closeEditModal);
    }

    if (editBackdrop) {
      editBackdrop.addEventListener("click", closeEditModal);
    }

    if (editDeleteBtn) {
      editDeleteBtn.addEventListener("click", function () {
        if (!activeNoteId) return;

        const note = getNoteById(activeNoteId);
        const noteTitle = note ? note.title : "Заметка";

        if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
          window.PronoteConfirm.open({
            title: "Удалить заметку?",
            message: "«" + noteTitle + "» будет удалена без возможности восстановления.",
            confirmLabel: "Удалить",
            onConfirm: function () {
              deleteNote(activeNoteId);
              refreshViews();
              closeEditModal();
            },
          });
        } else {
          deleteNote(activeNoteId);
          refreshViews();
          closeEditModal();
        }
      });
    }

    if (editConvertBtn) {
      editConvertBtn.addEventListener("click", function () {
        if (!activeNoteId) return;

        const formData = readEditFormData();
        const title = (formData.title || "").trim();
        if (!title) {
          showFormError(editFormError, "Введите заголовок заметки.");
          return;
        }

        const note = getNoteById(activeNoteId);
        const target = resolveTargetBoard(formData.form, note || {});
        const targetLabel = getBoardTargetLabel(target.boardRoute, target.section);
        const noteTitle = note ? note.title : title;

        function runConvert() {
          const result = convertNoteToTask(activeNoteId, formData);
          if (!result.ok) {
            showFormError(editFormError, result.error || "Не удалось создать задачу.");
            return;
          }
          finishConvert(result);
        }

        if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
          window.PronoteConfirm.open({
            title: "Сделать задачей?",
            message:
              "«" +
              noteTitle +
              "» станет задачей в разделе «" +
              targetLabel +
              "» и будет удалена из заметок.",
            confirmLabel: "Сделать задачей",
            onConfirm: runConvert,
          });
        } else {
          runConvert();
        }
      });
    }

    window.addEventListener("keydown", function (e) {
      if (!editModal || editModal.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeEditModal();
      }
    });
  }

  bindForms();
  bindEditModal();

  window.renderHomeNotes = renderHomeNotes;
  window.renderNotesPage = renderNotesPage;
  window.PronoteNotes = {
    getAll: getAllNotes,
    add: addNote,
    update: updateNote,
    remove: deleteNote,
    getById: getNoteById,
    convertToTask: convertNoteToTask,
    openEdit: openEditModal,
  };

  renderNotesPage();
})();
