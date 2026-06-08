(function () {
  const STORAGE_KEY = "pronote.assignees.v1";
  const TASK_STORAGE_KEYS = [
    "pronote.ideas.v1",
    "pronote.dev.v1",
    "pronote.urgent.v1",
    "pronote.notes.v1",
  ];

  const DEFAULT_COLORS =
    window.PronoteColorPalette && window.PronoteColorPalette.DEFAULT_COLORS
      ? window.PronoteColorPalette.DEFAULT_COLORS
      : ["#60a5fa"];

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "assignee-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeName(name) {
    return String(name || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function loadAssignees() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (assignee) {
          return assignee && normalizeName(assignee.name);
        })
        .map(function (assignee) {
          return {
            id: assignee.id || createId(),
            name: normalizeName(assignee.name),
            color: assignee.color || DEFAULT_COLORS[0],
          };
        });
    } catch (err) {
      console.warn("Pronote: чтение ответственных", err);
      return [];
    }
  }

  function saveAssignees(assignees) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignees));
  }

  function getAll() {
    return loadAssignees();
  }

  function getById(id) {
    if (!id) return null;
    return (
      loadAssignees().find(function (assignee) {
        return assignee.id === id;
      }) || null
    );
  }

  function findByName(name) {
    const normalized = normalizeName(name).toLowerCase();
    if (!normalized) return null;
    return (
      loadAssignees().find(function (assignee) {
        return normalizeName(assignee.name).toLowerCase() === normalized;
      }) || null
    );
  }

  function pickColor(color) {
    if (window.PronoteColorPalette && typeof window.PronoteColorPalette.pickColor === "function") {
      return window.PronoteColorPalette.pickColor(color);
    }
    if (color && DEFAULT_COLORS.indexOf(color) !== -1) {
      return color;
    }
    return DEFAULT_COLORS[0];
  }

  function clearAssigneeFromTasks(assigneeId) {
    TASK_STORAGE_KEYS.forEach(function (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        let changed = false;
        const next = parsed.map(function (item) {
          if (!item || item.assigneeId !== assigneeId) return item;
          const copy = Object.assign({}, item);
          delete copy.assigneeId;
          changed = true;
          return copy;
        });

        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch (err) {
        console.warn("Pronote: сброс ответственного в задачах", storageKey, err);
      }
    });
  }

  function deleteAssignee(id) {
    if (!id) {
      return { ok: false, error: "id" };
    }

    const assignees = loadAssignees();
    const index = assignees.findIndex(function (assignee) {
      return assignee.id === id;
    });

    if (index === -1) {
      return { ok: false, error: "not_found" };
    }

    assignees.splice(index, 1);
    saveAssignees(assignees);
    clearAssigneeFromTasks(id);
    return { ok: true };
  }

  function reorderAssignees(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { ok: false, error: "ids" };
    }

    const assignees = loadAssignees();
    const byId = {};
    assignees.forEach(function (assignee) {
      byId[assignee.id] = assignee;
    });

    const reordered = [];
    const seen = {};

    orderedIds.forEach(function (id) {
      if (!id || seen[id] || !byId[id]) return;
      seen[id] = true;
      reordered.push(byId[id]);
    });

    assignees.forEach(function (assignee) {
      if (!seen[assignee.id]) {
        reordered.push(assignee);
      }
    });

    if (reordered.length !== assignees.length) {
      return { ok: false, error: "mismatch" };
    }

    saveAssignees(reordered);
    return { ok: true };
  }

  function createAssignee(data) {
    const name = normalizeName(data && data.name);
    if (!name) {
      return { ok: false, error: "name" };
    }

    if (findByName(name)) {
      return { ok: false, error: "duplicate" };
    }

    const assignee = {
      id: createId(),
      name: name,
      color: pickColor(data && data.color),
    };
    const assignees = loadAssignees();
    assignees.push(assignee);
    saveAssignees(assignees);
    return { ok: true, assignee: assignee };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderBadgeHtml(assigneeId) {
    const assignee = getById(assigneeId);
    if (!assignee) return "";
    return (
      '<span class="project-badge" style="--project-color:' +
      escapeHtml(assignee.color) +
      '">' +
      escapeHtml(assignee.name) +
      "</span>"
    );
  }

  function createBadgeElement(assigneeId) {
    const assignee = getById(assigneeId);
    if (!assignee) return null;
    const span = document.createElement("span");
    span.className = "project-badge";
    span.style.setProperty("--project-color", assignee.color);
    span.textContent = assignee.name;
    return span;
  }

  window.PronoteAssignees = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_COLORS: DEFAULT_COLORS,
    getAll: getAll,
    getById: getById,
    findByName: findByName,
    createAssignee: createAssignee,
    reorderAssignees: reorderAssignees,
    deleteAssignee: deleteAssignee,
    pickColor: pickColor,
    renderBadgeHtml: renderBadgeHtml,
    createBadgeElement: createBadgeElement,
  };
})();
