(function () {
  const BOARDS = [
    {
      route: "ideas",
      storageKey: "pronote.ideas.v1",
      tag: "Идея",
      boardLabel: "Идеи",
      defaultSection: "new",
      normalizeStatus: null,
    },
    {
      route: "dev",
      storageKey: "pronote.dev.v1",
      tag: "Разработка",
      boardLabel: "Разработка",
      defaultSection: "planned",
      normalizeStatus: null,
    },
    {
      route: "urgent",
      storageKey: "pronote.urgent.v1",
      tag: "Срочно",
      boardLabel: "Срочно",
      defaultSection: "main",
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

  function collectDoneItems() {
    const done = [];

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        if (!item.completedAt) return;

        done.push({
          id: item.id,
          title: item.title || "Без названия",
          completedAt: item.completedAt,
          updatedAt: item.updatedAt,
          route: board.route,
          tag: board.tag,
          boardLabel: board.boardLabel,
        });
      });
    });

    done.sort(function (a, b) {
      return new Date(b.completedAt) - new Date(a.completedAt);
    });

    return done;
  }

  function renderDoneRow(item, listEl) {
    const li = document.createElement("li");
    li.className = "today-list__row done-list__row";

    const titleCell = document.createElement("div");
    titleCell.className = "today-list__title-cell";

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
      renderDoneRow(item, listEl);
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
