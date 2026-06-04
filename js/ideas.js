(function () {
  if (!window.PronoteInitBoard) return;

  function pluralRu(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  function migrateLegacy() {
    try {
      const legacy = localStorage.getItem("pronote.ideas.new.v1");
      if (!legacy) return;
      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed)) return;
      localStorage.setItem(
        "pronote.ideas.v1",
        JSON.stringify(
          parsed.map(function (item) {
            return Object.assign({}, item, { status: item.status || "new" });
          })
        )
      );
      localStorage.removeItem("pronote.ideas.new.v1");
    } catch (err) {
      console.warn("Pronote: миграция идей", err);
    }
  }

  migrateLegacy();

  window.PronoteInitBoard({
    id: "ideas",
    storageKey: "pronote.ideas.v1",
    eyebrow: "Идеи",
    emptyMeta: "Нет идей",
    plural: function (count) {
      return pluralRu(count, "идея", "идеи", "идей");
    },
    addSection: "new",
    deleteSections: ["new", "discuss", "discussed", "future"],
    deleteTitle: "Удалить идею?",
    deleteMessageSuffix: "будет удалена без восстановления.",
    deleteFallbackName: "эта идея",
    deleteAriaLabel: "Удалить идею",
    titleError: "Введите заголовок идеи.",
    formId: "ideaForm",
    formErrorId: "ideaFormError",
    formPanelId: "ideaFormPanel",
    formToggleId: "ideaFormToggle",
    sourceLabels: {
      customer: "от заказчика",
      ai: "ИИ-черновик",
      team: "от команды",
      other: "другое",
    },
    sections: [
      { id: "new", title: "Новые" },
      { id: "discuss", title: "Обсуждаются" },
      { id: "discussed", title: "Обсудились" },
      { id: "future", title: "В будущем" },
    ],
    seed: [
      {
        id: "seed-1",
        title: "Блок отзывов на главной",
        text: "Заказчик просит карусель с 3–4 отзывами под первым экраном. Нужны макет и тексты.",
        source: "customer",
        status: "new",
        createdAt: "2026-06-03T10:00:00.000Z",
      },
      {
        id: "seed-2",
        title: "Тёмная тема по умолчанию",
        text: "Идея из ИИ-черновика: переключатель темы в шапке, сохранять выбор в localStorage.",
        source: "ai",
        status: "new",
        createdAt: "2026-06-02T14:30:00.000Z",
      },
    ],
  });

  window.PronoteIdeas = window.PronoteBoardHandlers.ideas;
})();
