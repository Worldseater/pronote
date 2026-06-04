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

  window.PronoteInitBoard({
    id: "dev",
    storageKey: "pronote.dev.v1",
    eyebrow: "Разработка",
    emptyMeta: "Нет задач",
    plural: function (count) {
      return pluralRu(count, "задача", "задачи", "задач");
    },
    itemTag: "разработка",
    addSection: "planned",
    deleteSections: ["planned", "progress", "postponed", "waiting"],
    deleteTitle: "Удалить задачу?",
    deleteMessageSuffix: "будет удалена без восстановления.",
    deleteFallbackName: "эта задача",
    deleteAriaLabel: "Удалить задачу",
    titleError: "Введите заголовок задачи.",
    formId: "devForm",
    formErrorId: "devFormError",
    formPanelId: "devFormPanel",
    formToggleId: "devFormToggle",
    sections: [
      { id: "planned", title: "Планируются" },
      { id: "progress", title: "Делаются" },
      { id: "postponed", title: "Отложены" },
      { id: "waiting", title: "Ожидание" },
    ],
    seed: [],
  });
})();
