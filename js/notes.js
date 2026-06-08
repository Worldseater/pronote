(function () {
  const STORAGE_KEY = "pronote.notes.v1";
  const HOME_NOTES_LIMIT = 3;

  const homeListEl = document.getElementById("homeNotesList");
  const homeForm = document.getElementById("homeNotesForm");
  const homeFormPanel = document.getElementById("homeNotesFormPanel");
  const homeFormToggle = document.getElementById("homeNotesFormToggle");
  const homeFormClose = document.getElementById("homeNotesFormClose");
  const homeFormError = document.getElementById("homeNotesFormError");

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
    applyBoardLink(updated, data.boardLink);

    notes[index] = updated;
    saveNotes(notes);
    return true;
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
    if (!homeListEl) return;

    const allNotes = getAllNotes();
    const items = allNotes.slice(0, HOME_NOTES_LIMIT);
    const restCount = allNotes.length - items.length;
    homeListEl.innerHTML = "";

    if (items.length === 0) {
      return;
    }

    items.forEach(function (note) {
      renderNoteRow(note, homeListEl, { home: true });
    });

    if (restCount > 0) {
      const li = document.createElement("li");
      li.className = "done-list__more";
      const a = document.createElement("a");
      a.href = "#/notes";
      a.setAttribute("data-route", "notes");
      a.textContent = "Ещё " + restCount + "…";
      li.appendChild(a);
      homeListEl.appendChild(li);
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
    if (homeForm) {
      homeForm.addEventListener("submit", handleCreateSubmit(homeForm, homeFormError, homeFormPanel, homeFormToggle));
      homeForm.addEventListener("input", function () {
        showFormError(homeFormError, "");
      });
    }

    if (pageForm) {
      pageForm.addEventListener("submit", handleCreateSubmit(pageForm, pageFormError, pageFormPanel, pageFormToggle));
      pageForm.addEventListener("input", function () {
        showFormError(pageFormError, "");
      });
    }

    if (homeFormToggle) {
      homeFormToggle.addEventListener("click", function () {
        const open = homeFormPanel && homeFormPanel.hidden;
        setFormPanelOpen(homeFormPanel, homeFormToggle, open);
        if (!open) showFormError(homeFormError, "");
      });
    }

    if (homeFormClose) {
      homeFormClose.addEventListener("click", function () {
        setFormPanelOpen(homeFormPanel, homeFormToggle, false);
        showFormError(homeFormError, "");
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
  };

  renderHomeNotes();
})();
