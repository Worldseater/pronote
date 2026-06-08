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

  const createForm = document.getElementById("assigneeCreateForm");
  const createError = document.getElementById("assigneeCreateError");
  const createFormPanel = document.getElementById("assigneeCreateFormPanel");
  const createFormToggle = document.getElementById("assigneeCreateFormToggle");
  const createFormClose = document.getElementById("assigneeCreateFormClose");
  const colorsEl = document.getElementById("assigneeCreateColors");
  const listEl = document.getElementById("assigneesPageList");
  const metaEl = document.getElementById("assigneesPageMeta");

  let selectedColor =
    window.PronoteAssignees && window.PronoteAssignees.DEFAULT_COLORS
      ? window.PronoteAssignees.DEFAULT_COLORS[0]
      : "#60a5fa";

  let draggingAssigneeId = null;
  let dropTarget = null;

  function pluralRuTasks(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "задач";
    if (n1 > 1 && n1 < 5) return "задачи";
    if (n1 === 1) return "задача";
    return "задач";
  }

  function pluralRuAssignees(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "ответственных";
    if (n1 > 1 && n1 < 5) return "ответственных";
    if (n1 === 1) return "ответственный";
    return "ответственных";
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
            assigneeId: item.assigneeId || null,
          });
        });
      } catch (err) {
        console.warn("Pronote: чтение задач ответственного", board.storageKey, err);
      }
    });

    tasks.sort(function (a, b) {
      return a.title.localeCompare(b.title, "ru");
    });

    return tasks;
  }

  function refreshAfterAssigneeChange() {
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.refreshAll === "function"
    ) {
      window.PronoteAssigneePicker.refreshAll();
    }
    if (typeof window.renderHomeToday === "function") {
      window.renderHomeToday();
    }
    if (typeof window.renderAllTasksPage === "function") {
      window.renderAllTasksPage();
    }
    renderAssigneesPage();
  }

  function confirmDeleteAssignee(assignee) {
    if (!assignee || !window.PronoteAssignees) return;

    const runDelete = function () {
      const result = window.PronoteAssignees.deleteAssignee(assignee.id);
      if (result.ok) {
        refreshAfterAssigneeChange();
      }
    };

    if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
      window.PronoteConfirm.open({
        title: "Удалить ответственного?",
        message:
          "«" +
          assignee.name +
          "» будет удалён. Задачи останутся, но без привязки к ответственному.",
        confirmLabel: "Удалить",
        onConfirm: function () {
          window.PronoteConfirm.open({
            title: "Вы точно-точно хотите удалить ответственного?",
            message:
              "«" +
              assignee.name +
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

  function clearDropIndicators() {
    if (!listEl) return;
    listEl.classList.remove("assignees-page__list--drop-end");
    listEl.querySelectorAll(".assignees-page__section").forEach(function (section) {
      section.classList.remove(
        "assignees-page__section--drop-before",
        "assignees-page__section--drop-after"
      );
    });
  }

  function refreshAfterReorder() {
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.refreshAll === "function"
    ) {
      window.PronoteAssigneePicker.refreshAll();
    }
    renderAssigneesPage();
  }

  function moveAssigneeInOrder(draggedId, targetId, insertBefore) {
    const api = window.PronoteAssignees;
    if (!api || typeof api.getAll !== "function" || typeof api.reorderAssignees !== "function") {
      return false;
    }

    const ids = api.getAll().map(function (assignee) {
      return assignee.id;
    });
    const fromIndex = ids.indexOf(draggedId);
    if (fromIndex === -1) return false;

    const next = ids.slice();
    next.splice(fromIndex, 1);

    if (!targetId) {
      next.push(draggedId);
      return api.reorderAssignees(next).ok;
    }

    const toIndex = next.indexOf(targetId);
    if (toIndex === -1) return false;

    const insertAt = insertBefore ? toIndex : toIndex + 1;
    next.splice(insertAt, 0, draggedId);
    return api.reorderAssignees(next).ok;
  }

  function initDragAndDrop() {
    if (!listEl || listEl.dataset.dragInit === "1") return;
    listEl.dataset.dragInit = "1";

    listEl.addEventListener("dragstart", function (e) {
      const handle = e.target.closest(".assignees-block__drag-handle");
      if (!handle) return;

      const section = handle.closest(".assignees-page__section");
      if (!section || !section.dataset.assigneeId) return;

      draggingAssigneeId = section.dataset.assigneeId;
      dropTarget = null;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingAssigneeId);
      section.classList.add("assignees-page__section--dragging");
    });

    listEl.addEventListener("dragend", function () {
      draggingAssigneeId = null;
      dropTarget = null;
      clearDropIndicators();
      listEl.querySelectorAll(".assignees-page__section--dragging").forEach(function (section) {
        section.classList.remove("assignees-page__section--dragging");
      });
    });

    listEl.addEventListener("dragover", function (e) {
      if (!draggingAssigneeId) return;

      const section = e.target.closest(".assignees-page__section");
      if (!section || section.dataset.assigneeId === draggingAssigneeId) {
        if (e.target === listEl || e.target.classList.contains("assignees-page__list")) {
          e.preventDefault();
          clearDropIndicators();
          listEl.classList.add("assignees-page__list--drop-end");
          dropTarget = { targetId: null, insertBefore: false };
        }
        return;
      }

      e.preventDefault();
      const rect = section.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      clearDropIndicators();
      section.classList.add(
        insertBefore
          ? "assignees-page__section--drop-before"
          : "assignees-page__section--drop-after"
      );
      dropTarget = {
        targetId: section.dataset.assigneeId,
        insertBefore: insertBefore,
      };
    });

    listEl.addEventListener("dragleave", function (e) {
      if (!draggingAssigneeId) return;
      if (listEl.contains(e.relatedTarget)) return;
      dropTarget = null;
      clearDropIndicators();
    });

    listEl.addEventListener("drop", function (e) {
      e.preventDefault();
      if (!draggingAssigneeId || !dropTarget) return;

      const draggedId = draggingAssigneeId;
      const ok = moveAssigneeInOrder(
        draggedId,
        dropTarget.targetId,
        dropTarget.insertBefore
      );

      draggingAssigneeId = null;
      dropTarget = null;
      clearDropIndicators();

      if (ok) {
        refreshAfterReorder();
      }
    });
  }

  function renderAssigneeBlock(assignee, tasks) {
    const section = document.createElement("section");
    section.className = "ideas-section assignees-page__section";
    section.dataset.assigneeId = assignee.id;

    const block = document.createElement("div");
    block.className = "ideas-block glass-panel";

    const head = document.createElement("header");
    head.className = "ideas-block__head page-head assignees-block__head";
    head.style.setProperty("--project-color", assignee.color);

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "assignees-block__drag-handle";
    dragHandle.setAttribute("draggable", "true");
    dragHandle.setAttribute("aria-label", "Перетащить блок «" + assignee.name + "»");
    dragHandle.title = "Перетащить";
    head.appendChild(dragHandle);

    const content = document.createElement("div");
    content.className = "page-head__content";

    const eyebrow = document.createElement("p");
    eyebrow.className = "page-head__eyebrow";
    eyebrow.textContent = "Ответственный";

    const title = document.createElement("h2");
    title.className = "page-head__title";
    title.textContent = assignee.name;

    const meta = document.createElement("p");
    meta.className = "page-head__meta";
    meta.textContent = tasks.length + " " + pluralRuTasks(tasks.length);

    content.appendChild(eyebrow);
    content.appendChild(title);
    content.appendChild(meta);
    head.appendChild(content);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "assignees-block__delete btn-ghost glass";
    deleteBtn.setAttribute("aria-label", "Удалить ответственного " + assignee.name);
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", function () {
      confirmDeleteAssignee(assignee);
    });
    head.appendChild(deleteBtn);

    block.appendChild(head);

    const body = document.createElement("div");
    body.className = "ideas-block__body";

    const list = document.createElement("ul");
    list.className = "today-list assignees-page__tasks";
    list.setAttribute("aria-label", "Задачи ответственного " + assignee.name);

    if (tasks.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Нет активных задач";
      list.appendChild(li);
    } else {
      tasks.forEach(function (task) {
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
    }

    body.appendChild(list);
    block.appendChild(body);
    section.appendChild(block);
    return section;
  }

  function renderAssigneesPage() {
    if (!listEl) return;

    const api = window.PronoteAssignees;
    if (!api) return;

    const assignees = api.getAll();
    const tasks = collectActiveTasks();
    const tasksByAssignee = {};

    tasks.forEach(function (task) {
      const key = task.assigneeId || "__none__";
      if (!tasksByAssignee[key]) {
        tasksByAssignee[key] = [];
      }
      tasksByAssignee[key].push(task);
    });

    listEl.innerHTML = "";

    if (metaEl) {
      metaEl.textContent = assignees.length + " " + pluralRuAssignees(assignees.length);
    }

    if (assignees.length === 0) {
      const empty = document.createElement("p");
      empty.className = "assignees-page__empty";
      empty.textContent = "Создайте первого ответственного с помощью формы выше.";
      listEl.appendChild(empty);
      return;
    }

    assignees.forEach(function (assignee) {
      const assigneeTasks = tasksByAssignee[assignee.id] || [];
      listEl.appendChild(renderAssigneeBlock(assignee, assigneeTasks));
    });

    initDragAndDrop();
  }

  function initColorPicker() {
    if (!colorsEl || !window.PronoteAssignees) return;

    colorsEl.innerHTML = "";
    window.PronoteAssignees.DEFAULT_COLORS.forEach(function (color, index) {
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
      if (!window.PronoteAssignees) return;

      const fd = new FormData(createForm);
      const name = String(fd.get("name") || "").trim();
      if (!name) {
        showCreateError("Введите имя ответственного.");
        return;
      }

      const result = window.PronoteAssignees.createAssignee({
        name: name,
        color: selectedColor,
      });

      if (!result.ok) {
        if (result.error === "duplicate") {
          showCreateError("Ответственный с таким именем уже есть.");
        } else {
          showCreateError("Не удалось создать ответственного.");
        }
        return;
      }

      createForm.reset();
      showCreateError("");
      initColorPicker();
      setCreateFormOpen(false);

      if (
        window.PronoteAssigneePicker &&
        typeof window.PronoteAssigneePicker.refreshAll === "function"
      ) {
        window.PronoteAssigneePicker.refreshAll();
      }

      renderAssigneesPage();
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

  window.renderAssigneesPage = renderAssigneesPage;
  renderAssigneesPage();
})();
