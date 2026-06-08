(function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");
  const sidebarClose = document.getElementById("sidebarClose");
  const topbarTitle = document.getElementById("topbarTitle");

  const mq = window.matchMedia("(max-width: 768px)");

  const routes = {
    home: {
      viewId: "viewHome",
      title: "Pronote",
      documentTitle: "Pronote",
      navRoute: null,
    },
    all: {
      viewId: "viewAll",
      title: "Все задачи",
      documentTitle: "Все задачи — Pronote",
      navRoute: "all",
    },
    ideas: {
      viewId: "viewIdeas",
      title: "Идеи",
      documentTitle: "Идеи — Pronote",
      navRoute: "ideas",
    },
    dev: {
      viewId: "viewDev",
      title: "Разработка",
      documentTitle: "Разработка — Pronote",
      navRoute: "dev",
    },
    urgent: {
      viewId: "viewUrgent",
      title: "Срочно",
      documentTitle: "Срочно — Pronote",
      navRoute: "urgent",
    },
    done: {
      viewId: "viewDone",
      title: "Готово",
      documentTitle: "Готово — Pronote",
      navRoute: "done",
    },
    notes: {
      viewId: "viewNotes",
      title: "Заметки",
      documentTitle: "Заметки — Pronote",
      navRoute: "notes",
    },
    projects: {
      viewId: "viewProjects",
      title: "Проекты",
      documentTitle: "Проекты — Pronote",
      navRoute: "projects",
    },
  };

  const hashToRoute = {
    "": "home",
    "/": "home",
    "/ideas": "ideas",
    "/ideas/new": "ideas",
    "/ideas/discuss": "ideas",
    "/ideas/discussed": "ideas",
    "/ideas/future": "ideas",
    "/dev": "dev",
    "/dev/planned": "dev",
    "/dev/progress": "dev",
    "/dev/postponed": "dev",
    "/dev/waiting": "dev",
    "/urgent": "urgent",
    "/urgent/bug": "urgent",
    "/urgent/block": "urgent",
    "/urgent/main": "urgent",
    "/done": "done",
    "/notes": "notes",
    "/projects": "projects",
    "/all": "all",
  };

  const hashToSection = {
    "/ideas/new": "new",
    "/ideas/discuss": "discuss",
    "/ideas/discussed": "discussed",
    "/ideas/future": "future",
    "/dev/planned": "planned",
    "/dev/progress": "progress",
    "/dev/postponed": "postponed",
    "/dev/waiting": "waiting",
  };

  const routeToHash = {
    home: "#/",
    all: "#/all",
    ideas: "#/ideas",
    dev: "#/dev",
    urgent: "#/urgent",
    done: "#/done",
    notes: "#/notes",
    projects: "#/projects",
  };

  const sectionToHash = {
    ideas: {
      new: "#/ideas/new",
      discuss: "#/ideas/discuss",
      discussed: "#/ideas/discussed",
      future: "#/ideas/future",
    },
    dev: {
      planned: "#/dev/planned",
      progress: "#/dev/progress",
      postponed: "#/dev/postponed",
      waiting: "#/dev/waiting",
    },
  };

  const views = document.querySelectorAll(".view");
  const subLinks = document.querySelectorAll(".nav-sub__link[data-route]");
  const mainNavItems = document.querySelectorAll(".nav-item[data-route]");

  let pendingSection = null;
  let pendingRoute = null;

  function setSidebarOpen(open) {
    if (!sidebar || !overlay || !menuToggle) return;
    sidebar.classList.toggle("is-open", open);
    overlay.classList.toggle("is-visible", open);
    overlay.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open && mq.matches ? "hidden" : "";
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function getHashPath() {
    return window.location.hash.replace(/^#/, "") || "/";
  }

  function getRouteFromHash() {
    return hashToRoute[getHashPath()] || "home";
  }

  function getSectionFromHash() {
    return hashToSection[getHashPath()] || null;
  }

  function setMainNavActive(navRoute) {
    mainNavItems.forEach(function (item) {
      const active = navRoute && item.dataset.route === navRoute;
      item.classList.toggle("nav-item--active", active);
    });
  }

  function setSubNavActive(routeName, sectionKey) {
    subLinks.forEach(function (link) {
      const active = link.dataset.route === routeName && link.dataset.section === sectionKey;
      link.classList.toggle("nav-sub__link--active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setNavGroupOpen(groupId, open) {
    const group = document.querySelector('[data-nav-group="' + groupId + '"]');
    if (!group) return;
    group.classList.toggle("nav-group--open", open);
    const toggle = group.querySelector("[data-nav-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
    }
  }

  function closeOtherNavGroups(exceptGroupId) {
    document.querySelectorAll("[data-nav-group]").forEach(function (group) {
      const groupId = group.dataset.navGroup;
      if (groupId !== exceptGroupId) {
        setNavGroupOpen(groupId, false);
      }
    });
  }

  function syncNavGroups(routeName) {
    document.querySelectorAll("[data-nav-toggle]").forEach(function (toggle) {
      const group = toggle.closest("[data-nav-group]");
      if (!group) return;
      const groupId = group.dataset.navGroup;
      const isActiveRoute = groupId === routeName;
      toggle.classList.toggle("nav-item--active", isActiveRoute);
      if (isActiveRoute) {
        closeOtherNavGroups(groupId);
        setNavGroupOpen(groupId, true);
      }
    });
  }

  function handleNavGroupToggle(toggleLink) {
    const group = toggleLink.closest("[data-nav-group]");
    if (!group) return;

    const groupId = group.dataset.navGroup;
    const isOpen = group.classList.contains("nav-group--open");
    if (isOpen) {
      setNavGroupOpen(groupId, false);
    } else {
      closeOtherNavGroups(groupId);
      setNavGroupOpen(groupId, true);
    }
  }

  function scrollToSection(boardId, sectionKey) {
    if (!boardId || !sectionKey) return;
    const el = document.getElementById(boardId + "-section-" + sectionKey);
    if (el) {
      window.requestAnimationFrame(function () {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function notifyBoard(routeName, section) {
    const handler = window.PronoteBoardHandlers && window.PronoteBoardHandlers[routeName];
    if (handler && typeof handler.onNavigate === "function") {
      handler.onNavigate(routeName, section);
    }
  }

  function navigate(routeName, options) {
    const opts = options || {};
    const route = routes[routeName] || routes.home;
    const pushHash = opts.pushHash !== false;
    const section = opts.section !== undefined ? opts.section : getSectionFromHash();

    views.forEach(function (view) {
      const isActive = view.id === route.viewId;
      view.classList.toggle("view--active", isActive);
      view.hidden = !isActive;
    });

    setMainNavActive(route.navRoute);
    setSubNavActive(route.navRoute, section);
    syncNavGroups(routeName);

    if (topbarTitle) {
      topbarTitle.textContent = route.title;
    }
    document.title = route.documentTitle;

    if (pushHash) {
      let hash = routeToHash[routeName] || "#/";
      const map = sectionToHash[routeName];
      if (map && section && map[section]) {
        hash = map[section];
      }
      if (window.location.hash !== hash) {
        window.location.hash = hash;
      }
    }

    if (mq.matches) {
      closeSidebar();
    }

    if (route.navRoute) {
      pendingRoute = routeName;
      pendingSection = section;
      notifyBoard(routeName, section);
      pendingRoute = null;
      pendingSection = null;
    }

    if (routeName === "home") {
      if (window.renderHomeToday) window.renderHomeToday();
      if (window.renderHomeUrgentPreview) window.renderHomeUrgentPreview();
      if (window.renderHomeDone) window.renderHomeDone();
      if (window.renderHomeNotes) window.renderHomeNotes();
    }

    if (routeName === "done" && window.renderDonePage) {
      window.renderDonePage();
    }

    if (routeName === "notes" && window.renderNotesPage) {
      window.renderNotesPage();
    }

    if (routeName === "projects" && window.renderProjectsPage) {
      window.renderProjectsPage();
    }

    if (routeName === "all" && window.renderAllTasksPage) {
      window.renderAllTasksPage();
    }
  }

  function onRouteClick(e) {
    if (e.target.closest("[data-board-add-home]")) {
      e.preventDefault();
      return;
    }

    const navToggle = e.target.closest("[data-nav-toggle]");
    if (navToggle) {
      e.preventDefault();
      handleNavGroupToggle(navToggle);
      return;
    }

    const listLink = e.target.closest(".board-col__list a[data-route]");
    if (listLink) {
      const routeName = listLink.dataset.route;
      if (!routeName || !routes[routeName]) return;
      e.preventDefault();
      navigate(routeName, { section: listLink.dataset.section || null });
      return;
    }

    const boardCol = e.target.closest(".board-col--link[data-route]");
    if (boardCol) {
      const routeName = boardCol.dataset.route;
      if (!routeName || !routes[routeName]) return;
      e.preventDefault();
      navigate(routeName, { section: null });
      return;
    }

    const link = e.target.closest("[data-route]");
    if (!link) return;
    const routeName = link.dataset.route;
    if (!routeName || !routes[routeName]) return;

    e.preventDefault();
    navigate(routeName, { section: link.dataset.section || null });
  }

  function onBoardColKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("[data-board-add-home]")) return;
    const boardCol = e.target.closest(".board-col--link[data-route]");
    if (!boardCol || e.target.closest(".board-col__list a[data-route]")) return;
    e.preventDefault();
    const routeName = boardCol.dataset.route;
    if (routeName && routes[routeName]) {
      navigate(routeName, { section: null });
    }
  }

  if (sidebar && overlay && menuToggle) {
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
  }

  document.addEventListener("click", onRouteClick);
  document.addEventListener("keydown", onBoardColKeydown);

  document.querySelectorAll(".nav-item:not([data-route]):not([data-nav-toggle])").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (mq.matches) closeSidebar();
    });
  });

  window.addEventListener("hashchange", function () {
    navigate(getRouteFromHash(), { pushHash: false });
  });

  window.PronoteRouter = {
    scrollToSection: scrollToSection,
    scrollToIdeasSection: function (sectionKey) {
      scrollToSection("ideas", sectionKey);
    },
    getPendingSection: function () {
      return pendingSection;
    },
  };

  window.PronoteApp = {
    navigate: navigate,
    boot: function () {
      navigate(getRouteFromHash(), { pushHash: false });
    },
  };
})();
