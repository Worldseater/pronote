(function () {
  const BOARDS = [
    {
      route: "ideas",
      storageKey: "pronote.ideas.v1",
      tag: "идея",
      sectionHash: {
        new: "#/ideas/new",
        discuss: "#/ideas/discuss",
        discussed: "#/ideas/discussed",
        future: "#/ideas/future",
      },
      defaultSection: "new",
    },
    {
      route: "dev",
      storageKey: "pronote.dev.v1",
      tag: "разработка",
      sectionHash: {
        planned: "#/dev/planned",
        progress: "#/dev/progress",
        postponed: "#/dev/postponed",
        waiting: "#/dev/waiting",
      },
      defaultSection: "planned",
    },
    {
      route: "urgent",
      storageKey: "pronote.urgent.v1",
      tag: "срочно",
      sectionHash: {
        main: "#/urgent",
        bug: "#/urgent",
        block: "#/urgent",
      },
      defaultSection: "main",
      normalizeStatus: function (status) {
        if (status === "bug" || status === "block") return "main";
        return status;
      },
    },
  ];

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

  function collectTodayItems() {
    const today = [];

    BOARDS.forEach(function (board) {
      loadBoardItems(board).forEach(function (item) {
        if (!isCreatedToday(item.createdAt)) return;
        let status = item.status || board.defaultSection;
        if (board.normalizeStatus) {
          status = board.normalizeStatus(status);
        }
        today.push({
          id: item.id,
          title: item.title || "Без названия",
          createdAt: item.createdAt,
          route: board.route,
          section: status,
          href: getItemHash(board, item),
          tag: board.tag,
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
      const li = document.createElement("li");
      li.className = "today-list__row";

      const a = document.createElement("a");
      a.className = "today-list__title";
      a.href = item.href;
      a.setAttribute("data-route", item.route);
      if (item.section) {
        a.setAttribute("data-section", item.section);
      }
      a.textContent = item.title;
      li.appendChild(a);

      const tag = document.createElement("span");
      tag.className = "today-list__tag";
      tag.textContent = item.tag;
      li.appendChild(tag);

      const time = document.createElement("time");
      time.className = "today-list__time";
      time.dateTime = item.createdAt || "";
      time.textContent = formatDateTimeAdded(item.createdAt);
      li.appendChild(time);

      listEl.appendChild(li);
    });
  }

  window.renderHomeToday = renderHomeToday;
  renderHomeToday();
})();
