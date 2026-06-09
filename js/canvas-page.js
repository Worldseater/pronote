(function () {
  const api = function () {
    return window.PronoteCanvasBoards;
  };

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2.5;
  const ZOOM_STEP = 0.1;

  const root = document.getElementById("canvasPage");
  const boardSelect = document.getElementById("canvasBoardSelect");
  const addBoardBtn = document.getElementById("canvasAddBoard");
  const deleteBoardBtn = document.getElementById("canvasDeleteBoard");
  const viewport = document.getElementById("canvasViewport");
  const world = document.getElementById("canvasWorld");
  const arrowsSvg = document.getElementById("canvasArrows");
  const itemsEl = document.getElementById("canvasItems");
  const hintEl = document.getElementById("canvasHint");
  const zoomLabel = document.getElementById("canvasZoomLabel");
  const propsPanel = document.getElementById("canvasPropsPanel");
  const bgColorsEl = document.getElementById("canvasPropBgColors");
  const textColorsEl = document.getElementById("canvasPropTextColors");
  const sizeInput = document.getElementById("canvasPropSizeInput");
  const zoomInBtn = document.getElementById("canvasZoomIn");
  const zoomOutBtn = document.getElementById("canvasZoomOut");
  const zoomResetBtn = document.getElementById("canvasZoomReset");

  let activeTool = "cursor";
  let selected = null;
  let arrowFromId = null;
  let spaceDown = false;
  let panning = false;
  let panStart = null;
  let viewportStart = null;
  let draggingItem = null;
  let dragOffset = null;
  let resizingCard = null;
  let initialized = false;
  let bgColorPickerInstance = null;
  let textColorPickerInstance = null;
  let draftTextEl = null;
  let draftTextPos = null;

  function isCanvasActive() {
    const view = document.getElementById("viewCanvas");
    return view && !view.hidden;
  }

  function getBoard() {
    const a = api();
    return a && typeof a.getActiveBoard === "function" ? a.getActiveBoard() : null;
  }

  function getBoardId() {
    const board = getBoard();
    return board ? board.id : null;
  }

  function removeDraftText() {
    if (draftTextEl) {
      draftTextEl.remove();
      draftTextEl = null;
      draftTextPos = null;
    }
  }

  function finalizeDraftText() {
    if (!draftTextEl || !draftTextPos) return;
    const body = draftTextEl.querySelector(".canvas-item__body");
    const text = body ? body.textContent.trim() : "";
    const x = draftTextPos.x;
    const y = draftTextPos.y;
    const color = draftTextEl.dataset.draftColor;
    const backgroundColor = draftTextEl.dataset.draftBackgroundColor || "";
    const fontSize = Number(draftTextEl.dataset.draftFontSize) || 16;
    removeDraftText();
    if (!text) return;
    const a = api();
    const boardId = getBoardId();
    if (!a || !boardId) return;
    const textItem = a.addText(boardId, {
      x: x,
      y: y,
      text: text,
      color: color,
      backgroundColor: backgroundColor,
      fontSize: fontSize,
    });
    if (textItem) {
      selectItem("text", textItem.id);
      setTool("cursor");
      renderAll();
    }
  }

  function startDraftText(x, y) {
    finalizeDraftText();
    const a = api();
    if (!a || !itemsEl) return;
    draftTextPos = { x: x, y: y };
    const el = document.createElement("div");
    el.className = "canvas-item canvas-item--text canvas-item--draft canvas-item--selected";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.dataset.draftColor = a.DEFAULT_TEXT_COLOR;
    el.dataset.draftBackgroundColor = a.DEFAULT_TEXT_BACKGROUND;
    el.dataset.draftFontSize = String(a.DEFAULT_TEXT_SIZE);

    const body = document.createElement("div");
    body.className = "canvas-item__body";
    body.contentEditable = "true";
    body.spellcheck = true;
    body.dataset.placeholder = "Текст…";
    body.style.color = a.DEFAULT_TEXT_COLOR;
    body.style.fontSize = a.DEFAULT_TEXT_SIZE + "px";
    body.addEventListener("blur", function () {
      window.requestAnimationFrame(finalizeDraftText);
    });
    body.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    });
    el.appendChild(body);
    itemsEl.appendChild(el);
    draftTextEl = el;
    window.requestAnimationFrame(function () {
      body.focus();
    });
  }

  function applyViewport(board) {
    if (!world || !board) return;
    const vp = board.viewport;
    world.style.transform =
      "translate(" + vp.panX + "px, " + vp.panY + "px) scale(" + vp.zoom + ")";
    if (zoomLabel) {
      zoomLabel.textContent = Math.round(vp.zoom * 100) + "%";
    }
  }

  function saveViewport() {
    const a = api();
    const board = getBoard();
    if (!a || !board || typeof a.updateViewport !== "function") return;
    a.updateViewport(board.id, board.viewport);
  }

  function screenToWorld(clientX, clientY) {
    const board = getBoard();
    if (!viewport || !board) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    const vp = board.viewport;
    return {
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    };
  }

  function zoomAt(clientX, clientY, nextZoom) {
    const board = getBoard();
    if (!board || !viewport) return;
    const vp = board.viewport;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
    const rect = viewport.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const wx = (mx - vp.panX) / vp.zoom;
    const wy = (my - vp.panY) / vp.zoom;
    vp.zoom = clamped;
    vp.panX = mx - wx * clamped;
    vp.panY = my - wy * clamped;
    applyViewport(board);
    saveViewport();
    renderArrows();
  }

  function setTool(tool) {
    if (tool !== "text") {
      finalizeDraftText();
    }
    activeTool = tool;
    if (arrowFromId) {
      arrowFromId = null;
      renderItems();
    }
    document.querySelectorAll("[data-canvas-tool]").forEach(function (btn) {
      const isActive = btn.dataset.canvasTool === tool;
      btn.classList.toggle("canvas-tool-btn--active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    updateViewportCursor();
    updateHint();
  }

  function updateViewportCursor() {
    if (!viewport) return;
    viewport.classList.remove(
      "canvas-viewport--pan",
      "canvas-viewport--card",
      "canvas-viewport--text",
      "canvas-viewport--arrow",
      "canvas-viewport--panning"
    );
    if (panning) {
      viewport.classList.add("canvas-viewport--panning");
      return;
    }
    const panMode = activeTool === "hand" || spaceDown;
    if (panMode) {
      viewport.classList.add("canvas-viewport--pan");
    } else if (activeTool === "card") {
      viewport.classList.add("canvas-viewport--card");
    } else if (activeTool === "text") {
      viewport.classList.add("canvas-viewport--text");
    } else if (activeTool === "arrow") {
      viewport.classList.add("canvas-viewport--arrow");
    }
  }

  function updateHint() {
    if (!hintEl) return;
    if (activeTool === "arrow") {
      hintEl.hidden = false;
      hintEl.textContent = arrowFromId
        ? "Кликните на второй объект для стрелки · Esc — отмена"
        : "Кликните на первый объект · Esc — отмена";
      return;
    }
    if (activeTool === "card") {
      hintEl.hidden = false;
      hintEl.textContent = "Кликните на доску, чтобы добавить карточку";
      return;
    }
    if (activeTool === "text") {
      hintEl.hidden = false;
      hintEl.textContent = "Кликните на доску, чтобы добавить текст";
      return;
    }
    hintEl.hidden = true;
  }

  function selectItem(type, id) {
    const next = id ? { type: type, id: id } : null;
    const same =
      selected &&
      next &&
      selected.type === next.type &&
      selected.id === next.id;
    selected = next;
    renderPropsPanel();
    if (!same) {
      renderItems();
    }
  }

  function getSelectedItem() {
    const a = api();
    const board = getBoard();
    if (!a || !board || !selected) return null;
    return a.findItem(board, selected.type, selected.id);
  }

  function getItemBackgroundColor(item, type) {
    if (type === "card") return item.color;
    return item.backgroundColor || "";
  }

  function getItemTextColor(item, type) {
    if (type === "card") return item.textColor;
    return item.color;
  }

  function getItemFontSize(item) {
    const a = api();
    if (a && typeof a.clampFontSize === "function") {
      return a.clampFontSize(item.fontSize);
    }
    return Number(item.fontSize) || 16;
  }

  function pickerDisplayColor(hex, fallback) {
    if (hex && window.PronoteCanvasColorPicker) {
      return window.PronoteCanvasColorPicker.normalizeHex(hex, fallback);
    }
    return fallback || "#ffffff";
  }

  function applyFontSize(size) {
    const a = api();
    const boardId = getBoardId();
    if (!a || !boardId || !selected) return;
    const next = a.clampFontSize(size);
    if (selected.type === "card") {
      a.updateCard(boardId, selected.id, { fontSize: next });
    } else {
      a.updateText(boardId, selected.id, { fontSize: next });
    }
    renderItems();
    renderArrows();
    if (sizeInput) {
      sizeInput.value = String(next);
    }
  }

  function mountColorPickers(item) {
    if (!window.PronoteCanvasColorPicker || !selected) return;

    const bgHex = getItemBackgroundColor(item, selected.type);
    const textHex = getItemTextColor(item, selected.type);
    const bgDisplay = bgHex
      ? pickerDisplayColor(bgHex, "#1e40af")
      : pickerDisplayColor("#1e293b", "#1e293b");

    function updateBg(color) {
      const a = api();
      const boardId = getBoardId();
      if (!a || !boardId || !selected) return;
      if (selected.type === "card") {
        a.updateCard(boardId, selected.id, { color: color });
      } else {
        a.updateText(boardId, selected.id, { backgroundColor: color });
      }
      renderItems();
      renderArrows();
    }

    function updateTextColor(color) {
      const a = api();
      const boardId = getBoardId();
      if (!a || !boardId || !selected) return;
      if (selected.type === "card") {
        a.updateCard(boardId, selected.id, { textColor: color });
      } else {
        a.updateText(boardId, selected.id, { color: color });
      }
      renderItems();
      renderArrows();
    }

    if (bgColorsEl) {
      if (!bgColorPickerInstance) {
        bgColorPickerInstance = window.PronoteCanvasColorPicker.mount(bgColorsEl, {
          color: bgDisplay,
          onOpen: function () {
            if (textColorPickerInstance) textColorPickerInstance.close();
          },
          onChange: updateBg,
        });
      } else {
        bgColorPickerInstance.setColor(bgDisplay);
      }
    }

    if (textColorsEl) {
      if (!textColorPickerInstance) {
        textColorPickerInstance = window.PronoteCanvasColorPicker.mount(textColorsEl, {
          color: pickerDisplayColor(textHex, "#ffffff"),
          onOpen: function () {
            if (bgColorPickerInstance) bgColorPickerInstance.close();
          },
          onChange: updateTextColor,
        });
      } else {
        textColorPickerInstance.setColor(pickerDisplayColor(textHex, "#ffffff"));
      }
    }
  }

  function renderPropsPanel() {
    if (!propsPanel) return;
    const item = getSelectedItem();
    const showPanel =
      item &&
      selected &&
      (selected.type === "text" || selected.type === "card");
    if (!showPanel) {
      propsPanel.hidden = true;
      return;
    }
    propsPanel.hidden = false;
    mountColorPickers(item);

    if (sizeInput) {
      sizeInput.value = String(getItemFontSize(item));
    }
  }

  function getItemElement(itemId) {
    return itemsEl && itemsEl.querySelector('[data-item-id="' + itemId + '"]');
  }

  function getItemRect(itemId) {
    const el = getItemElement(itemId);
    if (!el) return null;
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
      x: x,
      y: y,
      w: w,
      h: h,
      cx: x + w / 2,
      cy: y + h / 2,
    };
  }

  function getBorderPoint(rect, targetCx, targetCy) {
    const dx = targetCx - rect.cx;
    const dy = targetCy - rect.cy;
    if (dx === 0 && dy === 0) {
      return { x: rect.cx, y: rect.cy };
    }
    const hw = rect.w / 2;
    const hh = rect.h / 2;
    const scale = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
    return {
      x: rect.cx + dx * scale,
      y: rect.cy + dy * scale,
    };
  }

  function getArrowEndpoints(fromId, toId) {
    const fromRect = getItemRect(fromId);
    const toRect = getItemRect(toId);
    if (!fromRect || !toRect) return null;
    return {
      from: getBorderPoint(fromRect, toRect.cx, toRect.cy),
      to: getBorderPoint(toRect, fromRect.cx, fromRect.cy),
    };
  }

  function renderArrows() {
    if (!arrowsSvg) return;
    const board = getBoard();
    if (!board) return;

    let defs = arrowsSvg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", "canvas-arrowhead");
      marker.setAttribute("markerWidth", "8");
      marker.setAttribute("markerHeight", "8");
      marker.setAttribute("refX", "6");
      marker.setAttribute("refY", "4");
      marker.setAttribute("orient", "auto");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M0,0 L8,4 L0,8 Z");
      path.setAttribute("fill", "rgba(255,255,255,0.5)");
      marker.appendChild(path);
      defs.appendChild(marker);
      arrowsSvg.appendChild(defs);
    }

    arrowsSvg.querySelectorAll("line").forEach(function (line) {
      line.remove();
    });

    board.arrows.forEach(function (arrow) {
      const endpoints = getArrowEndpoints(arrow.fromId, arrow.toId);
      if (!endpoints) return;
      const from = endpoints.from;
      const to = endpoints.to;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      line.setAttribute("marker-end", "url(#canvas-arrowhead)");
      arrowsSvg.appendChild(line);
    });
  }

  function clampCardDimension(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getCardTextForMeasure(body) {
    const text = (body.textContent || "").trim();
    return text || body.dataset.placeholder || "";
  }

  function measureCardMinSize(el, body, atWidth) {
    const a = api();
    const maxW = a ? a.CARD_MAX_WIDTH : 640;
    const maxH = a ? a.CARD_MAX_HEIGHT : 480;
    const cardStyle = window.getComputedStyle(el);
    const bodyStyle = window.getComputedStyle(body);
    const padX =
      (parseFloat(cardStyle.paddingLeft) || 0) + (parseFloat(cardStyle.paddingRight) || 0);
    const padY =
      (parseFloat(cardStyle.paddingTop) || 0) + (parseFloat(cardStyle.paddingBottom) || 0);
    const bodyPadR = parseFloat(bodyStyle.paddingRight) || 0;
    const text = getCardTextForMeasure(body);

    const measurer = document.createElement("div");
    measurer.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;" +
      "box-sizing:border-box;padding:0;margin:0;border:0;word-break:break-word;";
    measurer.style.font = bodyStyle.font;
    measurer.style.lineHeight = bodyStyle.lineHeight;
    measurer.style.letterSpacing = bodyStyle.letterSpacing;
    measurer.textContent = text;
    document.body.appendChild(measurer);

    measurer.style.whiteSpace = "pre";
    measurer.style.width = "max-content";
    const minContentW = Math.ceil(measurer.scrollWidth);

    const widthBase = atWidth || el.offsetWidth;
    const innerW = Math.max(24, widthBase - padX - bodyPadR);
    measurer.style.whiteSpace = "pre-wrap";
    measurer.style.width = innerW + "px";
    const minContentH = Math.ceil(measurer.scrollHeight);

    document.body.removeChild(measurer);

    const minW = clampCardDimension(minContentW + padX + bodyPadR, 72, maxW);
    const minH = clampCardDimension(minContentH + padY, 48, maxH);
    return { minW: minW, minH: minH, maxW: maxW, maxH: maxH };
  }

  function applyCardBox(el, body, x, y, width, height) {
    const bounds = measureCardMinSize(el, body, width);
    const w = clampCardDimension(width, bounds.minW, bounds.maxW);
    const h = clampCardDimension(height, bounds.minH, bounds.maxH);
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
    return { x: x, y: y, width: w, height: h };
  }

  function bindCardResize(el, item, body) {
    const edges = ["n", "e", "s", "w"];

    edges.forEach(function (edge) {
      const handle = document.createElement("span");
      handle.className = "canvas-item__resize canvas-item__resize--" + edge;
      handle.setAttribute("aria-hidden", "true");
      el.appendChild(handle);

      handle.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        if (activeTool === "arrow") return;
        e.stopPropagation();
        e.preventDefault();

        const bounds = measureCardMinSize(el, body, el.offsetWidth);
        resizingCard = {
          id: item.id,
          el: el,
          body: body,
          edge: edge,
          startPointer: screenToWorld(e.clientX, e.clientY),
          startX: parseFloat(el.style.left) || 0,
          startY: parseFloat(el.style.top) || 0,
          startW: el.offsetWidth,
          startH: el.offsetHeight,
          bounds: bounds,
        };
        selectItem("card", item.id);
        el.setPointerCapture(e.pointerId);
      });
    });

    function onResizeMove(e) {
      if (!resizingCard || resizingCard.id !== item.id) return;

      const state = resizingCard;
      const pos = screenToWorld(e.clientX, e.clientY);
      const dx = pos.x - state.startPointer.x;
      const dy = pos.y - state.startPointer.y;
      let nextX = state.startX;
      let nextY = state.startY;
      let nextW = state.startW;
      let nextH = state.startH;

      if (state.edge.indexOf("e") !== -1) {
        nextW = state.startW + dx;
      }
      if (state.edge.indexOf("w") !== -1) {
        nextW = state.startW - dx;
        nextX = state.startX + dx;
      }
      if (state.edge.indexOf("s") !== -1) {
        nextH = state.startH + dy;
      }
      if (state.edge.indexOf("n") !== -1) {
        nextH = state.startH - dy;
        nextY = state.startY + dy;
      }

      const bounds = measureCardMinSize(el, body, nextW);
      const w = clampCardDimension(nextW, bounds.minW, bounds.maxW);
      const h = clampCardDimension(Math.max(nextH, bounds.minH), bounds.minH, bounds.maxH);

      if (state.edge.indexOf("w") !== -1) {
        nextX = state.startX + (state.startW - w);
      }
      if (state.edge.indexOf("n") !== -1) {
        nextY = state.startY + (state.startH - h);
      }

      el.style.left = nextX + "px";
      el.style.top = nextY + "px";
      el.style.width = w + "px";
      el.style.height = h + "px";
      renderArrows();
    }

    function onResizeEnd(e) {
      if (!resizingCard || resizingCard.id !== item.id) return;
      const a = api();
      const boardId = getBoardId();
      if (a && boardId) {
        const box = applyCardBox(
          el,
          body,
          parseFloat(el.style.left) || 0,
          parseFloat(el.style.top) || 0,
          el.offsetWidth,
          el.offsetHeight
        );
        a.updateCard(boardId, item.id, box);
      }
      resizingCard = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }

    el.addEventListener("pointermove", onResizeMove);
    el.addEventListener("pointerup", onResizeEnd);
    el.addEventListener("pointercancel", onResizeEnd);
  }

  function canStartItemDrag(e, gripEl) {
    if (e.button !== 0) return false;
    if (e.target.closest(".canvas-item__resize")) return false;
    if (e.target.closest(".canvas-item__delete")) return false;
    const fromGrip = gripEl && (e.target === gripEl || gripEl.contains(e.target));
    const panMode = activeTool === "hand" || spaceDown;
    if (activeTool === "arrow" && !panMode && !fromGrip) return false;
    if (fromGrip || panMode) return true;
    if (e.target.closest('[contenteditable="true"]')) return false;
    return false;
  }

  function bindItemDrag(el, type, item, gripEl) {
    function onPointerDown(e) {
      if (!canStartItemDrag(e, gripEl)) return;
      e.stopPropagation();
      e.preventDefault();
      draggingItem = { type: type, id: item.id };
      selectItem(type, item.id);
      const pos = screenToWorld(e.clientX, e.clientY);
      dragOffset = { x: pos.x - item.x, y: pos.y - item.y };
      el.setPointerCapture(e.pointerId);
    }

    el.addEventListener("pointerdown", onPointerDown);
    if (gripEl) {
      gripEl.addEventListener("pointerdown", onPointerDown);
    }

    el.addEventListener("pointermove", function (e) {
      if (resizingCard && resizingCard.id === item.id) return;
      if (!draggingItem || draggingItem.id !== item.id) return;
      const pos = screenToWorld(e.clientX, e.clientY);
      const nx = pos.x - dragOffset.x;
      const ny = pos.y - dragOffset.y;
      el.style.left = nx + "px";
      el.style.top = ny + "px";
      renderArrows();
    });

    el.addEventListener("pointerup", function (e) {
      if (!draggingItem || draggingItem.id !== item.id) return;
      const a = api();
      const boardId = getBoardId();
      if (a && boardId) {
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        if (type === "card") {
          a.updateCard(boardId, item.id, { x: x, y: y });
        } else {
          a.updateText(boardId, item.id, { x: x, y: y });
        }
      }
      draggingItem = null;
      dragOffset = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    });
  }

  function createItemElement(type, item) {
    const el = document.createElement("div");
    el.className = "canvas-item canvas-item--" + type;
    el.dataset.itemId = item.id;
    el.dataset.itemType = type;
    el.style.left = item.x + "px";
    el.style.top = item.y + "px";

    if (type === "card") {
      el.style.width = item.width + "px";
      el.style.height = item.height + "px";
      el.style.setProperty("--canvas-item-color", item.color);
    }

    if (selected && selected.id === item.id && selected.type === type) {
      el.classList.add("canvas-item--selected");
    }
    if (arrowFromId === item.id) {
      el.classList.add("canvas-item--arrow-pending");
    }

    const gripBtn = document.createElement("button");
    gripBtn.type = "button";
    gripBtn.className = "canvas-item__grip";
    gripBtn.setAttribute("aria-label", "Перетащить");
    gripBtn.title = "Перетащить";
    el.appendChild(gripBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "canvas-item__delete";
    deleteBtn.setAttribute("aria-label", "Удалить");
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const a = api();
      const boardId = getBoardId();
      if (!a || !boardId) return;
      a.removeItem(boardId, type, item.id);
      if (selected && selected.id === item.id) {
        selected = null;
      }
      if (arrowFromId === item.id) {
        arrowFromId = null;
      }
      renderAll();
    });
    el.appendChild(deleteBtn);

    const body = document.createElement("div");
    body.className = "canvas-item__body";
    body.contentEditable = "true";
    body.spellcheck = true;
    body.dataset.placeholder = type === "card" ? "Текст карточки…" : "Текст…";
    body.textContent = item.text || "";

    const fontSize = getItemFontSize(item);
    body.style.fontSize = fontSize + "px";

    if (type === "card") {
      body.style.color = item.textColor || api().DEFAULT_CARD_TEXT_COLOR;
    } else {
      body.style.color = item.color;
      if (item.backgroundColor) {
        el.style.background = item.backgroundColor;
        el.style.borderRadius = "var(--radius-sm)";
      }
    }

    body.addEventListener("blur", function () {
      const a = api();
      const boardId = getBoardId();
      if (!a || !boardId) return;
      const text = body.textContent.trim();
      if (type === "card") {
        const bounds = measureCardMinSize(el, body, el.offsetWidth);
        const nextW = Math.max(el.offsetWidth, bounds.minW);
        const nextH = Math.max(el.offsetHeight, bounds.minH);
        el.style.width = nextW + "px";
        el.style.height = nextH + "px";
        a.updateCard(boardId, item.id, {
          text: text,
          width: nextW,
          height: nextH,
        });
      } else {
        a.updateText(boardId, item.id, { text: text });
      }
    });

    body.addEventListener("pointerdown", function (e) {
      if (activeTool !== "hand" && !spaceDown) {
        e.stopPropagation();
      }
    });

    el.appendChild(body);

    el.addEventListener("click", function (e) {
      e.stopPropagation();
      finalizeDraftText();
      if (activeTool === "arrow") {
        if (!arrowFromId) {
          arrowFromId = item.id;
          renderItems();
          updateHint();
        } else if (arrowFromId !== item.id) {
          const a = api();
          const boardId = getBoardId();
          if (a && boardId) {
            a.addArrow(boardId, arrowFromId, item.id);
          }
          arrowFromId = null;
          renderAll();
          updateHint();
        }
        return;
      }
      selectItem(type, item.id);
      if (activeTool === "cursor" && e.target.closest(".canvas-item__body")) {
        const bodyEl = el.querySelector(".canvas-item__body");
        if (bodyEl) {
          bodyEl.focus();
        }
      }
    });

    bindItemDrag(el, type, item, gripBtn);
    if (type === "card") {
      bindCardResize(el, item, body);
    }
    return el;
  }

  function renderItems() {
    if (!itemsEl) return;
    const board = getBoard();
    if (!board) return;

    let detachedDraft = null;
    if (draftTextEl && draftTextEl.parentNode === itemsEl) {
      detachedDraft = draftTextEl;
      itemsEl.removeChild(draftTextEl);
    }

    itemsEl.innerHTML = "";
    board.cards.forEach(function (card) {
      itemsEl.appendChild(createItemElement("card", card));
    });
    board.texts.forEach(function (textItem) {
      itemsEl.appendChild(createItemElement("text", textItem));
    });

    if (detachedDraft) {
      itemsEl.appendChild(detachedDraft);
      draftTextEl = detachedDraft;
    }
  }

  function renderBoardSelect() {
    if (!boardSelect) return;
    const a = api();
    if (!a) return;
    const store = a.getStore();
    const current = boardSelect.value;
    boardSelect.innerHTML = "";
    store.boards.forEach(function (board) {
      const opt = document.createElement("option");
      opt.value = board.id;
      opt.textContent = board.name;
      boardSelect.appendChild(opt);
    });
    boardSelect.value = store.activeBoardId;
    if (deleteBoardBtn) {
      deleteBoardBtn.disabled = store.boards.length <= 1;
    }
  }

  function renderAll() {
    const board = getBoard();
    if (!board) return;
    applyViewport(board);
    renderBoardSelect();
    renderItems();
    renderArrows();
    renderPropsPanel();
    updateHint();
  }

  function handleViewportPointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return;
    const board = getBoard();
    if (!board) return;

    const panMode = activeTool === "hand" || spaceDown || e.button === 1;
    if (panMode) {
      panning = true;
      panStart = { x: e.clientX, y: e.clientY };
      viewportStart = { panX: board.viewport.panX, panY: board.viewport.panY };
      updateViewportCursor();
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (e.target !== viewport && !e.target.classList.contains("canvas-world") &&
        !e.target.classList.contains("canvas-items") &&
        !e.target.classList.contains("canvas-arrows")) {
      return;
    }

    const pos = screenToWorld(e.clientX, e.clientY);
    const a = api();
    const boardId = getBoardId();
    if (!a || !boardId) return;

    if (activeTool === "card") {
      finalizeDraftText();
      const card = a.addCard(boardId, {
        x: pos.x - a.DEFAULT_CARD_WIDTH / 2,
        y: pos.y - a.DEFAULT_CARD_MIN_HEIGHT / 2,
        text: "",
      });
      if (card) {
        selectItem("card", card.id);
        setTool("cursor");
        renderAll();
        window.requestAnimationFrame(function () {
          const el = getItemElement(card.id);
          if (el) {
            const body = el.querySelector(".canvas-item__body");
            if (body) body.focus();
          }
        });
      }
      return;
    }

    if (activeTool === "text") {
      startDraftText(pos.x, pos.y);
      return;
    }

    finalizeDraftText();
    selectItem(null, null);
    renderItems();
    renderPropsPanel();
  }

  function handleViewportPointerMove(e) {
    const board = getBoard();
    if (!board || !panning || !panStart || !viewportStart) return;
    board.viewport.panX = viewportStart.panX + (e.clientX - panStart.x);
    board.viewport.panY = viewportStart.panY + (e.clientY - panStart.y);
    applyViewport(board);
    renderArrows();
  }

  function handleViewportPointerUp(e) {
    if (!panning) return;
    panning = false;
    panStart = null;
    viewportStart = null;
    saveViewport();
    updateViewportCursor();
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  }

  function handleWheel(e) {
    if (!isCanvasActive()) return;
    e.preventDefault();
    const board = getBoard();
    if (!board) return;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAt(e.clientX, e.clientY, board.viewport.zoom + delta);
  }

  function isCanvasTextInputTarget(target) {
    return !!(
      target &&
      target.closest &&
      target.closest('[contenteditable="true"], input, textarea, select')
    );
  }

  function handleKeyDown(e) {
    if (!isCanvasActive()) return;
    if (e.code === "Space" && !spaceDown && !isCanvasTextInputTarget(e.target)) {
      spaceDown = true;
      updateViewportCursor();
      e.preventDefault();
    }
    if (e.key === "Escape") {
      arrowFromId = null;
      removeDraftText();
      selectItem(null, null);
      renderAll();
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selected &&
        !isCanvasTextInputTarget(e.target)) {
      const a = api();
      const boardId = getBoardId();
      if (a && boardId) {
        a.removeItem(boardId, selected.type, selected.id);
        selected = null;
        renderAll();
        e.preventDefault();
      }
    }
  }

  function handleKeyUp(e) {
    if (e.code === "Space") {
      spaceDown = false;
      updateViewportCursor();
    }
  }

  function confirmDeleteBoard(board) {
    if (!board) return;
    const run = function () {
      const a = api();
      if (!a) return;
      const result = a.deleteBoard(board.id);
      if (result.ok) {
        renderAll();
      }
    };

    if (window.PronoteConfirm && typeof window.PronoteConfirm.open === "function") {
      window.PronoteConfirm.open({
        title: "Удалить доску?",
        message: "«" + board.name + "» и все объекты на ней будут удалены.",
        confirmLabel: "Удалить",
        onConfirm: run,
      });
      return;
    }
    run();
  }

  function bindUi() {
    if (initialized) return;
    initialized = true;

    document.querySelectorAll("[data-canvas-tool]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTool(btn.dataset.canvasTool);
      });
    });

    if (boardSelect) {
      boardSelect.addEventListener("change", function () {
        const a = api();
        if (a && a.setActiveBoard(boardSelect.value)) {
          finalizeDraftText();
          arrowFromId = null;
          selected = null;
          renderAll();
        }
      });
    }

    if (addBoardBtn) {
      addBoardBtn.addEventListener("click", function () {
        const a = api();
        if (!a) return;
        a.createBoard();
        selected = null;
        arrowFromId = null;
        renderAll();
      });
    }

    if (deleteBoardBtn) {
      deleteBoardBtn.addEventListener("click", function () {
        confirmDeleteBoard(getBoard());
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", function () {
        const board = getBoard();
        if (!board || !viewport) return;
        const rect = viewport.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, board.viewport.zoom + ZOOM_STEP);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", function () {
        const board = getBoard();
        if (!board || !viewport) return;
        const rect = viewport.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, board.viewport.zoom - ZOOM_STEP);
      });
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", function () {
        const board = getBoard();
        if (!board) return;
        board.viewport.zoom = 1;
        applyViewport(board);
        saveViewport();
        renderArrows();
      });
    }

    if (viewport) {
      viewport.addEventListener("pointerdown", handleViewportPointerDown);
      viewport.addEventListener("pointermove", handleViewportPointerMove);
      viewport.addEventListener("pointerup", handleViewportPointerUp);
      viewport.addEventListener("pointercancel", handleViewportPointerUp);
      viewport.addEventListener("wheel", handleWheel, { passive: false });
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    if (sizeInput) {
      sizeInput.addEventListener("change", function () {
        applyFontSize(sizeInput.value);
      });
      sizeInput.addEventListener("blur", function () {
        if (String(sizeInput.value).trim() === "") {
          applyFontSize(api().DEFAULT_TEXT_SIZE);
        } else {
          applyFontSize(sizeInput.value);
        }
      });
      sizeInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          applyFontSize(sizeInput.value);
          sizeInput.blur();
        }
      });
    }
  }

  function renderCanvasPage() {
    if (!root) return;
    const a = api();
    if (!a) return;
    a.reload();
    bindUi();
    setTool(activeTool);
    renderAll();
  }

  window.renderCanvasPage = renderCanvasPage;
})();
