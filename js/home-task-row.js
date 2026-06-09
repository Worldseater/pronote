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

  function renderProjectColumn(projectId) {
    const cell = document.createElement("span");
    cell.className = "home-task-row__project-col";

    if (projectId && window.PronoteProjects) {
      const badge = window.PronoteProjects.createBadgeElement(projectId);
      if (badge) {
        cell.appendChild(badge);
        return cell;
      }
    }

    cell.classList.add("home-task-row__project-col--empty");
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  function renderAssigneeColumn(assigneeId) {
    const cell = document.createElement("span");
    cell.className = "home-task-row__assignee-col";

    if (assigneeId && window.PronoteAssignees) {
      const badge = window.PronoteAssignees.createBadgeElement(assigneeId);
      if (badge) {
        cell.appendChild(badge);
        return cell;
      }
    }

    cell.classList.add("home-task-row__assignee-col--empty");
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  function renderHomeTaskRow(listEl, item) {
    const li = document.createElement("li");
    li.className =
      "today-list__row home-task-row" + (item.hideProject ? " home-task-row--compact" : "");

    const titleCell = document.createElement("div");
    titleCell.className = "home-task-row__title-cell";

    const titleEl = document.createElement("button");
    titleEl.type = "button";
    titleEl.className = "home-task-row__title";
    titleEl.textContent = item.title || "Без названия";
    if (item.onTitleClick) {
      titleEl.addEventListener("click", item.onTitleClick);
    }
    titleCell.appendChild(titleEl);
    li.appendChild(titleCell);

    if (!item.hideProject) {
      li.appendChild(renderProjectColumn(item.projectId));
      li.appendChild(renderAssigneeColumn(item.assigneeId));
    }

    const boardEl = document.createElement("span");
    boardEl.className = "home-task-row__board";
    boardEl.textContent = item.boardTag || "";
    li.appendChild(boardEl);

    const statusEl = document.createElement("span");
    statusEl.className =
      "home-task-row__status" + (item.isDone ? " home-task-row__status--done" : "");
    if (item.statusLabel) {
      statusEl.textContent = item.statusLabel;
      li.appendChild(statusEl);
    } else {
      statusEl.setAttribute("aria-hidden", "true");
      statusEl.classList.add("home-task-row__status--empty");
      li.appendChild(statusEl);
    }

    if (item.createdAt) {
      const dateEl = document.createElement("time");
      dateEl.className = "home-task-row__date";
      dateEl.dateTime = item.createdAt;
      dateEl.textContent = formatTaskCreatedAt(item.createdAt);
      li.appendChild(dateEl);
    }

    listEl.appendChild(li);
    return li;
  }

  window.PronoteRenderHomeTaskRow = renderHomeTaskRow;
})();
