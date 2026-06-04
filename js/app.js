(function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");
  const sidebarClose = document.getElementById("sidebarClose");

  if (!sidebar || !overlay || !menuToggle) return;

  const mq = window.matchMedia("(max-width: 768px)");

  function setSidebarOpen(open) {
    sidebar.classList.toggle("is-open", open);
    overlay.classList.toggle("is-visible", open);
    overlay.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open && mq.matches ? "hidden" : "";
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  menuToggle.addEventListener("click", function () {
    setSidebarOpen(!sidebar.classList.contains("is-open"));
  });

  if (sidebarClose) {
    sidebarClose.addEventListener("click", closeSidebar);
  }

  overlay.addEventListener("click", closeSidebar);

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSidebar();
  });

  mq.addEventListener("change", function () {
    if (!mq.matches) closeSidebar();
  });

  document.querySelectorAll(".nav-item, .nav-sub a, .board-col__list a").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (mq.matches) closeSidebar();
    });
  });
})();
