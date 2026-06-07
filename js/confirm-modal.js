(function () {
  const modal = document.getElementById("confirmModal");
  const backdrop = document.getElementById("confirmModalBackdrop");
  const titleEl = document.getElementById("confirmModalTitle");
  const messageEl = document.getElementById("confirmModalMessage");
  const cancelBtn = document.getElementById("confirmModalCancel");
  const confirmBtn = document.getElementById("confirmModalConfirm");

  if (!modal || !cancelBtn || !confirmBtn) return;

  let onConfirm = null;
  let lastFocus = null;

  function close() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    onConfirm = null;
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function open(options) {
    const opts = options || {};
    lastFocus = document.activeElement;

    if (titleEl) titleEl.textContent = opts.title || "Подтвердите действие";
    if (messageEl) {
      messageEl.textContent = opts.message || "";
      messageEl.hidden = !opts.message;
    }
    confirmBtn.textContent = opts.confirmLabel || "Удалить";

    onConfirm = typeof opts.onConfirm === "function" ? opts.onConfirm : null;

    modal.hidden = false;
    document.body.classList.add("modal-open");
    cancelBtn.focus();
  }

  function handleConfirm() {
    if (onConfirm) onConfirm();
    close();
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
      const nodes = [cancelBtn, confirmBtn];
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
