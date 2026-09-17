/* OS 主题：Win98 风格 WebOS 桌面 */
(function () {
  "use strict";

  if (window.__XIAOKAN_EMBEDDED__) return;

  var APPS = [
    { id: "home", title: "我的电脑", icon: "computer", url: "index.html" },
    { id: "articles", title: "文章", icon: "document", url: "articles.html" },
    { id: "guestbook", title: "留言板", icon: "mail", url: "guestbook.html" },
    { id: "about", title: "关于", icon: "about", url: "about.html" },
    { id: "friends", title: "友链", icon: "friends", url: "friends.html" },
    { id: "chat", title: "机器人", icon: "robot", special: "chat" },
    { id: "admin", title: "管理", icon: "settings", url: "admin.html" }
  ];
  var HIDDEN_APPS = [
    { id: "login", title: "登录 / 注册", icon: "key", url: "login.html" }
  ];

  var shell = null;
  var desktop = null;
  var windowsBox = null;
  var tasksBox = null;
  var startMenu = null;
  var clockEl = null;
  var zIndex = 100;
  var openCount = 0;
  var coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  function make(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function icon(name, className) {
    return '<img class="os-svg-icon ' + (className || "") + '" src="assets/win98-icons/' + name + '.png" alt="">';
  }

  function appById(id) {
    var all = APPS.concat(HIDDEN_APPS);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function embedUrl(url) {
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "embed=1";
  }

  function buildShell() {
    if (shell) return;
    shell = make("div", "os-shell hidden");
    shell.id = "os-shell";
    shell.setAttribute("role", "application");
    shell.setAttribute("aria-label", "小戡 OS 桌面");
    shell.innerHTML =
      '<div class="os-desktop" id="os-desktop">' +
        '<div class="os-icons" id="os-icons"></div>' +
        '<div class="os-windows" id="os-windows"></div>' +
      '</div>' +
      '<div class="os-boot hidden" id="os-boot">' +
        '<div class="os-boot-logo">小戡 OS</div>' +
        '<div class="os-boot-bar"><span></span></div>' +
        '<div class="os-boot-text">正在启动...</div>' +
      '</div>' +
      '<div class="os-taskbar">' +
        '<button class="os-start-btn" id="os-start-btn" type="button"><span class="os-start-logo">' + icon("windows") + '</span>开始</button>' +
        '<div class="os-tasks" id="os-tasks"></div>' +
        '<div class="os-tray">' +
          '<select class="os-theme-select" data-theme-select aria-label="主题">' +
            '<option value="normal">Normal</option>' +
            '<option value="os">OS</option>' +
          '</select>' +
          '<span id="os-clock"></span>' +
        '</div>' +
      '</div>' +
      '<div class="os-start-menu hidden" id="os-start-menu">' +
        '<div class="os-start-side">小戡 OS</div>' +
        '<div class="os-start-items">' +
          '<div class="os-start-group">' +
            '<button type="button" data-os-sub="programs">' + icon("folder") + ' 程序 <span class="os-menu-arrow"></span></button>' +
            '<div class="os-submenu hidden">' +
              '<button type="button" data-os-open="home">' + icon("computer") + ' 我的电脑</button>' +
              '<button type="button" data-os-open="articles">' + icon("document") + ' 文章</button>' +
              '<button type="button" data-os-open="guestbook">' + icon("guestbook") + ' 留言板</button>' +
              '<button type="button" data-os-open="chat">' + icon("robot") + ' 机器人</button>' +
              '<button type="button" data-os-open="login">' + icon("key") + ' 登录 / 注册</button>' +
              '<button type="button" data-os-open="admin">' + icon("settings") + ' 管理</button>' +
            '</div>' +
          '</div>' +
          '<div class="os-start-group">' +
            '<button type="button" data-os-sub="documents">' + icon("document") + ' 文档 <span class="os-menu-arrow"></span></button>' +
            '<div class="os-submenu hidden">' +
              '<button type="button" data-os-open="articles">最新文章</button>' +
              '<button type="button" data-os-open="guestbook">留言记录</button>' +
            '</div>' +
          '</div>' +
          '<div class="os-start-group">' +
            '<button type="button" data-os-sub="settings">' + icon("settings") + ' 设置 <span class="os-menu-arrow"></span></button>' +
            '<div class="os-submenu hidden">' +
              '<button type="button" data-os-theme="normal">切换到 Normal</button>' +
              '<button type="button" data-os-theme="os">保持 OS</button>' +
            '</div>' +
          '</div>' +
          '<button type="button" data-os-open="about">' + icon("help") + ' 帮助</button>' +
          '<button type="button" data-os-open="articles">' + icon("search") + ' 查找</button>' +
          '<button type="button" data-os-run="1">' + icon("run") + ' 运行...</button>' +
          '<div class="os-start-sep"></div>' +
          '<button type="button" data-os-shutdown="1">' + icon("power") + ' 关闭系统...</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(shell);
    desktop = document.getElementById("os-desktop");
    windowsBox = document.getElementById("os-windows");
    tasksBox = document.getElementById("os-tasks");
    startMenu = document.getElementById("os-start-menu");
    startMenu.setAttribute("role", "menu");
    clockEl = document.getElementById("os-clock");
    var themeSelect = shell.querySelector("[data-theme-select]");
    if (themeSelect) themeSelect.value = document.documentElement.getAttribute("data-theme") || "normal";
    renderIcons();
    bindTaskbar();
    updateClock();
    setInterval(updateClock, 30000);
  }

  function renderIcons() {
    var box = document.getElementById("os-icons");
    APPS.forEach(function (app) {
      var item = make("button", "os-icon", '<span class="os-icon-img">' + icon(app.icon) + '</span><span>' + app.title + '</span>');
      item.type = "button";
      item.dataset.app = app.id;
      item.title = "双击打开";
      bindIcon(item, function () { openApp(app.id); });
      box.appendChild(item);
    });
    var bin = make("button", "os-icon", '<span class="os-icon-img">' + icon("recycle") + '</span><span>回收站</span>');
    bin.type = "button";
    bin.title = "双击打开";
    bindIcon(bin, function () { openSpecial("bin", "回收站", '<div class="os-empty">回收站是空的。</div>', null, "recycle"); });
    box.appendChild(bin);
  }

  function bindIcon(icon, open) {
    var lastClick = 0;
    icon.addEventListener("click", function (e) {
      e.stopPropagation();
      selectIcon(icon);
      if (coarsePointer) { open(); return; }
      var now = Date.now();
      if (now - lastClick <= 500) { lastClick = 0; open(); }
      else { lastClick = now; }
    });
  }

  function selectIcon(icon) {
    shell.querySelectorAll(".os-icon.selected").forEach(function (item) { item.classList.remove("selected"); });
    icon.classList.add("selected");
  }

  function bindTaskbar() {
    document.getElementById("os-start-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      startMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", function (e) {
      if (startMenu && !startMenu.classList.contains("hidden") && !e.target.closest(".os-start-menu") && !e.target.closest("#os-start-btn")) {
        startMenu.classList.add("hidden");
      }
    });
    shell.querySelectorAll("[data-os-sub]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var sub = btn.nextElementSibling;
        var show = sub && sub.classList.contains("hidden");
        closeSubmenus();
        if (sub && show) sub.classList.remove("hidden");
      });
    });
    shell.querySelectorAll("[data-os-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSubmenus();
        startMenu.classList.add("hidden");
        openApp(btn.dataset.osOpen);
      });
    });
    shell.querySelectorAll("[data-os-theme]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSubmenus();
        startMenu.classList.add("hidden");
        if (window.Blog && window.Blog.applyTheme) window.Blog.applyTheme(btn.dataset.osTheme);
      });
    });
    shell.querySelectorAll("[data-os-shutdown]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSubmenus();
        startMenu.classList.add("hidden");
        openShutdownDialog();
      });
    });
    shell.querySelectorAll("[data-os-run]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSubmenus();
        startMenu.classList.add("hidden");
        openRunDialog();
      });
    });
    desktop.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });
    desktop.addEventListener("click", function (e) {
      if (e.target === desktop || e.target.classList.contains("os-icons") || e.target.classList.contains("os-windows")) {
        shell.querySelectorAll(".os-icon.selected").forEach(function (item) { item.classList.remove("selected"); });
        closeContextMenu();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeSubmenus();
        closeContextMenu();
        startMenu.classList.add("hidden");
      }
      if (e.ctrlKey && e.key === "Escape") {
        e.preventDefault();
        startMenu.classList.toggle("hidden");
      }
    });
  }

  function closeSubmenus() {
    shell.querySelectorAll(".os-submenu").forEach(function (menu) { menu.classList.add("hidden"); });
  }

  function showContextMenu(x, y) {
    var menu = document.getElementById("os-context-menu");
    if (!menu) {
      menu = make("div", "os-context-menu hidden");
      menu.id = "os-context-menu";
      menu.innerHTML =
        '<button type="button" data-ctx="refresh">刷新</button>' +
        '<button type="button" data-ctx="arrange">排列图标</button>' +
        '<button type="button" data-ctx="normal">显示 Normal</button>' +
        '<div class="os-start-sep"></div>' +
        '<button type="button" data-ctx="properties">属性</button>';
      shell.appendChild(menu);
      menu.addEventListener("click", function (e) {
        var action = e.target.dataset.ctx;
        if (!action) return;
        closeContextMenu();
        if (action === "normal") {
          if (window.Blog && window.Blog.applyTheme) window.Blog.applyTheme("normal");
        } else if (action === "refresh") {
          windowsBox.querySelectorAll("iframe").forEach(function (frame) { frame.contentWindow.location.reload(); });
        } else if (action === "arrange") {
          var kids = shell.querySelectorAll(".os-window");
          kids.forEach(function (win, index) {
            win.classList.remove("maximized");
            win.style.left = (70 + (index % 6) * 26) + "px";
            win.style.top = (36 + (index % 6) * 20) + "px";
          });
        } else if (action === "properties") {
          openSpecial("sysinfo", "系统属性", '<div class="os-special"><p><strong>小戡 OS</strong></p><p>博客 WebOS 主题 / Win98 风格</p><p class="muted">主题：' + document.documentElement.getAttribute("data-theme") + '</p></div>', null, "settings");
        }
      });
    }
    menu.style.left = Math.min(x, window.innerWidth - 180) + "px";
    menu.style.top = Math.min(y, window.innerHeight - 180) + "px";
    menu.classList.remove("hidden");
  }

  function closeContextMenu() {
    var menu = document.getElementById("os-context-menu");
    if (menu) menu.classList.add("hidden");
  }

  function openRunDialog() {
    openSpecial("run", "运行", '<div class="os-dialog"><p>输入要打开的页面：</p><input class="field" id="os-run-input" value="index.html"><div class="os-dialog-actions"><button class="btn primary" type="button" data-run-go>确定</button><button class="btn" type="button" data-run-cancel>取消</button></div></div>', function (win) {
      win.querySelector("[data-run-go]").addEventListener("click", function () {
        var value = win.querySelector("#os-run-input").value.trim();
        var app = APPS.filter(function (item) { return item.url === value || item.id === value; })[0];
        closeWindow(win);
        if (app) openApp(app.id);
        else {
          var result = openSpecial("run-result", "运行", '<div class="os-dialog">找不到：<span data-run-missing></span></div>', null, "run");
          var missing = result.querySelector("[data-run-missing]");
          if (missing) missing.textContent = value;
        }
      });
      win.querySelector("[data-run-cancel]").addEventListener("click", function () { closeWindow(win); });
    }, "run");
  }

  function openShutdownDialog() {
    openSpecial("shutdown", "关闭系统", '<div class="os-dialog"><p>你想做什么？</p><div class="os-shutdown-options"><button class="btn" type="button" data-shutdown-normal>关闭到 Normal</button><button class="btn" type="button" data-shutdown-restart>重新启动 OS</button><button class="btn" type="button" data-shutdown-cancel>取消</button></div></div>', function (win) {
      win.querySelector("[data-shutdown-normal]").addEventListener("click", function () {
        closeWindow(win);
        if (window.Blog && window.Blog.applyTheme) window.Blog.applyTheme("normal");
      });
      win.querySelector("[data-shutdown-restart]").addEventListener("click", function () {
        closeWindow(win);
        showBoot();
      });
      win.querySelector("[data-shutdown-cancel]").addEventListener("click", function () { closeWindow(win); });
    }, "power");
  }

  function showBoot() {
    var boot = document.getElementById("os-boot");
    if (!boot) return;
    boot.classList.remove("hidden");
    setTimeout(function () { boot.classList.add("hidden"); }, 900);
  }

  function openApp(id) {
    var app = appById(id);
    if (!app) return;
    if (app.special === "chat") { toggleChat(); return; }
    var existing = windowsBox.querySelector('.os-window[data-app="' + id + '"]');
    if (existing) {
      restoreWindow(existing);
      focusWindow(existing);
      return;
    }
    var win = make("div", "os-window");
    win.dataset.app = id;
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", app.title);
    win.tabIndex = -1;
    var url = app.url;
    if (app.id === "login") {
      var next = new URLSearchParams(location.search).get("next") || "index.html";
      url = "login.html?next=" + encodeURIComponent(next);
    }
    win.innerHTML =
      '<div class="os-titlebar">' +
        '<div class="os-titlebar-text">' + icon(app.icon) + '<span>' + app.title + '</span></div>' +
        '<div class="os-titlebar-buttons">' +
          '<button type="button" class="os-win-min" title="最小化" aria-label="最小化">_</button>' +
          '<button type="button" class="os-win-max" title="最大化" aria-label="最大化">□</button>' +
          '<button type="button" class="os-win-close" title="关闭" aria-label="关闭">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="os-window-content"><iframe src="' + embedUrl(url) + '" title="' + app.title + '"></iframe></div>';
    windowsBox.appendChild(win);
    placeWindow(win);
    bindWindow(win);
    createTask(app, win);
    focusWindow(win);
  }

  function toggleChat() {
    var chat = document.getElementById("chat-window");
    if (!chat) return;
    chat.classList.toggle("open");
    if (chat.classList.contains("open")) {
      var input = document.getElementById("chat-input");
      if (input) setTimeout(function () { input.focus(); }, 50);
    }
  }

  function openSpecial(id, title, html, onReady, iconName) {
    var existing = windowsBox.querySelector('.os-window[data-app="' + id + '"]');
    if (existing) { restoreWindow(existing); focusWindow(existing); if (onReady) onReady(existing); return existing; }
    var win = make("div", "os-window");
    win.dataset.app = id;
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", title);
    win.tabIndex = -1;
    win.innerHTML =
      '<div class="os-titlebar"><div class="os-titlebar-text">' + icon(iconName || "recycle") + '<span>' + title + '</span></div>' +
      '<div class="os-titlebar-buttons"><button type="button" class="os-win-min" aria-label="最小化">_</button><button type="button" class="os-win-max" aria-label="最大化">□</button><button type="button" class="os-win-close" aria-label="关闭">✕</button></div></div>' +
      '<div class="os-window-content os-special">' + html + '</div>';
    windowsBox.appendChild(win);
    placeWindow(win);
    bindWindow(win);
    createTask({ id: id, title: title, icon: iconName || "recycle" }, win);
    focusWindow(win);
    if (onReady) onReady(win);
    return win;
  }

  function placeWindow(win) {
    var step = openCount++ % 7;
    var left = Math.min(70 + step * 28, Math.max(10, window.innerWidth - 760));
    var top = Math.min(36 + step * 22, Math.max(10, window.innerHeight - 560));
    win.style.left = Math.max(8, left) + "px";
    win.style.top = Math.max(8, top) + "px";
    if (window.innerWidth < 760) win.classList.add("maximized");
  }

  function bindWindow(win) {
    var titlebar = win.querySelector(".os-titlebar");
    var min = win.querySelector(".os-win-min");
    var max = win.querySelector(".os-win-max");
    var close = win.querySelector(".os-win-close");
    titlebar.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".os-titlebar-buttons") || win.classList.contains("maximized")) return;
      var rect = win.getBoundingClientRect();
      var startX = e.clientX, startY = e.clientY;
      var left = rect.left, top = rect.top;
      function move(ev) {
        win.style.left = Math.max(0, left + ev.clientX - startX) + "px";
        win.style.top = Math.max(0, top + ev.clientY - startY) + "px";
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      focusWindow(win);
    });
    min.addEventListener("click", function (e) { e.stopPropagation(); minimizeWindow(win); });
    max.addEventListener("click", function (e) { e.stopPropagation(); win.classList.toggle("maximized"); focusWindow(win); });
    close.addEventListener("click", function (e) { e.stopPropagation(); closeWindow(win); });
    win.addEventListener("pointerdown", function () { focusWindow(win); });
    titlebar.addEventListener("dblclick", function (e) {
      if (!e.target.closest(".os-titlebar-buttons")) win.classList.toggle("maximized");
    });
  }

  function createTask(app, win) {
    var btn = make("button", "os-task", icon(app.icon) + '<span>' + app.title + '</span>');
    btn.type = "button";
    btn.dataset.app = app.id;
    btn.addEventListener("click", function () {
      if (win.classList.contains("minimized")) restoreWindow(win);
      focusWindow(win);
    });
    tasksBox.appendChild(btn);
    win.__task = btn;
  }

  function focusWindow(win) {
    windowsBox.querySelectorAll(".os-window").forEach(function (w) { w.classList.remove("active"); });
    tasksBox.querySelectorAll(".os-task").forEach(function (b) { b.classList.remove("active"); });
    win.classList.remove("active");
    void win.offsetWidth;
    win.classList.add("active");
    win.style.zIndex = String(++zIndex);
    if (win.__task) win.__task.classList.add("active");
  }

  function minimizeWindow(win) {
    win.classList.add("minimized");
    if (win.__task) win.__task.classList.remove("active");
  }

  function restoreWindow(win) {
    win.classList.remove("minimized");
  }

  function closeWindow(win) {
    if (win.__task) win.__task.remove();
    win.remove();
  }

  function updateClock() {
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function setTheme(theme) {
    if (theme === "os") {
      buildShell();
      var wasHidden = shell.classList.contains("hidden");
      shell.classList.remove("hidden");
      if (wasHidden) showBoot();
    } else if (shell) {
      shell.classList.add("hidden");
    }
  }

  function init() {
    var theme = document.documentElement.getAttribute("data-theme");
    if (theme === "os") {
      setTheme("os");
      var openAppId = new URLSearchParams(location.search).get("open");
      if (openAppId) setTimeout(function () { openApp(openAppId); }, 1000);
      var currentFile = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      var currentApp = APPS.concat(HIDDEN_APPS).filter(function (app) { return app.url === currentFile; })[0];
      if (!openAppId && currentApp && currentFile !== "index.html") {
        setTimeout(function () { openApp(currentApp.id); }, 1000);
      }
    }
    window.XiaokanOS = { setTheme: setTheme, openApp: openApp };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
