(function () {
  const modal = document.getElementById("confirmModal");
  const backdrop = document.getElementById("confirmModalBackdrop");
  const titleEl = document.getElementById("confirmModalTitle");
  const messageEl = document.getElementById("confirmModalMessage");
  const cancelBtn = document.getElementById("confirmModalCancel");
  const confirmBtn = document.getElementById("confirmModalConfirm");
  const actionsEl = cancelBtn && cancelBtn.parentElement;

  if (!modal || !cancelBtn || !confirmBtn || !actionsEl) return;

  let onConfirm = null;
  let lastFocus = null;

  function setButtonOrder(swapButtons) {
    if (swapButtons) {
      actionsEl.insertBefore(confirmBtn, cancelBtn);
      return;
    }

    actionsEl.insertBefore(cancelBtn, confirmBtn);
  }

  function getFocusableButtons() {
    return Array.from(actionsEl.querySelectorAll("button"));
  }

  function close(options) {
    const opts = options || {};
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    onConfirm = null;
    setButtonOrder(false);
    if (!opts.keepLastFocus) {
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
    }
  }

  function open(options) {
    const opts = options || {};
    if (!opts.preserveFocus) {
      lastFocus = document.activeElement;
    }

    if (titleEl) titleEl.textContent = opts.title || "Подтвердите действие";
    if (messageEl) {
      messageEl.textContent = opts.message || "";
      messageEl.hidden = !opts.message;
    }
    confirmBtn.textContent = opts.confirmLabel || "Удалить";
    setButtonOrder(!!opts.swapButtons);

    onConfirm = typeof opts.onConfirm === "function" ? opts.onConfirm : null;

    modal.hidden = false;
    document.body.classList.add("modal-open");
    cancelBtn.focus();
  }

  function handleConfirm() {
    if (!onConfirm) {
      close();
      return;
    }

    const callback = onConfirm;
    close({ keepLastFocus: true });
    callback();
  }

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", close);

  if (backdrop) {
    backdrop.addEventListener("click", close);
  }

  window.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const nodes = getFocusableButtons();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.PronoteConfirm = { open: open, close: close };
})();
