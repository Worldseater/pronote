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
      normalizeStatus: null,
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
      normalizeStatus: null,
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

  const createForm = document.getElementById("projectCreateForm");
  const createError = document.getElementById("projectCreateError");
  const createFormPanel = document.getElementById("projectCreateFormPanel");
  const createFormToggle = document.getElementById("projectCreateFormToggle");
  const createFormClose = document.getElementById("projectCreateFormClose");
  const colorsEl = document.getElementById("projectCreateColors");
  const listEl = document.getElementById("projectsPageList");
  const metaEl = document.getElementById("projectsPageMeta");

  let selectedColor =
    window.PronoteProjects && window.PronoteProjects.DEFAULT_COLORS
      ? window.PronoteProjects.DEFAULT_COLORS[0]
      : "#60a5fa";

  function pluralRuTasks(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "задач";
    if (n1 > 1 && n1 < 5) return "задачи";
    if (n1 === 1) return "задача";
    return "задач";
  }

  function pluralRuNotes(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "заметок";
    if (n1 > 1 && n1 < 5) return "заметки";
    if (n1 === 1) return "заметка";
    return "заметок";
  }

  function formatEntityMeta(taskCount, noteCount) {
    return (
      taskCount +
      " " +
      pluralRuTasks(taskCount) +
      " · " +
      noteCount +
      " " +
      pluralRuNotes(noteCount)
    );
  }

  function pluralRuProjects(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "проектов";
    if (n1 > 1 && n1 < 5) return "проекта";
    if (n1 === 1) return "проект";
    return "проектов";
  }

  function showCreateError(message) {
    if (!createError) return;
    if (!message) {
      createError.hidden = true;
      createError.textContent = "";
      return;
    }
    createError.hidden = false;
    createError.textContent = message;
  }

  function setCreateFormOpen(open) {
    if (!createFormPanel) return;
    createFormPanel.hidden = !open;
    if (createFormToggle) {
      createFormToggle.setAttribute("aria-expanded", String(open));
      createFormToggle.classList.toggle("page-head__add--active", open);
    }
    if (open && createForm) {
      const nameInput = createForm.querySelector('[name="name"]');
      if (nameInput) {
        window.requestAnimationFrame(function () {
          nameInput.focus();
        });
      }
    }
  }

  function getSectionLabel(board, status) {
    const section = (board.sections || []).find(function (entry) {
      return entry.id === status;
    });
    return section ? section.label : "";
  }

  function collectActiveTasks() {
    const tasks = [];

    BOARDS.forEach(function (board) {
      try {
        const raw = localStorage.getItem(board.storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        parsed.forEach(function (item) {
          if (item.completedAt) return;

          let status = item.status || board.defaultSection;
          if (board.normalizeStatus) {
            status = board.normalizeStatus(status);
          }

          tasks.push({
            id: item.id,
            title: item.title || "Без названия",
            createdAt: item.createdAt,
            route: board.route,
            boardTag: board.tag,
            statusLabel: getSectionLabel(board, status),
            projectId: item.projectId || null,
          });
        });
      } catch (err) {
        console.warn("Pronote: чтение задач проекта", board.storageKey, err);
      }
    });

    tasks.sort(function (a, b) {
      return a.title.localeCompare(b.title, "ru");
    });

    return tasks;
  }

  function collectNotes() {
    let notes = [];

    if (window.PronoteNotes && typeof window.PronoteNotes.getAll === "function") {
      notes = window.PronoteNotes.getAll();
    } else {
      try {
        const raw = localStorage.getItem("pronote.notes.v1");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        notes = parsed.filter(function (note) {
          return note && (note.title || "").trim();
        });
      } catch (err) {
        console.warn("Pronote: чтение заметок проекта", err);
        return [];
      }
    }

    return notes
      .map(function (note) {
        return {
          id: note.id,
          title: note.title || "Без названия",
          createdAt: note.createdAt,
          projectId: note.projectId || null,
        };
      })
      .sort(function (a, b) {
        return a.title.localeCompare(b.title, "ru");
      });
  }

  function refreshAfterProjectChange() {
    if (
      window.PronoteProjectPicker &&
      typeof window.PronoteProjectPicker.refreshAll === "function"
    ) {
      window.PronoteProjectPicker.refreshAll();
    }
    if (typeof window.renderHomeToday === "function") {
      window.renderHomeToday();
    }
    if (typeof window.renderAllTasksPage === "function") {
      window.renderAllTasksPage();
    }
    if (typeof window.renderNotesPage === "function") {
      window.renderNotesPage();
    }
    renderProjectsPage();
  }

  function confirmDeleteProject(project) {
    if (!project || !window.PronoteProjects) return;

    const runDelete = function () {
      const result = window.PronoteProjects.deleteProject(project.id);
      if (result.ok) {
        refreshAfterProjectChange();
      }
    };

    if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
      window.PronoteConfirm.open({
        title: "Удалить проект?",
        message:
          "«" +
          project.name +
          "» будет удалён. Задачи и заметки останутся, но без привязки к проекту.",
        confirmLabel: "Удалить",
        onConfirm: function () {
          window.PronoteConfirm.open({
            title: "Вы точно-точно хотите удалить проект?",
            message:
              "«" +
              project.name +
              "» будет удалён без возможности восстановления.",
            confirmLabel: "Удалить",
            swapButtons: true,
            preserveFocus: true,
            onConfirm: runDelete,
          });
        },
      });
      return;
    }

    runDelete();
  }

  function renderProjectBlock(project, tasks, notes) {
    const taskItems = tasks || [];
    const noteItems = notes || [];
    const section = document.createElement("section");
    section.className = "ideas-section projects-page__section";

    const block = document.createElement("div");
    block.className = "ideas-block glass-panel";

    const head = document.createElement("header");
    head.className = "ideas-block__head page-head projects-block__head";
    head.style.setProperty("--project-color", project.color);

    const content = document.createElement("div");
    content.className = "page-head__content";

    const eyebrow = document.createElement("p");
    eyebrow.className = "page-head__eyebrow";
    eyebrow.textContent = "Проект";

    const title = document.createElement("h2");
    title.className = "page-head__title";
    title.textContent = project.name;

    const meta = document.createElement("p");
    meta.className = "page-head__meta";
    meta.textContent = formatEntityMeta(taskItems.length, noteItems.length);

    content.appendChild(eyebrow);
    content.appendChild(title);
    content.appendChild(meta);
    head.appendChild(content);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "projects-block__delete btn-ghost glass";
    deleteBtn.setAttribute("aria-label", "Удалить проект " + project.name);
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", function () {
      confirmDeleteProject(project);
    });
    head.appendChild(deleteBtn);

    block.appendChild(head);

    const body = document.createElement("div");
    body.className = "ideas-block__body";

    const list = document.createElement("ul");
    list.className = "today-list projects-page__tasks";
    list.setAttribute("aria-label", "Задачи и заметки проекта " + project.name);

    if (taskItems.length === 0 && noteItems.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Нет активных задач и заметок";
      list.appendChild(li);
    } else {
      taskItems.forEach(function (task) {
        if (window.PronoteRenderHomeTaskRow) {
          window.PronoteRenderHomeTaskRow(list, {
            title: task.title,
            boardTag: task.boardTag,
            statusLabel: task.statusLabel,
            createdAt: task.createdAt,
            hideProject: true,
            onTitleClick: function () {
              if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
                window.PronoteEditItem.open(task.route, task.id);
              }
            },
          });
        }
      });

      noteItems.forEach(function (note) {
        if (window.PronoteRenderHomeTaskRow) {
          window.PronoteRenderHomeTaskRow(list, {
            title: note.title,
            boardTag: "Заметка",
            statusLabel: "",
            createdAt: note.createdAt,
            hideProject: true,
            onTitleClick: function () {
              if (
                window.PronoteNotes &&
                typeof window.PronoteNotes.openEdit === "function"
              ) {
                window.PronoteNotes.openEdit(note.id);
              }
            },
          });
        }
      });
    }

    body.appendChild(list);
    block.appendChild(body);
    section.appendChild(block);
    return section;
  }

  function renderProjectsPage() {
    if (!listEl) return;

    const api = window.PronoteProjects;
    if (!api) return;

    const projects = api.getAll();
    const tasks = collectActiveTasks();
    const notes = collectNotes();
    const tasksByProject = {};
    const notesByProject = {};

    tasks.forEach(function (task) {
      const key = task.projectId || "__none__";
      if (!tasksByProject[key]) {
        tasksByProject[key] = [];
      }
      tasksByProject[key].push(task);
    });

    notes.forEach(function (note) {
      const key = note.projectId || "__none__";
      if (!notesByProject[key]) {
        notesByProject[key] = [];
      }
      notesByProject[key].push(note);
    });

    listEl.innerHTML = "";

    if (metaEl) {
      metaEl.textContent = projects.length + " " + pluralRuProjects(projects.length);
    }

    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "projects-page__empty";
      empty.textContent = "Создайте первый проект с помощью формы выше.";
      listEl.appendChild(empty);
      return;
    }

    projects.forEach(function (project) {
      const projectTasks = tasksByProject[project.id] || [];
      const projectNotes = notesByProject[project.id] || [];
      listEl.appendChild(renderProjectBlock(project, projectTasks, projectNotes));
    });
  }

  function initColorPicker() {
    if (!colorsEl || !window.PronoteProjects) return;

    colorsEl.innerHTML = "";
    window.PronoteProjects.DEFAULT_COLORS.forEach(function (color, index) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "project-picker__color" +
        (index === 0 ? " project-picker__color--active" : "");
      btn.dataset.color = color;
      btn.style.setProperty("--swatch", color);
      btn.setAttribute("aria-label", "Цвет " + (index + 1));
      btn.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      btn.addEventListener("click", function () {
        selectedColor = color;
        colorsEl.querySelectorAll(".project-picker__color").forEach(function (item) {
          const isActive = item.dataset.color === color;
          item.classList.toggle("project-picker__color--active", isActive);
          item.setAttribute("aria-pressed", String(isActive));
        });
      });
      colorsEl.appendChild(btn);
    });
  }

  if (createForm) {
    createForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!window.PronoteProjects) return;

      const fd = new FormData(createForm);
      const name = String(fd.get("name") || "").trim();
      if (!name) {
        showCreateError("Введите название проекта.");
        return;
      }

      const result = window.PronoteProjects.createProject({
        name: name,
        color: selectedColor,
      });

      if (!result.ok) {
        if (result.error === "duplicate") {
          showCreateError("Проект с таким названием уже есть.");
        } else {
          showCreateError("Не удалось создать проект.");
        }
        return;
      }

      createForm.reset();
      showCreateError("");
      initColorPicker();
      setCreateFormOpen(false);

      if (
        window.PronoteProjectPicker &&
        typeof window.PronoteProjectPicker.refreshAll === "function"
      ) {
        window.PronoteProjectPicker.refreshAll();
      }

      renderProjectsPage();
    });

    createForm.addEventListener("input", function () {
      showCreateError("");
    });
  }

  if (createFormToggle) {
    createFormToggle.addEventListener("click", function () {
      const open = createFormPanel && createFormPanel.hidden;
      setCreateFormOpen(open);
    });
  }

  if (createFormClose) {
    createFormClose.addEventListener("click", function () {
      setCreateFormOpen(false);
    });
  }

  setCreateFormOpen(false);
  initColorPicker();

  (function removeMistakenMedikaOldProject() {
    const cleanupKey = "pronote.cleanup.medika-old.v1";
    if (localStorage.getItem(cleanupKey)) return;
    const api = window.PronoteProjects;
    if (!api || typeof api.findByName !== "function" || typeof api.deleteProject !== "function") {
      return;
    }
    const mistaken = api.findByName("медика-олд");
    if (mistaken && api.deleteProject(mistaken.id).ok) {
      localStorage.setItem(cleanupKey, "1");
      if (
        window.PronoteProjectPicker &&
        typeof window.PronoteProjectPicker.refreshAll === "function"
      ) {
        window.PronoteProjectPicker.refreshAll();
      }
    }
  })();

  window.renderProjectsPage = renderProjectsPage;
  renderProjectsPage();
})();
