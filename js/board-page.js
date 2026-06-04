(function () {
  window.PronoteBoardHandlers = window.PronoteBoardHandlers || {};

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

    function getTagLabel(source) {
      if (config.sourceLabels && source) {
        return config.sourceLabels[source] || config.sourceLabels.other || "";
      }
      return config.itemTag || "";
    }

    function renderCard(item) {
      const tag = getTagLabel(item.source);
      const dateStr = formatDate(item.createdAt);
      const li = document.createElement("li");
      li.dataset.itemId = item.id;
      let html =
        '<article class="idea-card idea-card--inner">' +
        '<div class="idea-card__top">' +
        '<h3 class="idea-card__title">' +
        escapeHtml(item.title) +
        "</h3>";
      if (canDelete(item.status)) {
        html +=
          '<button type="button" class="idea-card__delete" aria-label="' +
          escapeHtml(config.deleteAriaLabel) +
          '" title="Удалить">×</button>';
      }
      html += "</div>";
      if (item.text) {
        html += '<p class="idea-card__text">' + escapeHtml(item.text) + "</p>";
      }
      if (tag || dateStr) {
        html += '<footer class="idea-card__foot">';
        if (tag) {
          html += '<span class="idea-card__tag">' + escapeHtml(tag) + "</span>";
        } else {
          html += "<span></span>";
        }
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

    function notifyHomeToday() {
      if (typeof window.renderHomeToday === "function") {
        window.renderHomeToday();
      }
    }

    function render() {
      const all = loadItems().sort(function (a, b) {
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

      notifyHomeToday();
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

    function addItem(data) {
      const title = (data.title || "").trim();
      if (!title) {
        showError(config.titleError);
        return false;
      }

      const item = {
        id: createId(),
        title: title,
        text: (data.text || "").trim(),
        status: activeAddSection,
        createdAt: new Date().toISOString(),
      };

      if (config.sourceLabels && data.source) {
        item.source = config.sourceLabels[data.source] ? data.source : "other";
      }

      const items = loadItems();
      items.unshift(item);
      saveItems(items);
      render();
      showError("");
      return true;
    }

    function deleteItem(id) {
      saveItems(
        loadItems().filter(function (item) {
          return item.id !== id;
        })
      );
      render();
    }

    function handleListClick(e) {
      const btn = e.target.closest(".idea-card__delete");
      if (!btn) return;
      const li = btn.closest("li");
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
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
          title: fd.get("title"),
          text: fd.get("text"),
        };
        if (config.sourceLabels) {
          payload.source = fd.get("source");
        }
        if (addItem(payload)) {
          form.reset();
          closeFormPanel();
        }
      });

      form.addEventListener("input", function () {
        showError("");
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
    };

    window.PronoteBoardHandlers[boardId] = api;
    render();
    return api;
  };
})();
