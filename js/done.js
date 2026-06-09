(function () {
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

  function loadBoardItems(board) {
    try {
      const raw = localStorage.getItem(board.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn("Pronote: чтение готовых задач", board.storageKey, err);
      return [];
    }
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

  const HOME_DONE_LIMIT = 3;

  function getSectionLabel(board, status) {
    const section = (board.sections || []).find(function (entry) {
      return entry.id === status;
    });
    return section ? section.label : "";
  }

  function collectDoneItems() {
    const done = [];

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        if (!item.completedAt) return;

        let status = item.status || board.defaultSection;
        if (board.normalizeStatus) {
          status = board.normalizeStatus(status);
        }

        done.push({
          id: item.id,
          title: item.title || "Без названия",
          completedAt: item.completedAt,
          updatedAt: item.updatedAt,
          projectId: item.projectId,
          assigneeId: item.assigneeId,
          route: board.route,
          boardTag: board.tag,
          boardLabel: board.boardLabel,
          sectionLabel: getSectionLabel(board, status),
        });
      });
    });

    done.sort(function (a, b) {
      return new Date(b.completedAt) - new Date(a.completedAt);
    });

    return done;
  }

  function deleteDoneItem(item) {
    const handler =
      window.PronoteBoardHandlers && window.PronoteBoardHandlers[item.route];
    if (!handler || typeof handler.removeItem !== "function") return;

    const title = item.title || "Без названия";

    function runDelete() {
      handler.removeItem(item.id);
      renderHomeDone();
      renderDonePage();
    }

    if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
      window.PronoteConfirm.open({
        title: "Удалить задачу?",
        message: "«" + title + "» будет удалена без восстановления.",
        confirmLabel: "Удалить",
        onConfirm: runDelete,
      });
    } else {
      runDelete();
    }
  }

  function renderDoneRow(item, listEl, options) {
    const opts = options || {};

    if (opts.home && window.PronoteRenderHomeTaskRow) {
      window.PronoteRenderHomeTaskRow(listEl, {
        title: item.title,
        boardTag: item.boardTag,
        statusLabel: "Готово",
        projectId: item.projectId,
        assigneeId: item.assigneeId,
        isDone: true,
        onTitleClick: function () {
          if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
            window.PronoteEditItem.open(item.route, item.id);
          }
        },
      });
      return;
    }

    const li = document.createElement("li");
    li.className = "today-list__row done-list__row";

    const titleCell = document.createElement("div");
    titleCell.className = "today-list__title-cell done-list__title-cell";

    const a = document.createElement("a");
    a.className = "today-list__title";
    a.href = "#/done";
    a.setAttribute("data-route", "done");
    a.textContent = item.title;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
        window.PronoteEditItem.open(item.route, item.id);
      }
    });
    titleCell.appendChild(a);

    if (!opts.home) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "done-list__delete";
      deleteButton.setAttribute("aria-label", "Удалить задачу");
      deleteButton.title = "Удалить";
      deleteButton.textContent = "×";
      deleteButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        deleteDoneItem(item);
      });
      titleCell.appendChild(deleteButton);
    }

    if (item.projectId && window.PronoteProjects) {
      const badge = window.PronoteProjects.createBadgeElement(item.projectId);
      if (badge) {
        titleCell.appendChild(badge);
      }
    }

    if (item.assigneeId && window.PronoteAssignees) {
      const badge = window.PronoteAssignees.createBadgeElement(item.assigneeId);
      if (badge) {
        titleCell.appendChild(badge);
      }
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
    tag.textContent = item.boardTag || item.tag;
    li.appendChild(tag);

    const time = document.createElement("time");
    time.className = "today-list__time";
    time.dateTime = item.completedAt || "";
    time.textContent = formatDateTime(item.completedAt);
    li.appendChild(time);

    listEl.appendChild(li);
  }

  function renderHomeDone() {
    const listEl = document.getElementById("homeDoneList");
    if (!listEl) return;

    const allDone = collectDoneItems();
    const items = allDone.slice(0, HOME_DONE_LIMIT);
    const restCount = allDone.length - items.length;
    listEl.innerHTML = "";

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Завершённых задач пока нет";
      listEl.appendChild(li);
      return;
    }

    items.forEach(function (item) {
      renderDoneRow(item, listEl, { home: true });
    });

    if (restCount > 0) {
      const li = document.createElement("li");
      li.className = "done-list__more";
      const a = document.createElement("a");
      a.href = "#/done";
      a.setAttribute("data-route", "done");
      a.textContent = "Ещё " + restCount + "…";
      li.appendChild(a);
      listEl.appendChild(li);
    }
  }

  function pluralRuDone(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return "задач";
    if (n1 > 1 && n1 < 5) return "задачи";
    if (n1 === 1) return "задача";
    return "задач";
  }

  function renderDonePage() {
    const listEl = document.getElementById("donePageList");
    const metaEl = document.getElementById("donePageMeta");
    if (!listEl) return;

    const items = collectDoneItems();
    listEl.innerHTML = "";

    if (metaEl) {
      if (items.length === 0) {
        metaEl.textContent = "Нет завершённых задач";
      } else {
        metaEl.textContent = items.length + " " + pluralRuDone(items.length);
      }
    }

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "today-list__empty";
      li.textContent = "Завершённых задач пока нет";
      listEl.appendChild(li);
      return;
    }

    items.forEach(function (item) {
      renderDoneRow(item, listEl);
    });
  }

  window.renderHomeDone = renderHomeDone;
  window.renderDonePage = renderDonePage;
  renderHomeDone();
})();
