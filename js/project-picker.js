(function () {
  function getProjectsApi() {
    return window.PronoteProjects;
  }

  function createPickerElement() {
    const root = document.createElement("div");
    root.className = "field project-picker";
    root.setAttribute("data-project-picker", "");
    root.innerHTML =
      '<span class="field__label">Проект</span>' +
      '<div class="project-picker__tags" role="group" aria-label="Выбор проекта"></div>' +
      '<p class="project-picker__empty" hidden>Создайте проект на странице «Проекты»</p>';
    return root;
  }

  function renderTags(root, selectedId) {
    const api = getProjectsApi();
    const tagsEl = root.querySelector(".project-picker__tags");
    const emptyEl = root.querySelector(".project-picker__empty");
    if (!tagsEl || !api) return;

    const projects = api.getAll();
    const current = selectedId || "";
    tagsEl.innerHTML = "";

    if (emptyEl) {
      emptyEl.hidden = projects.length > 0;
    }

    projects.forEach(function (project) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "project-picker__tag" + (current === project.id ? " project-picker__tag--active" : "");
      btn.dataset.value = project.id;
      btn.textContent = project.name;
      btn.style.setProperty("--project-color", project.color);
      btn.setAttribute("aria-pressed", String(current === project.id));
      tagsEl.appendChild(btn);
    });

    const noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.className =
      "project-picker__tag project-picker__tag--none" +
      (!current ? " project-picker__tag--active" : "");
    noneBtn.dataset.value = "";
    noneBtn.textContent = "Без проекта";
    noneBtn.setAttribute("aria-pressed", String(!current));
    tagsEl.appendChild(noneBtn);

    tagsEl.querySelectorAll(".project-picker__tag").forEach(function (btn) {
      btn.addEventListener("click", function () {
        tagsEl.querySelectorAll(".project-picker__tag").forEach(function (item) {
          item.classList.remove("project-picker__tag--active");
          item.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("project-picker__tag--active");
        btn.setAttribute("aria-pressed", "true");
      });
    });
  }

  function attachToForm(form, options) {
    const opts = options || {};
    if (!form || form.querySelector("[data-project-picker]")) {
      return form && form.querySelector("[data-project-picker]");
    }

    const picker = createPickerElement();
    const anchor =
      (opts.before && form.querySelector(opts.before)) ||
      form.querySelector(".idea-form__actions") ||
      form.querySelector(".modal__actions");

    if (anchor) {
      form.insertBefore(picker, anchor);
    } else {
      form.appendChild(picker);
    }

    renderTags(picker, opts.projectId || "");
    return picker;
  }

  function setValue(form, projectId) {
    const root = form && form.querySelector("[data-project-picker]");
    if (!root) return;
    renderTags(root, projectId || "");
  }

  function reset(form) {
    setValue(form, "");
  }

  function resolve(form) {
    const root = form && form.querySelector("[data-project-picker]");
    if (!root) return null;

    const active = root.querySelector(".project-picker__tag--active");
    if (!active) return null;

    const value = active.dataset.value;
    return value || null;
  }

  function refreshAll() {
    document.querySelectorAll("[data-project-picker]").forEach(function (root) {
      const active = root.querySelector(".project-picker__tag--active");
      const current = active ? active.dataset.value : "";
      renderTags(root, current);
    });
  }

  function init() {
    attachToForm(document.getElementById("todayForm"), {
      before: ".idea-form__actions",
    });
    attachToForm(document.getElementById("editItemForm"), {
      before: "#editCommentsBlock",
    });
    attachToForm(document.getElementById("ideaForm"), {
      before: ".idea-form__actions",
    });
    attachToForm(document.getElementById("devForm"), {
      before: ".idea-form__actions",
    });
    attachToForm(document.getElementById("urgentForm"), {
      before: ".idea-form__actions",
    });
    attachToForm(document.getElementById("homeNotesForm"), {
      before: "[data-note-board-picker]",
    });
    attachToForm(document.getElementById("notesPageForm"), {
      before: "[data-note-board-picker]",
    });
    attachToForm(document.getElementById("noteEditForm"), {
      before: "[data-note-board-picker]",
    });
  }

  window.PronoteProjectPicker = {
    attachToForm: attachToForm,
    setValue: setValue,
    reset: reset,
    resolve: resolve,
    refreshAll: refreshAll,
  };

  init();
})();
