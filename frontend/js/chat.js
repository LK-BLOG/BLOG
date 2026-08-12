/* AI 机器人聊天窗（需登录） */
(function () {
  "use strict";
  var history = [];

  function $(id) { return document.getElementById(id); }

  function addMsg(role, text) {
    var box = $("chat-msgs");
    if (!box) return;
    var d = document.createElement("div");
    d.className = "chat-msg " + (role === "user" ? "me" : "bot");
    var nick = document.createElement("div");
    nick.className = "chat-nick";
    nick.textContent = role === "user" ? "我" : "🤖 机器人";
    var body = document.createElement("div");
    body.className = "chat-text";
    body.textContent = text;
    d.appendChild(nick); d.appendChild(body);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function typing(on) {
    var t = $("chat-typing");
    if (t) t.style.display = on ? "block" : "none";
  }

  function loginUrl() {
    return "login.html?next=" + encodeURIComponent(location.pathname);
  }

  function renderAuth() {
    var win = $("chat-window");
    var authed = Blog.isAuthed();

    var userSpan = $("chat-user");
    if (!userSpan && win) {
      userSpan = document.createElement("span");
      userSpan.id = "chat-user";
      userSpan.style.cssText = "font-size:12px;margin-left:8px;color:#c0c0c0;";
      var title = win.querySelector(".win-title");
      if (title) title.insertBefore(userSpan, title.querySelector(".win-dots"));
    }
    if (userSpan) {
      if (authed) {
        var u = Blog.getUsername() || "？";
        var role = Blog.getRole() === "admin" ? " · 管理员" : "";
        userSpan.textContent = "[" + u + role + "]";
      } else {
        userSpan.textContent = "";
      }
    }

    var logoutBtn = $("chat-logout");
    if (!logoutBtn && win) {
      logoutBtn = document.createElement("button");
      logoutBtn.id = "chat-logout";
      logoutBtn.textContent = "退出";
      logoutBtn.style.cssText = "font-size:11px;margin-left:6px;";
      logoutBtn.addEventListener("click", function () {
        Blog.logout();
        renderAuth();
      });
      var title2 = win.querySelector(".win-title");
      if (title2) title2.insertBefore(logoutBtn, title2.querySelector(".win-dots"));
    }
    if (logoutBtn) logoutBtn.style.display = authed ? "" : "none";

    var inputRow = $("chat-input-row");
    if (inputRow) inputRow.style.display = authed ? "" : "none";

    var hint = $("chat-login-hint");
    if (!authed) {
      if (!hint) {
        hint = document.createElement("div");
        hint.id = "chat-login-hint";
        hint.style.cssText = "border:2px inset;border-color:#808080 #fff #fff #808080;background:#fff;padding:10px 8px;margin:6px;text-align:center;font-size:13px;";
        var tip = document.createElement("div");
        tip.textContent = "登录后才能和机器人聊天。注册免费，每个账号每天有一定轮数。";
        var btn = document.createElement("button");
        btn.className = "btn primary";
        btn.textContent = "去登录 / 注册";
        btn.style.cssText = "margin-top:8px;";
        btn.addEventListener("click", function () { location.href = loginUrl(); });
        hint.appendChild(tip); hint.appendChild(btn);
        var box = $("chat-msgs");
        if (box) box.appendChild(hint);
      }
      hint.style.display = "block";
    } else if (hint) {
      hint.style.display = "none";
    }
  }

  function send() {
    if (!Blog.isAuthed()) { renderAuth(); return; }
    var input = $("chat-input");
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMsg("user", text);
    history.push({ role: "user", content: text });
    typing(true);
    Blog.api("/api/chat", { method: "POST", body: { messages: history.slice(-12) } })
      .then(function (data) {
        var reply = (data && data.reply) || "……";
        history.push({ role: "assistant", content: reply });
        addMsg("bot", reply);
      })
      .catch(function (err) {
        if (err.status === 401) {
          Blog.logout();
          history = [];
          renderAuth();
          addMsg("bot", "登录已过期，请重新登录后再聊");
          return;
        }
        addMsg("bot", err.message || "机器人开小差了，稍后再试");
      })
      .finally(function () { typing(false); });
  }

  function toggle() {
    var w = $("chat-window");
    if (!w) return;
    var willOpen = !w.classList.contains("open");
    w.classList.toggle("open", willOpen);
    if (willOpen) {
      renderAuth();
      var i = $("chat-input");
      if (Blog.isAuthed() && i) i.focus();
    }
  }

  function init() {
    var fab = $("chat-fab"), close = $("chat-close"), sendBtn = $("chat-send"), input = $("chat-input");
    if (fab) fab.addEventListener("click", toggle);
    if (close) close.addEventListener("click", function () { var w = $("chat-window"); if (w) w.classList.remove("open"); });
    if (sendBtn) sendBtn.addEventListener("click", send);
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    renderAuth();
  }

  init();
})();
