(function () {
  function formatTaskCreatedAt(iso) {
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

  function renderProjectCell(projectId) {
    const cell = document.createElement("span");
    cell.className = "home-task-row__project";

    if (projectId && window.PronoteProjects) {
      const badge = window.PronoteProjects.createBadgeElement(projectId);
      if (badge) {
        cell.appendChild(badge);
      }
    }

    return cell;
  }

  function renderHomeTaskRow(listEl, item) {
    const li = document.createElement("li");
    li.className =
      "today-list__row home-task-row" + (item.hideProject ? " home-task-row--compact" : "");

    const titleEl = document.createElement("button");
    titleEl.type = "button";
    titleEl.className = "home-task-row__title";
    titleEl.textContent = item.title || "Без названия";
    if (item.onTitleClick) {
      titleEl.addEventListener("click", item.onTitleClick);
    }
    li.appendChild(titleEl);

    const boardEl = document.createElement("span");
    boardEl.className = "home-task-row__board";
    boardEl.textContent = item.boardTag || "";
    li.appendChild(boardEl);

    const statusEl = document.createElement("span");
    statusEl.className =
      "home-task-row__status" + (item.isDone ? " home-task-row__status--done" : "");
    statusEl.textContent = item.statusLabel || "";
    li.appendChild(statusEl);

    if (item.createdAt) {
      const dateEl = document.createElement("time");
      dateEl.className = "home-task-row__date";
      dateEl.dateTime = item.createdAt;
      dateEl.textContent = formatTaskCreatedAt(item.createdAt);
      li.appendChild(dateEl);
    }

    if (!item.hideProject) {
      li.appendChild(renderProjectCell(item.projectId));
    }

    listEl.appendChild(li);
    return li;
  }

  window.PronoteRenderHomeTaskRow = renderHomeTaskRow;
})();
