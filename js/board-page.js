(function () {
  window.PronoteBoardHandlers = window.PronoteBoardHandlers || {};
  window.PronoteBoardMeta = window.PronoteBoardMeta || {};

  function createCommentId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "comment-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function createComment(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    return {
      id: createCommentId(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
  }

  function normalizeComments(comments) {
    if (!Array.isArray(comments)) return [];
    return comments.filter(function (comment) {
      return comment && (comment.text || "").trim();
    });
  }

  function appendComment(comments, text) {
    const next = normalizeComments(comments).slice();
    const comment = createComment(text);
    if (comment) next.push(comment);
    return next;
  }

  window.PronoteAppendComment = appendComment;

  function pluralRu(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  window.PronoteInitBoard = function (config) {
    const boardId = config.id;
    const statuses = config.sections.map(function (s) {
      return s.id;
    });

    const listEls = {};
    const bodyEls = {};
    const metaEls = {};

    statuses.forEach(function (status) {
      listEls[status] = document.querySelector(
        '[data-board-list="' + boardId + '"][data-section="' + status + '"]'
      );
      bodyEls[status] = document.querySelector(
        '[data-board-body="' + boardId + '"][data-section="' + status + '"]'
      );
      metaEls[status] = document.querySelector(
        '[data-board-meta="' + boardId + '"][data-section="' + status + '"]'
      );
    });

    const form = config.formId ? document.getElementById(config.formId) : null;
    const formError = config.formErrorId ? document.getElementById(config.formErrorId) : null;
    const formPanel = config.formPanelId ? document.getElementById(config.formPanelId) : null;
    const formToggle = config.formToggleId ? document.getElementById(config.formToggleId) : null;
    const formOpenBtns = document.querySelectorAll('[data-board-add="' + boardId + '"]');
    const defaultSection = config.addSection || statuses[0];
    let activeAddSection = defaultSection;

    if (!listEls[defaultSection]) return null;
    if (config.formId && !form) return null;

    function loadItems() {
      try {
        const raw = localStorage.getItem(config.storageKey);
        if (!raw) {
          const seed = config.seed || [];
          if (seed.length) saveItems(seed);
          return seed.slice();
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return (config.seed || []).slice();
        return parsed.map(function (item) {
          return Object.assign({}, item, {
            status: statuses.includes(item.status) ? item.status : defaultSection,
            comments: normalizeComments(item.comments),
          });
        });
      } catch (err) {
        console.warn("Pronote: ошибка чтения " + boardId, err);
        return (config.seed || []).slice();
      }
    }

    function saveItems(items) {
      localStorage.setItem(config.storageKey, JSON.stringify(items));
    }

    function createId() {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return boardId + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
    }

    function formatDate(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
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

    function renderCommentsHtml(comments) {
      const list = normalizeComments(comments);
      if (!list.length) return "";
      let html = '<ul class="idea-card__comments">';
      list.forEach(function (comment) {
        const dateStr = formatCommentDate(comment.createdAt);
        html += '<li class="idea-card__comment">';
        html +=
          '<p class="idea-card__comment-text">' + escapeHtml(comment.text) + "</p>";
        if (dateStr) {
          html +=
            '<time class="idea-card__comment-date" datetime="' +
            escapeHtml(comment.createdAt || "") +
            '">' +
            escapeHtml(dateStr) +
            "</time>";
        }
        html += "</li>";
      });
      html += "</ul>";
      return html;
    }

    function updateMeta(status, count) {
      const el = metaEls[status];
      if (!el) return;
      if (count === 0) {
        el.textContent = config.emptyMeta;
        return;
      }
      el.textContent = count + " " + config.plural(count);
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function canDelete(status) {
      if (!config.deleteSections) return false;
      return config.deleteSections.indexOf(status) !== -1;
    }

    function getTagLabel() {
      return config.itemTag || "";
    }

    function openEditModal(itemId) {
      if (window.PronoteEditItem && typeof window.PronoteEditItem.open === "function") {
        window.PronoteEditItem.open(boardId, itemId);
      }
    }

    function renderCard(item) {
      const tag = getTagLabel();
      const dateStr = formatDate(item.createdAt);
      const li = document.createElement("li");
      li.dataset.itemId = item.id;
      const editLabel = config.editAriaLabel || "Редактировать";
      const modifiedClass = item.updatedAt ? " idea-card--modified" : "";
      let html =
        '<article class="idea-card idea-card--inner idea-card--editable' +
        modifiedClass +
        '">';
      if (item.updatedAt) {
        html += '<span class="idea-card__modified">Изменено</span>';
      }
      html +=
        '<div class="idea-card__top">' +
        '<h3 class="idea-card__title">' +
        escapeHtml(item.title) +
        "</h3>" +
        '<div class="idea-card__actions">' +
        '<button type="button" class="idea-card__complete" aria-label="Завершить задачу" title="Завершить">✓</button>' +
        '<button type="button" class="idea-card__edit" aria-label="' +
        escapeHtml(editLabel) +
        '" title="Редактировать">✎</button>';
      if (canDelete(item.status)) {
        html +=
          '<button type="button" class="idea-card__delete" aria-label="' +
          escapeHtml(config.deleteAriaLabel) +
          '" title="Удалить">×</button>';
      }
      html += "</div></div>";
      if (item.text) {
        html += '<p class="idea-card__text">' + escapeHtml(item.text) + "</p>";
      }
      html += renderCommentsHtml(item.comments);
      const projectBadge =
        item.projectId && window.PronoteProjects
          ? window.PronoteProjects.renderBadgeHtml(item.projectId)
          : "";
      if (projectBadge || tag || dateStr) {
        html += '<footer class="idea-card__foot">';
        html += '<div class="idea-card__foot-left">';
        if (projectBadge) {
          html += projectBadge;
        }
        if (tag) {
          html += '<span class="idea-card__tag">' + escapeHtml(tag) + "</span>";
        }
        if (!projectBadge && !tag) {
          html += "<span></span>";
        }
        html += "</div>";
        if (dateStr) {
          html +=
            '<time class="idea-card__date" datetime="' +
            escapeHtml(item.createdAt) +
            '">' +
            escapeHtml(dateStr) +
            "</time>";
        }
        html += "</footer>";
      }
      html += "</article>";
      li.innerHTML = html;
      return li;
    }

    function notifyHomeViews() {
      if (typeof window.renderHomeToday === "function") {
        window.renderHomeToday();
      }
      if (typeof window.renderHomeDone === "function") {
        window.renderHomeDone();
      }
      if (typeof window.renderAllTasksPage === "function") {
        window.renderAllTasksPage();
      }
      if (typeof window.renderProjectsPage === "function") {
        window.renderProjectsPage();
      }
      if (boardId === "urgent" && typeof window.renderHomeUrgentPreview === "function") {
        window.renderHomeUrgentPreview();
      }
    }

    function render() {
      const all = loadItems()
        .filter(function (item) {
          return !item.completedAt;
        })
        .sort(function (a, b) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

      statuses.forEach(function (status) {
        const listEl = listEls[status];
        const bodyEl = bodyEls[status];
        if (!listEl) return;

        const items = all.filter(function (item) {
          return item.status === status;
        });

        listEl.innerHTML = "";
        updateMeta(status, items.length);

        if (items.length === 0) {
          if (bodyEl) bodyEl.hidden = true;
          return;
        }

        if (bodyEl) bodyEl.hidden = false;
        items.forEach(function (item) {
          listEl.appendChild(renderCard(item));
        });
      });

      notifyHomeViews();
    }

    function mountFormInSection(section) {
      if (!formPanel) return;
      const sectionEl = document.getElementById(boardId + "-section-" + section);
      if (!sectionEl) return;
      const block = sectionEl.querySelector(".ideas-block");
      const head = block && block.querySelector(".ideas-block__head");
      if (head) {
        head.insertAdjacentElement("afterend", formPanel);
      }
    }

    function updateAddButtonsState(open) {
      formOpenBtns.forEach(function (btn) {
        const isActive = open && btn.dataset.section === activeAddSection;
        btn.setAttribute("aria-expanded", String(isActive));
        btn.classList.toggle("page-head__add--active", isActive);
      });
    }

    function setFormPanelOpen(open) {
      if (!formPanel) return;
      formPanel.hidden = !open;
      updateAddButtonsState(open);
      if (formToggle) {
        formToggle.setAttribute("aria-expanded", String(open));
      }
      if (open && form) {
        const titleInput = form.querySelector('[name="title"]');
        if (titleInput) {
          window.requestAnimationFrame(function () {
            titleInput.focus();
          });
        }
      }
    }

    function openFormPanel(section) {
      activeAddSection = section || activeAddSection;
      mountFormInSection(activeAddSection);
      setFormPanelOpen(true);
      if (window.PronoteRouter) {
        window.PronoteRouter.scrollToSection(boardId, activeAddSection);
      }
    }

    function closeFormPanel() {
      setFormPanelOpen(false);
      showError("");
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

    function addItem(data, options) {
      const opts = options || {};
      const title = (data.title || "").trim();
      if (!title) {
        if (!opts.silent) showError(config.titleError);
        return false;
      }

      const status =
        opts.status && statuses.includes(opts.status) ? opts.status : activeAddSection;

      const item = {
        id: createId(),
        title: title,
        text: (data.text || "").trim(),
        status: status,
        createdAt: new Date().toISOString(),
        comments: appendComment([], data.comment),
      };

      if (data.projectId) {
        item.projectId = data.projectId;
      }

      const items = loadItems();
      items.unshift(item);
      saveItems(items);
      render();
      if (!opts.silent) showError("");
      return true;
    }

    function deleteItem(id) {
      removeItem(id);
    }

    function removeItem(id, options) {
      const opts = options || {};
      const items = loadItems();
      const next = items.filter(function (item) {
        return item.id !== id;
      });
      if (next.length === items.length) return false;
      saveItems(next);
      if (!opts.skipRender) render();
      return true;
    }

    function insertItem(item, options) {
      const opts = options || {};
      if (!item || !item.id) return false;
      const items = loadItems();
      items.unshift(item);
      saveItems(items);
      if (!opts.skipRender) render();
      return true;
    }

    function getItemById(id) {
      return (
        loadItems().find(function (item) {
          return item.id === id;
        }) || null
      );
    }

    function completeItem(id) {
      const items = loadItems();
      const index = items.findIndex(function (item) {
        return item.id === id;
      });
      if (index === -1) return false;

      items[index] = Object.assign({}, items[index], {
        completedAt: new Date().toISOString(),
      });
      saveItems(items);
      render();
      return true;
    }

    function updateItem(id, data) {
      const title = (data.title || "").trim();
      if (!title) return false;

      const items = loadItems();
      const index = items.findIndex(function (item) {
        return item.id === id;
      });
      if (index === -1) return false;

      const current = items[index];
      const nextStatus =
        data.status && statuses.includes(data.status) ? data.status : current.status;

      const updated = Object.assign({}, current, {
        title: title,
        text: (data.text || "").trim(),
        status: nextStatus,
        comments: appendComment(current.comments, data.comment),
        updatedAt: new Date().toISOString(),
      });

      if (data.projectId) {
        updated.projectId = data.projectId;
      } else {
        delete updated.projectId;
      }

      items[index] = updated;
      saveItems(items);
      render();
      return true;
    }

    function handleListClick(e) {
      const completeBtn = e.target.closest(".idea-card__complete");
      if (completeBtn) {
        const li = completeBtn.closest("li");
        if (!li || !li.dataset.itemId) return;
        completeItem(li.dataset.itemId);
        return;
      }

      const deleteBtn = e.target.closest(".idea-card__delete");
      if (deleteBtn) {
        const li = deleteBtn.closest("li");
        if (!li || !li.dataset.itemId) return;

        const titleNode = li.querySelector(".idea-card__title");
        const itemTitle = titleNode ? titleNode.textContent.trim() : config.deleteFallbackName;

        if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
          window.PronoteConfirm.open({
            title: config.deleteTitle,
            message: "«" + itemTitle + "» " + config.deleteMessageSuffix,
            confirmLabel: "Удалить",
            onConfirm: function () {
              deleteItem(li.dataset.itemId);
            },
          });
        }
        return;
      }

      const editBtn = e.target.closest(".idea-card__edit");
      const card = e.target.closest(".idea-card--editable");
      if (!editBtn && !card) return;

      const li = (editBtn || card).closest("li");
      if (!li || !li.dataset.itemId) return;

      openEditModal(li.dataset.itemId);
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
          title: fd.get("title"),
          text: fd.get("text"),
          comment: fd.get("comment"),
          projectId:
            window.PronoteProjectPicker && typeof window.PronoteProjectPicker.resolve === "function"
              ? window.PronoteProjectPicker.resolve(form)
              : null,
        };
        if (addItem(payload)) {
          form.reset();
          if (
            window.PronoteProjectPicker &&
            typeof window.PronoteProjectPicker.reset === "function"
          ) {
            window.PronoteProjectPicker.reset(form);
          }
          if (
            window.PronoteProjectPicker &&
            typeof window.PronoteProjectPicker.refreshAll === "function"
          ) {
            window.PronoteProjectPicker.refreshAll();
          }
          closeFormPanel();
        }
      });

      form.addEventListener("input", function () {
        showError("");
      });

      form.addEventListener("reset", function () {
        window.requestAnimationFrame(function () {
          if (
            window.PronoteProjectPicker &&
            typeof window.PronoteProjectPicker.reset === "function"
          ) {
            window.PronoteProjectPicker.reset(form);
          }
        });
      });
    }

    statuses.forEach(function (status) {
      if (listEls[status]) {
        listEls[status].addEventListener("click", handleListClick);
      }
    });

    formOpenBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const section = btn.dataset.section;
        if (!section || statuses.indexOf(section) === -1) return;

        if (formPanel.hidden || activeAddSection !== section) {
          openFormPanel(section);
        } else {
          closeFormPanel();
        }
      });
    });

    if (formToggle) {
      formToggle.addEventListener("click", closeFormPanel);
    }

    setFormPanelOpen(false);

    const api = {
      onNavigate: function (routeName, section) {
        if (routeName !== boardId) return;
        render();
        const sectionKey =
          section ||
          (window.PronoteRouter && window.PronoteRouter.getPendingSection
            ? window.PronoteRouter.getPendingSection()
            : null);
        if (sectionKey && window.PronoteRouter) {
          window.PronoteRouter.scrollToSection(boardId, sectionKey);
        }
      },
      render: render,
      addItem: function (data) {
        return addItem(data, { status: data.status, silent: true });
      },
      getItem: getItemById,
      updateItem: updateItem,
      completeItem: completeItem,
      removeItem: removeItem,
      insertItem: insertItem,
    };

    window.PronoteBoardMeta[boardId] = {
      boardId: boardId,
      boardLabel: config.boardLabel || boardId,
      editTitle: config.editTitle || "Редактировать задачу",
      titleError: config.titleError,
      sections: config.sections,
      defaultSection: defaultSection,
    };

    window.PronoteBoardHandlers[boardId] = api;
    render();
    return api;
  };
})();
