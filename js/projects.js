(function () {
  const STORAGE_KEY = "pronote.projects.v1";
  const TASK_STORAGE_KEYS = [
    "pronote.ideas.v1",
    "pronote.dev.v1",
    "pronote.urgent.v1",
    "pronote.notes.v1",
  ];

  const DEFAULT_COLORS = [
    "#60a5fa",
    "#38bdf8",
    "#1e40af",
    "#a78bfa",
    "#f472b6",
    "#fb923c",
    "#facc15",
    "#4ade80",
    "#2dd4bf",
    "#f87171",
  ];

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "project-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeName(name) {
    return String(name || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function loadProjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (project) {
          return project && normalizeName(project.name);
        })
        .map(function (project) {
          return {
            id: project.id || createId(),
            name: normalizeName(project.name),
            color: project.color || DEFAULT_COLORS[0],
          };
        });
    } catch (err) {
      console.warn("Pronote: чтение проектов", err);
      return [];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function getAll() {
    return loadProjects();
  }

  function getById(id) {
    if (!id) return null;
    return (
      loadProjects().find(function (project) {
        return project.id === id;
      }) || null
    );
  }

  function findByName(name) {
    const normalized = normalizeName(name).toLowerCase();
    if (!normalized) return null;
    return (
      loadProjects().find(function (project) {
        return normalizeName(project.name).toLowerCase() === normalized;
      }) || null
    );
  }

  function pickColor(color) {
    if (color && DEFAULT_COLORS.indexOf(color) !== -1) {
      return color;
    }
    return DEFAULT_COLORS[0];
  }

  function clearProjectFromTasks(projectId) {
    TASK_STORAGE_KEYS.forEach(function (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        let changed = false;
        const next = parsed.map(function (item) {
          if (!item || item.projectId !== projectId) return item;
          const copy = Object.assign({}, item);
          delete copy.projectId;
          changed = true;
          return copy;
        });

        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch (err) {
        console.warn("Pronote: сброс проекта в задачах", storageKey, err);
      }
    });
  }

  function deleteProject(id) {
    if (!id) {
      return { ok: false, error: "id" };
    }

    const projects = loadProjects();
    const index = projects.findIndex(function (project) {
      return project.id === id;
    });

    if (index === -1) {
      return { ok: false, error: "not_found" };
    }

    projects.splice(index, 1);
    saveProjects(projects);
    clearProjectFromTasks(id);
    return { ok: true };
  }

  function createProject(data) {
    const name = normalizeName(data && data.name);
    if (!name) {
      return { ok: false, error: "name" };
    }

    if (findByName(name)) {
      return { ok: false, error: "duplicate" };
    }

    const project = {
      id: createId(),
      name: name,
      color: pickColor(data && data.color),
    };
    const projects = loadProjects();
    projects.push(project);
    saveProjects(projects);
    return { ok: true, project: project };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderBadgeHtml(projectId) {
    const project = getById(projectId);
    if (!project) return "";
    return (
      '<span class="project-badge" style="--project-color:' +
      escapeHtml(project.color) +
      '">' +
      escapeHtml(project.name) +
      "</span>"
    );
  }

  function createBadgeElement(projectId) {
    const project = getById(projectId);
    if (!project) return null;
    const span = document.createElement("span");
    span.className = "project-badge";
    span.style.setProperty("--project-color", project.color);
    span.textContent = project.name;
    return span;
  }

  window.PronoteProjects = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_COLORS: DEFAULT_COLORS,
    getAll: getAll,
    getById: getById,
    findByName: findByName,
    createProject: createProject,
    deleteProject: deleteProject,
    pickColor: pickColor,
    renderBadgeHtml: renderBadgeHtml,
    createBadgeElement: createBadgeElement,
  };
})();
