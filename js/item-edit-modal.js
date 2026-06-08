(function () {
  const BOARD_ORDER = ["ideas", "dev", "urgent"];

  const modal = document.getElementById("editModal");
  const backdrop = document.getElementById("editModalBackdrop");
  const titleEl = document.getElementById("editModalTitle");
  const form = document.getElementById("editItemForm");
  const formError = document.getElementById("editItemFormError");
  const boardSelect = document.getElementById("editBoardSelect");
  const sectionField = document.getElementById("editSectionField");
  const sectionSelect = document.getElementById("editSectionSelect");
  const commentsBlock = document.getElementById("editCommentsBlock");
  const commentsList = document.getElementById("editCommentsList");
  const commentLabel = document.getElementById("editCommentLabel");
  const commentInput = document.getElementById("editCommentInput");
  const cancelBtn = document.getElementById("editModalCancel");
  const completeBtn = document.getElementById("editModalComplete");

  if (!modal || !form || !cancelBtn) return;

  let activeBoardId = null;
  let activeItemId = null;
  let lastFocus = null;

  function getHandler(boardId) {
    return window.PronoteBoardHandlers && window.PronoteBoardHandlers[boardId];
  }

  function getMeta(boardId) {
    return window.PronoteBoardMeta && window.PronoteBoardMeta[boardId];
  }

  function showError(message) {
    if (!formError) return;
    if (!message) {
      formError.hidden = true;
      formError.textContent = "";
      return;
    }
    formError.hidden = false;
    formError.textContent = message;
  }

  function notifyHomeViews() {
    if (typeof window.renderHomeToday === "function") {
      window.renderHomeToday();
    }
    if (typeof window.renderHomeDone === "function") {
      window.renderHomeDone();
    }
    if (typeof window.renderHomeUrgentPreview === "function") {
      window.renderHomeUrgentPreview();
    }
    if (typeof window.renderDonePage === "function") {
      window.renderDonePage();
    }
    if (typeof window.renderAllTasksPage === "function") {
      window.renderAllTasksPage();
    }
    if (typeof window.renderProjectsPage === "function") {
      window.renderProjectsPage();
    }
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    activeBoardId = null;
    activeItemId = null;
    if (commentInput) commentInput.value = "";
    if (commentsList) commentsList.innerHTML = "";
    if (commentsBlock) commentsBlock.hidden = true;
    if (commentLabel) commentLabel.textContent = "Комментарий";
    if (completeBtn) {
      completeBtn.hidden = false;
      completeBtn.disabled = false;
    }
    showError("");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function fillBoardSelect(currentBoardId) {
    if (!boardSelect) return;
    boardSelect.innerHTML = "";
    BOARD_ORDER.forEach(function (boardId) {
      const meta = getMeta(boardId);
      if (!meta) return;
      const option = document.createElement("option");
      option.value = boardId;
      option.textContent = meta.boardLabel || boardId;
      boardSelect.appendChild(option);
    });
    boardSelect.value = currentBoardId;
  }

  function fillSectionSelect(meta, currentStatus) {
    if (!sectionSelect || !sectionField) return;
    sectionSelect.innerHTML = "";
    (meta.sections || []).forEach(function (section) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.title;
      sectionSelect.appendChild(option);
    });

    const statuses = (meta.sections || []).map(function (section) {
      return section.id;
    });
    const status =
      currentStatus && statuses.indexOf(currentStatus) !== -1
        ? currentStatus
        : meta.defaultSection || statuses[0];
    sectionSelect.value = status;
    sectionField.hidden = !meta.sections || meta.sections.length <= 1;
  }

  function syncBoardFields(boardId, item) {
    const meta = getMeta(boardId);
    if (!meta) return;
    fillSectionSelect(meta, item ? item.status : meta.defaultSection);
  }

  function handleBoardChange() {
    if (!boardSelect) return;
    syncBoardFields(boardSelect.value, null);
    showError("");
  }

  function formatCommentDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const datePart = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return datePart + ", " + timePart;
  }

  function renderCommentsList(comments) {
    if (!commentsList || !commentsBlock) return;
    const list = Array.isArray(comments)
      ? comments.filter(function (comment) {
          return comment && (comment.text || "").trim();
        })
      : [];

    commentsList.innerHTML = "";

    if (!list.length) {
      commentsBlock.hidden = true;
      if (commentLabel) commentLabel.textContent = "Комментарий";
      return;
    }

    commentsBlock.hidden = false;
    if (commentLabel) commentLabel.textContent = "Новый комментарий";

    list.forEach(function (comment) {
      const li = document.createElement("li");
      li.className = "comments-list__item";

      const text = document.createElement("p");
      text.className = "comments-list__text";
      text.textContent = comment.text || "";
      li.appendChild(text);

      const dateStr = formatCommentDate(comment.createdAt);
      if (dateStr) {
        const time = document.createElement("time");
        time.className = "comments-list__date";
        time.dateTime = comment.createdAt || "";
        time.textContent = dateStr;
        li.appendChild(time);
      }

      commentsList.appendChild(li);
    });
  }

  function buildPayload() {
    const fd = new FormData(form);
    return {
      title: fd.get("title"),
      text: fd.get("text"),
      comment: fd.get("comment"),
      status: sectionSelect ? sectionSelect.value : undefined,
      projectId:
        window.PronoteProjectPicker && typeof window.PronoteProjectPicker.resolve === "function"
          ? window.PronoteProjectPicker.resolve(form)
          : null,
      assigneeId:
        window.PronoteAssigneePicker && typeof window.PronoteAssigneePicker.resolve === "function"
          ? window.PronoteAssigneePicker.resolve(form)
          : null,
    };
  }

  function moveItem(fromBoardId, toBoardId, itemId, payload) {
    const fromHandler = getHandler(fromBoardId);
    const toHandler = getHandler(toBoardId);
    const toMeta = getMeta(toBoardId);
    if (
      !fromHandler ||
      !toHandler ||
      !toMeta ||
      typeof fromHandler.getItem !== "function" ||
      typeof fromHandler.removeItem !== "function" ||
      typeof toHandler.insertItem !== "function"
    ) {
      return false;
    }

    const item = fromHandler.getItem(itemId);
    if (!item) return false;

    const title = (payload.title || "").trim();
    if (!title) return false;

    const statuses = (toMeta.sections || []).map(function (section) {
      return section.id;
    });
    const status =
      payload.status && statuses.indexOf(payload.status) !== -1
        ? payload.status
        : toMeta.defaultSection || statuses[0];

    const moved = {
      id: item.id,
      title: title,
      text: (payload.text || "").trim(),
      status: status,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString(),
      comments: Array.isArray(item.comments) ? item.comments.slice() : [],
    };

    if (item.completedAt) {
      moved.completedAt = item.completedAt;
    }

    if (payload.projectId) {
      moved.projectId = payload.projectId;
    } else {
      delete moved.projectId;
    }

    if (payload.assigneeId) {
      moved.assigneeId = payload.assigneeId;
    } else {
      delete moved.assigneeId;
    }

    if (window.PronoteAppendComment) {
      moved.comments = window.PronoteAppendComment(moved.comments, payload.comment);
    }

    if (!fromHandler.removeItem(itemId, { skipRender: true })) return false;
    if (!toHandler.insertItem(moved, { skipRender: true })) {
      fromHandler.insertItem(item, { skipRender: true });
      return false;
    }

    fromHandler.render();
    toHandler.render();
    notifyHomeViews();
    return true;
  }

  function open(boardId, itemId) {
    const handler = getHandler(boardId);
    const meta = getMeta(boardId);
    if (!handler || !meta || typeof handler.getItem !== "function") return;

    const item = handler.getItem(itemId);
    if (!item) return;

    lastFocus = document.activeElement;
    activeBoardId = boardId;
    activeItemId = itemId;

    if (titleEl) {
      titleEl.textContent = meta.editTitle || "Редактировать задачу";
    }

    const titleInput = form.querySelector('[name="title"]');
    const textInput = form.querySelector('[name="text"]');
    if (titleInput) titleInput.value = item.title || "";
    if (textInput) textInput.value = item.text || "";
    if (commentInput) commentInput.value = "";
    renderCommentsList(item.comments);

    if (completeBtn) {
      const isDone = !!item.completedAt;
      completeBtn.hidden = isDone;
      completeBtn.disabled = isDone;
    }

    fillBoardSelect(boardId);
    syncBoardFields(boardId, item);
    if (
      window.PronoteProjectPicker &&
      typeof window.PronoteProjectPicker.setValue === "function"
    ) {
      window.PronoteProjectPicker.setValue(form, item.projectId || "");
    }
    if (
      window.PronoteAssigneePicker &&
      typeof window.PronoteAssigneePicker.setValue === "function"
    ) {
      window.PronoteAssigneePicker.setValue(form, item.assigneeId || "");
    }
    showError("");

    modal.hidden = false;
    document.body.classList.add("modal-open");

    if (titleInput) {
      window.requestAnimationFrame(function () {
        titleInput.focus();
        titleInput.select();
      });
    }
  }

  function saveChanges(targetBoardId, payload) {
    const title = (payload.title || "").trim();
    if (!title) {
      const meta = getMeta(targetBoardId) || getMeta(activeBoardId);
      showError((meta && meta.titleError) || "Введите заголовок.");
      return false;
    }

    if (targetBoardId !== activeBoardId) {
      return moveItem(activeBoardId, targetBoardId, activeItemId, payload);
    }

    const handler = getHandler(activeBoardId);
    if (handler && typeof handler.updateItem === "function") {
      return handler.updateItem(activeItemId, payload);
    }

    return false;
  }

  function finishComplete(targetBoardId) {
    const handler = getHandler(targetBoardId);
    if (!handler || typeof handler.completeItem !== "function") return false;
    return handler.completeItem(activeItemId);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!activeBoardId || !activeItemId) return;

    const targetBoardId = boardSelect ? boardSelect.value : activeBoardId;
    const payload = buildPayload();
    const ok = saveChanges(targetBoardId, payload);

    if (!ok) {
      if (!(payload.title || "").trim()) return;
      const meta = getMeta(targetBoardId) || getMeta(activeBoardId);
      showError((meta && meta.titleError) || "Не удалось сохранить задачу.");
      return;
    }

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

    notifyHomeViews();
    close();
  }

  function handleComplete() {
    if (!activeBoardId || !activeItemId) return;

    const targetBoardId = boardSelect ? boardSelect.value : activeBoardId;
    const payload = buildPayload();
    const saved = saveChanges(targetBoardId, payload);

    if (!saved) return;

    if (targetBoardId !== activeBoardId) {
      activeBoardId = targetBoardId;
    }

    if (!finishComplete(targetBoardId)) {
      showError("Не удалось завершить задачу.");
      return;
    }

    notifyHomeViews();
    close();
  }

  if (boardSelect) {
    boardSelect.addEventListener("change", handleBoardChange);
  }

  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", function () {
    showError("");
  });

  cancelBtn.addEventListener("click", close);

  if (completeBtn) {
    completeBtn.addEventListener("click", handleComplete);
  }

  if (backdrop) {
    backdrop.addEventListener("click", close);
  }

  window.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  window.PronoteEditItem = { open: open, close: close };
})();
