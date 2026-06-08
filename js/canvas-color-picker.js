(function () {
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) {
      r = c; g = x;
    } else if (h < 120) {
      r = x; g = c;
    } else if (h < 180) {
      g = c; b = x;
    } else if (h < 240) {
      g = x; b = c;
    } else if (h < 300) {
      r = x; b = c;
    } else {
      r = c; b = x;
    }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function rgbToHex(r, g, b) {
    function hex(n) {
      const s = clamp(Math.round(n), 0, 255).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + hex(r) + hex(g) + hex(b);
  }

  function hexToRgb(hex) {
    const raw = String(hex || "").replace("#", "");
    if (raw.length !== 6) return null;
    const num = parseInt(raw, 16);
    if (Number.isNaN(num)) return null;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHsv(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else h = 60 * ((rn - gn) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    return { h: h, s: s, v: max };
  }

  function normalizeHex(color, fallback) {
    const rgb = hexToRgb(color);
    if (!rgb) return fallback || "#ffffff";
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function mount(container, options) {
    const opts = options || {};
    let hue = 0;
    let sat = 1;
    let val = 1;
    let open = false;
    let onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};

    const initial = normalizeHex(opts.color, "#ffffff");
    const initHsv = rgbToHsv.apply(null, Object.values(hexToRgb(initial)));
    hue = initHsv.h;
    sat = initHsv.s;
    val = initHsv.v;

    container.innerHTML = "";
    container.className = "canvas-color-picker";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "canvas-color-picker__trigger";
    trigger.setAttribute("aria-label", "Выбрать цвет");
    trigger.setAttribute("aria-expanded", "false");

    const triggerSwatch = document.createElement("span");
    triggerSwatch.className = "canvas-color-picker__trigger-swatch";
    trigger.appendChild(triggerSwatch);

    const popover = document.createElement("div");
    popover.className = "canvas-color-picker__popover";
    popover.hidden = true;

    const main = document.createElement("div");
    main.className = "canvas-color-picker__main";

    const preview = document.createElement("div");
    preview.className = "canvas-color-picker__preview";

    const sv = document.createElement("div");
    sv.className = "canvas-color-picker__sv";
    sv.setAttribute("role", "slider");
    sv.setAttribute("aria-label", "Насыщенность и яркость");

    const svHandle = document.createElement("span");
    svHandle.className = "canvas-color-picker__sv-handle";
    sv.appendChild(svHandle);

    main.appendChild(preview);
    main.appendChild(sv);

    const hueWrap = document.createElement("div");
    hueWrap.className = "canvas-color-picker__hue-wrap";

    const hueInput = document.createElement("input");
    hueInput.type = "range";
    hueInput.className = "canvas-color-picker__hue";
    hueInput.min = "0";
    hueInput.max = "360";
    hueInput.value = String(Math.round(hue));
    hueInput.setAttribute("aria-label", "Оттенок");
    hueWrap.appendChild(hueInput);

    popover.appendChild(main);
    popover.appendChild(hueWrap);

    const popoverRoot = container.closest(".canvas-props-float__inner") || container;
    if (popoverRoot !== container) {
      popover.classList.add("canvas-color-picker__popover--bar");
    }

    container.appendChild(trigger);
    popoverRoot.appendChild(popover);

    function currentHex() {
      const rgb = hsvToRgb(hue, sat, val);
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function updateUi() {
      const pure = hsvToRgb(hue, 1, 1);
      const pureHex = rgbToHex(pure.r, pure.g, pure.b);
      sv.style.setProperty("--picker-hue", pureHex);
      svHandle.style.left = sat * 100 + "%";
      svHandle.style.top = (1 - val) * 100 + "%";
      hueInput.value = String(Math.round(hue));
      const hex = currentHex();
      preview.style.background = hex;
      triggerSwatch.style.background = hex;
    }

    function applyColor(hex, resetHsv) {
      const normalized = normalizeHex(hex, currentHex());
      if (resetHsv) {
        const rgb = hexToRgb(normalized);
        const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
        hue = next.h;
        sat = next.s;
        val = next.v;
      }
      updateUi();
    }

    function emit() {
      onChange(currentHex());
    }

    function setOpen(next) {
      open = next;
      popover.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
    }

    function setSvFromEvent(e) {
      const rect = sv.getBoundingClientRect();
      sat = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      val = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
      updateUi();
      emit();
    }

    let svDragging = false;

    sv.addEventListener("pointerdown", function (e) {
      svDragging = true;
      sv.setPointerCapture(e.pointerId);
      setSvFromEvent(e);
    });

    sv.addEventListener("pointermove", function (e) {
      if (!svDragging) return;
      setSvFromEvent(e);
    });

    sv.addEventListener("pointerup", function (e) {
      svDragging = false;
      try { sv.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    hueInput.addEventListener("input", function () {
      hue = Number(hueInput.value) || 0;
      updateUi();
      emit();
    });

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      const next = !open;
      if (next && typeof opts.onOpen === "function") {
        opts.onOpen();
      }
      setOpen(next);
    });

    document.addEventListener("click", function (e) {
      if (!open) return;
      if (!container.contains(e.target) && !popover.contains(e.target)) {
        setOpen(false);
      }
    });

    applyColor(initial, true);

    return {
      setColor: function (hex) {
        applyColor(hex, true);
      },
      getColor: function () {
        return currentHex();
      },
      close: function () {
        setOpen(false);
      },
      destroy: function () {
        container.innerHTML = "";
      },
    };
  }

  window.PronoteCanvasColorPicker = {
    mount: mount,
    normalizeHex: normalizeHex,
  };
})();
