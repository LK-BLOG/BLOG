/* 留言板：登录用显示名、可删自己的留言 */
(function () {
  "use strict";
  var form = document.getElementById("msg-form");
  var alertBox = document.getElementById("msg-alert");
  var listBox = document.getElementById("msg-list");
  var nickRow = document.getElementById("nickname-row");
  var nickInput = document.getElementById("nickname");
  var contentInput = document.getElementById("content");
  var authHint = document.getElementById("msg-auth");

  function showAlert(msg, type) {
    alertBox.innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
  }
  function esc(s) { return Blog.escapeHtml(s); }

  function renderAuth() {
    if (!authHint || !nickRow) return;
    if (Blog.isAuthed()) {
      var dn = Blog.getDisplayName() || Blog.getUsername() || "友人";
      authHint.innerHTML = '<p class="muted px12">以 <b>' + esc(dn) + "</b> 留言（不需填昵称）</p>";
      nickRow.style.display = "none";
    } else {
      authHint.innerHTML = '<p class="muted px12">游客可以填昵称留言；登录后自动用你的名字。</p>';
      nickRow.style.display = "";
    }
  }

  function loadMessages() {
    listBox.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/messages").then(function (data) {
      var list = (data && data.messages) || [];
      if (!list.length) {
        listBox.innerHTML = '<p class="muted px12">还没有留言，来说两句？</p>';
        return;
      }
      var html = '<div class="win-title"><span class="win-label">💬 留言条 ' + list.length + ' 条</span><span class="win-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div><div class="win-body">';
      list.forEach(function (m) {
        var ops = "";
        if (m.is_mine) {
          ops = '<div class="msg-ops"><button class="btn danger" data-del="' + m.id + '">删除</button></div>';
        }
        html += '<div class="msg">' +
          '<div class="msg-head"><span class="msg-nick">' + esc(m.nickname) + "</span><span>" + esc(Blog.fmtDate(m.created_at)) + "</span></div>" +
          '<div class="msg-content">' + esc(m.content) + "</div>" + ops +
          "</div>";
      });
      html += "</div>";
      listBox.innerHTML = html;
      listBox.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除这条留言？")) return;
          Blog.api("/api/messages/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
            .then(function () { loadMessages(); })
            .catch(function (err) { showAlert("删除失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      listBox.innerHTML = '<div class="alert error">加载失败：' + esc(err.message) + "（检查 config.js 里的 API 地址）</div>";
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    showAlert("");
    var content = contentInput.value.trim();
    if (!content) { showAlert("请填写内容"); return; }
    var payload = { content: content };
    if (!Blog.isAuthed()) {
      var nickname = nickInput.value.trim();
      if (!nickname) { showAlert("请填写昵称"); return; }
      payload.nickname = nickname;
    }
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    Blog.api("/api/messages", { method: "POST", body: payload })
      .then(function () {
        showAlert("留言成功", "ok");
        nickInput.value = "";
        contentInput.value = "";
        loadMessages();
      })
      .catch(function (err) {
        if (err.status === 429) showAlert("留言太频繁，请 60 秒后再试");
        else showAlert("留言失败：" + err.message);
      })
      .finally(function () { btn.disabled = false; });
  });

  renderAuth();
  loadMessages();
})();
