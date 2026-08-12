/* 文章详情：按 ?slug= 拉取并用 marked 渲染 Markdown + 评论区 */
(function () {
  "use strict";
  var box = document.getElementById("post");
  var commentsBox = document.getElementById("comments");
  var cmtList = document.getElementById("cmt-list");
  var cmtAlert = document.getElementById("cmt-alert");
  var cmtForm = document.getElementById("cmt-form");
  var slug = new URLSearchParams(location.search).get("slug") || "";

  function showCmtAlert(msg, type) {
    cmtAlert.innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
  }

  function loadComments() {
    cmtList.innerHTML = '<p class="muted">加载中…</p>';
    Blog.api("/api/articles/" + encodeURIComponent(slug) + "/comments").then(function (data) {
      var list = (data && data.comments) || [];
      if (!list.length) {
        cmtList.innerHTML = '<p class="muted">还没有评论，抢个沙发？</p>';
        return;
      }
      var html = "";
      list.forEach(function (m) {
        html += '<div class="msg">' +
          '<div class="msg-head"><span class="msg-nick">' + Blog.escapeHtml(m.nickname) + "</span><span>" + Blog.escapeHtml(Blog.fmtDate(m.created_at)) + "</span></div>" +
          '<div class="msg-content">' + Blog.escapeHtml(m.content) + "</div>" +
          "</div>";
      });
      cmtList.innerHTML = html;
    }).catch(function (err) {
      cmtList.innerHTML = '<div class="alert error">加载评论失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  if (!slug) {
    box.innerHTML = '<div class="win-body"><div class="alert error">缺少文章参数（?slug=xxx）</div></div>';
  } else {
    Blog.api("/api/articles/" + encodeURIComponent(slug)).then(function (a) {
      document.title = a.title + " - 小戡的博客";
      box.innerHTML =
        '<div class="win-title"><span class="win-label">📄 ' + Blog.escapeHtml(a.title) + '</span><span class="win-dots"><span class="dot"></span></span></div>' +
        '<div class="win-body">' +
          '<p class="post-meta">发布于 ' + Blog.escapeHtml(Blog.fmtDate(a.created_at)) +
          (a.updated_at && a.updated_at !== a.created_at ? " · 更新于 " + Blog.escapeHtml(Blog.fmtDate(a.updated_at)) : "") + "</p>" +
          '<div class="markdown-body">' + marked.parse(a.content_md) + "</div>" +
        "</div>";
      commentsBox.classList.remove("hidden");
      loadComments();
    }).catch(function (err) {
      box.innerHTML = '<div class="win-body"><div class="alert error">加载文章失败：' + Blog.escapeHtml(err.message) + "</div></div>";
    });
  }

  if (cmtForm) {
    cmtForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showCmtAlert("");
      var nickname = document.getElementById("cmt-nickname").value.trim();
      var content = document.getElementById("cmt-content").value.trim();
      if (!nickname || !content) { showCmtAlert("昵称和内容都不能为空。"); return; }
      var btn = cmtForm.querySelector("button");
      btn.disabled = true;
      Blog.api("/api/articles/" + encodeURIComponent(slug) + "/comments", { method: "POST", body: { nickname: nickname, content: content } })
        .then(function () {
          showCmtAlert("评论成功！", "ok");
          document.getElementById("cmt-nickname").value = "";
          document.getElementById("cmt-content").value = "";
          loadComments();
        })
        .catch(function (err) {
          if (err.status === 429) showCmtAlert("评论太频繁了，请 60 秒后再试。");
          else showCmtAlert("评论失败：" + err.message);
        })
        .finally(function () { btn.disabled = false; });
    });
  }
})();