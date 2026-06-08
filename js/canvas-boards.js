(function () {
  const STORAGE_KEY = "pronote.canvas-boards.v1";

  const DEFAULT_CARD_COLOR = "#1e40af";
  const DEFAULT_CARD_TEXT_COLOR = "#e8eaed";
  const DEFAULT_TEXT_COLOR = "#ffffff";
  const DEFAULT_TEXT_BACKGROUND = "";
  const DEFAULT_TEXT_SIZE = 16;
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 120;
  const DEFAULT_CARD_WIDTH = 220;
  const DEFAULT_CARD_MIN_HEIGHT = 100;
  const CARD_MAX_WIDTH = 640;
  const CARD_MAX_HEIGHT = 480;

  function createId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return prefix + "-" + crypto.randomUUID();
    }
    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeBoard(board) {
    if (!board || !board.id) return null;
    return {
      id: board.id,
      name: String(board.name || "Доска").trim() || "Доска",
      createdAt: board.createdAt || new Date().toISOString(),
      viewport: {
        panX: Number(board.viewport && board.viewport.panX) || 0,
        panY: Number(board.viewport && board.viewport.panY) || 0,
        zoom: Number(board.viewport && board.viewport.zoom) || 1,
      },
      cards: Array.isArray(board.cards) ? board.cards.map(normalizeCard).filter(Boolean) : [],
      texts: Array.isArray(board.texts) ? board.texts.map(normalizeText).filter(Boolean) : [],
      arrows: Array.isArray(board.arrows) ? board.arrows.map(normalizeArrow).filter(Boolean) : [],
    };
  }

  function normalizeCard(card) {
    if (!card || !card.id) return null;
    return {
      id: card.id,
      x: Number(card.x) || 0,
      y: Number(card.y) || 0,
      width: Number(card.width) || DEFAULT_CARD_WIDTH,
      height: Number(card.height) || DEFAULT_CARD_MIN_HEIGHT,
      text: String(card.text || ""),
      color: card.color || DEFAULT_CARD_COLOR,
      textColor: card.textColor || DEFAULT_CARD_TEXT_COLOR,
      fontSize: clampFontSize(card.fontSize),
    };
  }

  function clampFontSize(size) {
    const n = Number(size);
    if (!Number.isFinite(n)) return DEFAULT_TEXT_SIZE;
    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n)));
  }

  function normalizeText(textItem) {
    if (!textItem || !textItem.id) return null;
    return {
      id: textItem.id,
      x: Number(textItem.x) || 0,
      y: Number(textItem.y) || 0,
      text: String(textItem.text || ""),
      color: textItem.color || DEFAULT_TEXT_COLOR,
      backgroundColor: textItem.backgroundColor || DEFAULT_TEXT_BACKGROUND,
      fontSize: clampFontSize(textItem.fontSize),
    };
  }

  function normalizeArrow(arrow) {
    if (!arrow || !arrow.id || !arrow.fromId || !arrow.toId) return null;
    return {
      id: arrow.id,
      fromId: arrow.fromId,
      toId: arrow.toId,
    };
  }

  function createDefaultBoard(name) {
    return normalizeBoard({
      id: createId("canvas"),
      name: name,
      createdAt: new Date().toISOString(),
      viewport: { panX: 40, panY: 40, zoom: 1 },
      cards: [],
      texts: [],
      arrows: [],
    });
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const board = createDefaultBoard("Доска 1");
        return { activeBoardId: board.id, boards: [board] };
      }

      const parsed = JSON.parse(raw);
      const boards = (Array.isArray(parsed.boards) ? parsed.boards : [])
        .map(normalizeBoard)
        .filter(Boolean);

      if (boards.length === 0) {
        const board = createDefaultBoard("Доска 1");
        return { activeBoardId: board.id, boards: [board] };
      }

      const activeBoardId =
        parsed.activeBoardId && boards.some(function (b) { return b.id === parsed.activeBoardId; })
          ? parsed.activeBoardId
          : boards[0].id;

      return { activeBoardId: activeBoardId, boards: boards };
    } catch (err) {
      console.warn("Pronote: чтение досок", err);
      const board = createDefaultBoard("Доска 1");
      return { activeBoardId: board.id, boards: [board] };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  let store = loadStore();

  function persist() {
    saveStore(store);
  }

  function getStore() {
    return store;
  }

  function getActiveBoard() {
    return (
      store.boards.find(function (board) {
        return board.id === store.activeBoardId;
      }) || store.boards[0] || null
    );
  }

  function setActiveBoard(id) {
    if (!store.boards.some(function (board) { return board.id === id; })) {
      return false;
    }
    store.activeBoardId = id;
    persist();
    return true;
  }

  function findBoardIndex(id) {
    return store.boards.findIndex(function (board) {
      return board.id === id;
    });
  }

  function createBoard(name) {
    const board = createDefaultBoard(name || "Доска " + (store.boards.length + 1));
    store.boards.push(board);
    store.activeBoardId = board.id;
    persist();
    return board;
  }

  function deleteBoard(id) {
    if (store.boards.length <= 1) {
      return { ok: false, error: "last" };
    }
    const index = findBoardIndex(id);
    if (index === -1) {
      return { ok: false, error: "not_found" };
    }
    store.boards.splice(index, 1);
    if (store.activeBoardId === id) {
      store.activeBoardId = store.boards[0].id;
    }
    persist();
    return { ok: true };
  }

  function updateViewport(id, viewport) {
    const board = store.boards.find(function (b) { return b.id === id; });
    if (!board) return false;
    board.viewport = {
      panX: Number(viewport.panX) || 0,
      panY: Number(viewport.panY) || 0,
      zoom: Math.min(2.5, Math.max(0.2, Number(viewport.zoom) || 1)),
    };
    persist();
    return true;
  }

  function findItem(board, type, id) {
    if (!board || !id) return null;
    const list = type === "card" ? board.cards : board.texts;
    return (
      list.find(function (item) {
        return item.id === id;
      }) || null
    );
  }

  function addCard(boardId, data) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return null;
    const card = normalizeCard(
      Object.assign(
        {
          id: createId("card"),
          width: DEFAULT_CARD_WIDTH,
          height: DEFAULT_CARD_MIN_HEIGHT,
          text: "",
          color: DEFAULT_CARD_COLOR,
          textColor: DEFAULT_CARD_TEXT_COLOR,
          fontSize: DEFAULT_TEXT_SIZE,
        },
        data
      )
    );
    board.cards.push(card);
    persist();
    return card;
  }

  function addText(boardId, data) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return null;
    const textItem = normalizeText(
      Object.assign(
        {
          id: createId("text"),
          text: "",
          color: DEFAULT_TEXT_COLOR,
          backgroundColor: DEFAULT_TEXT_BACKGROUND,
          fontSize: DEFAULT_TEXT_SIZE,
        },
        data
      )
    );
    board.texts.push(textItem);
    persist();
    return textItem;
  }

  function updateCard(boardId, cardId, patch) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return false;
    const card = findItem(board, "card", cardId);
    if (!card) return false;
    Object.assign(card, patch);
    const normalized = normalizeCard(card);
    Object.keys(card).forEach(function (key) { delete card[key]; });
    Object.assign(card, normalized);
    persist();
    return true;
  }

  function updateText(boardId, textId, patch) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return false;
    const textItem = findItem(board, "text", textId);
    if (!textItem) return false;
    Object.assign(textItem, patch);
    const normalized = normalizeText(textItem);
    Object.keys(textItem).forEach(function (key) { delete textItem[key]; });
    Object.assign(textItem, normalized);
    persist();
    return true;
  }

  function removeItem(boardId, type, itemId) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return false;

    if (type === "card") {
      board.cards = board.cards.filter(function (c) { return c.id !== itemId; });
    } else {
      board.texts = board.texts.filter(function (t) { return t.id !== itemId; });
    }

    board.arrows = board.arrows.filter(function (arrow) {
      return arrow.fromId !== itemId && arrow.toId !== itemId;
    });

    persist();
    return true;
  }

  function addArrow(boardId, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return null;
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return null;

    const exists = board.arrows.some(function (arrow) {
      return (
        (arrow.fromId === fromId && arrow.toId === toId) ||
        (arrow.fromId === toId && arrow.toId === fromId)
      );
    });
    if (exists) return null;

    const fromItem =
      findItem(board, "card", fromId) || findItem(board, "text", fromId);
    const toItem =
      findItem(board, "card", toId) || findItem(board, "text", toId);
    if (!fromItem || !toItem) return null;

    const arrow = normalizeArrow({
      id: createId("arrow"),
      fromId: fromId,
      toId: toId,
    });
    board.arrows.push(arrow);
    persist();
    return arrow;
  }

  function removeArrow(boardId, arrowId) {
    const board = store.boards.find(function (b) { return b.id === boardId; });
    if (!board) return false;
    const before = board.arrows.length;
    board.arrows = board.arrows.filter(function (a) { return a.id !== arrowId; });
    if (board.arrows.length === before) return false;
    persist();
    return true;
  }

  window.PronoteCanvasBoards = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_CARD_COLOR: DEFAULT_CARD_COLOR,
    DEFAULT_CARD_TEXT_COLOR: DEFAULT_CARD_TEXT_COLOR,
    DEFAULT_TEXT_COLOR: DEFAULT_TEXT_COLOR,
    DEFAULT_TEXT_BACKGROUND: DEFAULT_TEXT_BACKGROUND,
    DEFAULT_TEXT_SIZE: DEFAULT_TEXT_SIZE,
    MIN_FONT_SIZE: MIN_FONT_SIZE,
    MAX_FONT_SIZE: MAX_FONT_SIZE,
    clampFontSize: clampFontSize,
    DEFAULT_CARD_WIDTH: DEFAULT_CARD_WIDTH,
    DEFAULT_CARD_MIN_HEIGHT: DEFAULT_CARD_MIN_HEIGHT,
    CARD_MAX_WIDTH: CARD_MAX_WIDTH,
    CARD_MAX_HEIGHT: CARD_MAX_HEIGHT,
    getStore: getStore,
    getActiveBoard: getActiveBoard,
    setActiveBoard: setActiveBoard,
    createBoard: createBoard,
    deleteBoard: deleteBoard,
    updateViewport: updateViewport,
    addCard: addCard,
    addText: addText,
    updateCard: updateCard,
    updateText: updateText,
    removeItem: removeItem,
    addArrow: addArrow,
    removeArrow: removeArrow,
    findItem: findItem,
    reload: function () {
      store = loadStore();
      return store;
    },
  };
})();
