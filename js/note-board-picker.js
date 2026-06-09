(function () {
  const BOARDS = [
    {
      route: "ideas",
      label: "Идеи",
      defaultSection: "new",
      sections: [
        { id: "new", label: "Новые" },
        { id: "discuss", label: "Обсуждаются" },
        { id: "discussed", label: "Обсудились" },
        { id: "future", label: "В будущем" },
      ],
    },
    {
      route: "dev",
      label: "Разработка",
      defaultSection: "planned",
      sections: [
        { id: "planned", label: "Планируются" },
        { id: "progress", label: "Делаются" },
        { id: "postponed", label: "Отложены" },
        { id: "waiting", label: "Ожидание" },
      ],
    },
    {
      route: "urgent",
      label: "Срочно",
      defaultSection: "main",
      sections: [{ id: "main", label: "Срочные задачи" }],
    },
  ];

  const boardByRoute = {};
  BOARDS.forEach(function (board) {
    boardByRoute[board.route] = board;
  });

  function createPickerElement() {
    const root = document.createElement("div");
    root.className = "today-form__row note-board-picker";
    root.setAttribute("data-note-board-picker", "");

    const boardField = document.createElement("label");
    boardField.className = "field today-form__field";
    boardField.innerHTML =
      '<span class="field__label">Раздел</span>' +
      '<select class="field__input field__input--select note-board-picker__board" name="boardRoute" aria-label="Раздел заметки">' +
      '<option value="">Не выбран</option>' +
      "</select>";

    const sectionField = document.createElement("label");
    sectionField.className = "field today-form__field";
    sectionField.innerHTML =
      '<span class="field__label">Подраздел</span>' +
      '<select class="field__input field__input--select note-board-picker__section" name="section" aria-label="Подраздел заметки" disabled>' +
      '<option value="">—</option>' +
      "</select>";

    const boardSelect = boardField.querySelector(".note-board-picker__board");
    BOARDS.forEach(function (board) {
      const option = document.createElement("option");
      option.value = board.route;
      option.textContent = board.label;
      boardSelect.appendChild(option);
    });

    root.appendChild(boardField);
    root.appendChild(sectionField);
    return root;
  }

  function getBoardSelect(root) {
    return root && root.querySelector(".note-board-picker__board");
  }

  function getSectionSelect(root) {
    return root && root.querySelector(".note-board-picker__section");
  }

  function fillSections(root, boardRoute, selectedSection) {
    const sectionSelect = getSectionSelect(root);
    if (!sectionSelect) return;

    sectionSelect.innerHTML = "";
    const board = boardByRoute[boardRoute];

    if (!board) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      sectionSelect.appendChild(empty);
      sectionSelect.disabled = true;
      return;
    }

    board.sections.forEach(function (section) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.label;
      sectionSelect.appendChild(option);
    });

    sectionSelect.disabled = board.sections.length <= 1;

    const value =
      selectedSection && board.sections.some(function (entry) {
        return entry.id === selectedSection;
      })
        ? selectedSection
        : board.defaultSection;
    sectionSelect.value = value;
  }

  function bindPicker(root) {
    const boardSelect = getBoardSelect(root);
    if (!boardSelect || root.dataset.bound === "1") return;

    boardSelect.addEventListener("change", function () {
      fillSections(root, boardSelect.value, "");
    });
    root.dataset.bound = "1";
  }

  function attachToForm(form, options) {
    const opts = options || {};
    if (!form || form.querySelector("[data-note-board-picker]")) {
      return form && form.querySelector("[data-note-board-picker]");
    }

    const picker = createPickerElement();
    bindPicker(picker);

    const anchor =
      (opts.before && form.querySelector(opts.before)) ||
      form.querySelector("[data-project-picker]") ||
      form.querySelector(".idea-form__actions") ||
      form.querySelector(".modal__actions");

    if (anchor) {
      form.insertBefore(picker, anchor);
    } else {
      form.appendChild(picker);
    }

    return picker;
  }

  function setValue(form, boardRoute, section) {
    const root = form && form.querySelector("[data-note-board-picker]");
    if (!root) return;

    const boardSelect = getBoardSelect(root);
    if (!boardSelect) return;

    const route = boardRoute && boardByRoute[boardRoute] ? boardRoute : "";
    boardSelect.value = route;
    fillSections(root, route, section || "");
  }

  function reset(form) {
    setValue(form, "", "");
  }

  function resolve(form) {
    const root = form && form.querySelector("[data-note-board-picker]");
    if (!root) return null;

    const boardSelect = getBoardSelect(root);
    const sectionSelect = getSectionSelect(root);
    if (!boardSelect) return null;

    const boardRoute = String(boardSelect.value || "").trim();
    if (!boardRoute || !boardByRoute[boardRoute]) {
      return null;
    }

    const section = sectionSelect ? String(sectionSelect.value || "").trim() : "";
    const board = boardByRoute[boardRoute];
    const validSection =
      section &&
      board.sections.some(function (entry) {
        return entry.id === section;
      });

    return {
      boardRoute: boardRoute,
      section: validSection ? section : board.defaultSection,
    };
  }

  function init() {
    attachToForm(document.getElementById("todayCreateForm"), {
      before: ".modal__actions",
    });
    attachToForm(document.getElementById("notesPageForm"));
    attachToForm(document.getElementById("noteEditForm"));
  }

  window.PronoteNoteBoardPicker = {
    BOARDS: BOARDS,
    attachToForm: attachToForm,
    setValue: setValue,
    reset: reset,
    resolve: resolve,
    getBoardLabel: function (route) {
      const board = boardByRoute[route];
      return board ? board.label : "";
    },
    getSectionLabel: function (route, sectionId) {
      const board = boardByRoute[route];
      if (!board) return "";
      const section = board.sections.find(function (entry) {
        return entry.id === sectionId;
      });
      return section ? section.label : "";
    },
  };

  init();
})();
