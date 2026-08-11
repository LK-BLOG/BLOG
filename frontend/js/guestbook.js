/* 留言板：拉取 + 提交（限频提示由服务端 429 处理） */
(function () {
  "use strict";
  var form = document.getElementById("msg-form");
  var alertBox = document.getElementById("msg-alert");
  var listBox = document.getElementById("msg-list");
  var nickInput = document.getElementById("nickname");
  var contentInput = document.getElementById("content");

  function showAlert(msg, type) {
    alertBox.innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
  }

  function loadMessages() {
    listBox.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/messages").then(function (data) {
      var list = (data && data.messages) || [];
      if (!list.length) {
        listBox.innerHTML = '<p class="muted px12">还没有留言，沙发等你来抢。</p>';
        return;
      }
      var html = '<div class="win-title"><span class="win-label">💬 全部留言（' + list.length + '）</span><span class="win-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div><div class="win-body">';
      list.forEach(function (m) {
        html += '<div class="msg">' +
          '<div class="msg-head"><span class="msg-nick">' + Blog.escapeHtml(m.nickname) + "</span><span>" + Blog.escapeHtml(Blog.fmtDate(m.created_at)) + "</span></div>" +
          '<div class="msg-content">' + Blog.escapeHtml(m.content) + "</div>" +
          "</div>";
      });
      html += "</div>";
      listBox.innerHTML = html;
    }).catch(function (err) {
      listBox.innerHTML = '<div class="alert error">加载留言失败：' + Blog.escapeHtml(err.message) + "（请检查 config.js 里的 API 地址）</div>";
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    showAlert("");
    var nickname = nickInput.value.trim();
    var content = contentInput.value.trim();
    if (!nickname || !content) { showAlert("昵称和内容都不能为空。"); return; }
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    Blog.api("/api/messages", { method: "POST", body: { nickname: nickname, content: content } })
      .then(function () {
        showAlert("留言成功！", "ok");
        nickInput.value = "";
        contentInput.value = "";
        loadMessages();
      })
      .catch(function (err) {
        if (err.status === 429) showAlert("留言太频繁了，请 60 秒后再试。");
        else showAlert("留言失败：" + err.message);
      })
      .finally(function () { btn.disabled = false; });
  });

  loadMessages();
})();