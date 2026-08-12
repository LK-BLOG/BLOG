/* AI 机器人聊天窗 */
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
    nick.textContent = role === "user" ? "你" : "🤖 机器人";
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

  function send() {
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
        addMsg("bot", err.message || "机器人开小差了，稍后再试");
      })
      .finally(function () { typing(false); });
  }

  function toggle() {
    var w = $("chat-window");
    if (!w) return;
    var willOpen = !w.classList.contains("open");
    w.classList.toggle("open", willOpen);
    if (willOpen) { var i = $("chat-input"); if (i) i.focus(); }
  }

  function init() {
    var fab = $("chat-fab"), close = $("chat-close"), sendBtn = $("chat-send"), input = $("chat-input");
    if (fab) fab.addEventListener("click", toggle);
    if (close) close.addEventListener("click", function () { var w = $("chat-window"); if (w) w.classList.remove("open"); });
    if (sendBtn) sendBtn.addEventListener("click", send);
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  }

  init();
})();