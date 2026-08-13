/* 文章页：slug=? 加载 marked 渲染 + 评论（登录制/回复/@Bot/删自己） */
(function () {
  "use strict";
  var box = document.getElementById("post");
  var commentsBox = document.getElementById("comments");
  var cmtList = document.getElementById("cmt-list");
  var cmtAlert = document.getElementById("cmt-alert");
  var cmtAuth = document.getElementById("cmt-auth");
  var cmtForm = document.getElementById("cmt-form");
  var cmtReplyTo = document.getElementById("cmt-replyto");
  var cmtCancel = document.getElementById("cmt-cancel-reply");
  var slug = new URLSearchParams(location.search).get("slug") || "";
  var replyingTo = null;

  function showCmtAlert(msg, type) {
    if (!cmtAlert) return;
    cmtAlert.innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
  }

  function loginUrl() {
    return "login.html?next=" + encodeURIComponent(location.pathname + location.search);
  }

  function renderAuth() {
    if (!cmtAuth || !cmtForm) return;
    if (Blog.isAuthed()) {
      var dn = Blog.getDisplayName() || Blog.getUsername() || "友人";
      cmtAuth.innerHTML = '<p class="muted px12">以 <b>' + Blog.escapeHtml(dn) + "</b> 评论</p>";
      cmtForm.classList.remove("hidden");
    } else {
      cmtAuth.innerHTML = '<div class="win flat" style="padding:10px;text-align:center">' +
        '<p class="muted mb8">登录后才能发评论</p>' +
        '<a class="btn primary" href="' + loginUrl() + '">去登录 / 注册</a></div>';
      cmtForm.classList.add("hidden");
    }
  }

  function esc(s) { return Blog.escapeHtml(s); }

  var collapsed = {};

  function renderComments(list) {
    var depth = {};
    var parentMap = {};
    var childCount = {};
    list.forEach(function (m) {
      depth[m.id] = m.parent_id ? (depth[m.parent_id] || 0) + 1 : 0;
      parentMap[m.id] = m.parent_id || 0;
      if (m.parent_id) childCount[m.parent_id] = (childCount[m.parent_id] || 0) + 1;
    });
    function hiddenByCollapse(m) {
      var p = parentMap[m.id];
      var guard = 0;
      while (p && guard < 20) {
        if (collapsed[p]) return true;
        p = parentMap[p] || 0;
        guard++;
      }
      return false;
    }
    var html = "";
    list.forEach(function (m) {
      if (hiddenByCollapse(m)) return;
      var d = Math.min(depth[m.id] || 0, 5);
      var style = d ? "margin-left:" + (d * 28) + "px;" : "";
      var nickCls = m.is_bot ? 'style="color:#008080;font-weight:bold"' : "";
      var ops = "";
      var kids = childCount[m.id] || 0;
      if (kids) {
        ops += "<button class='btn' data-toggle='" + m.id + "'>" + (collapsed[m.id] ? "▸ 展开" : "▾ 折叠") + " (" + kids + ")</button> ";
      }
      ops += "<button class='btn' data-reply='" + m.id + "' data-nick='" + esc(m.nickname) + "'>回复</button> ";
      if (m.is_mine) {
        ops += "<button class='btn danger' data-del='" + m.id + "'>删除</button>";
      } else if (!m.is_bot) {
        ops += "<button class='btn' data-report='" + m.id + "'>举报</button>";
      }
      html += '<div class="msg" style="' + style + '">' +
        '<div class="msg-head"><span class="msg-nick" ' + nickCls + ">" + esc(m.nickname) + "</span><span>" + esc(Blog.fmtDate(m.created_at)) + "</span></div>" +
        '<div class="msg-content">' + esc(m.content) + "</div>" +
        (ops ? '<div class="msg-ops">' + ops + "</div>" : "") +
        "</div>";
    });
    cmtList.innerHTML = html;
    cmtList.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.toggle;
        collapsed[id] = !collapsed[id];
        renderComments(list);
      });
    });
    cmtList.querySelectorAll("[data-reply]").forEach(function (b) {
      b.addEventListener("click", function () {
        replyingTo = { id: b.dataset.reply, nick: b.dataset.nick };
        cmtReplyTo.textContent = "回复 @" + b.dataset.nick;
        cmtCancel.classList.remove("hidden");
        var ta = document.getElementById("cmt-content");
        if (ta) ta.focus();
      });
    });
    cmtList.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("确定删除这条评论？")) return;
        Blog.api("/api/comments/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
          .then(function () { loadComments(); })
          .catch(function (err) { showCmtAlert("删除失败：" + err.message); });
      });
    });
    cmtList.querySelectorAll("[data-report]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("举报这条评论？机器人会自动审核。")) return;
        var btn = b;
        btn.disabled = true;
        Blog.api("/api/reports", { method: "POST", body: { target_type: "comment", target_id: parseInt(b.dataset.report, 10), reason: "内容违规" } })
          .then(function (d) {
            if (d.action === "deleted_banned") showCmtAlert("已处理：违规，已删除并封禁作者", "ok");
            else if (d.action === "deleted") showCmtAlert("已处理：违规，已删除", "ok");
            else showCmtAlert("审核结果：未发现违规", "ok");
            loadComments();
          })
          .catch(function (err) {
            if (err.status === 409) showCmtAlert("你已经举报过这条评论");
            else if (err.status === 429) showCmtAlert("举报太频繁，请 60 秒后再试");
            else showCmtAlert("举报失败：" + err.message);
          })
          .finally(function () { btn.disabled = false; });
      });
    });
  }

  function bindPopups() {
    document.querySelectorAll(".popup-btn").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        showWin98Popup(btn.getAttribute("data-msg") || "");
      });
    });
  }

  function showWin98Popup(msg) {
    var old = document.getElementById("popup-overlay");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "popup-overlay";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;";
    var win = document.createElement("div");
    win.className = "win";
    win.style.cssText = "width:340px;max-width:90vw;";
    win.innerHTML =
      '<div class="win-title"><span class="win-label">互动弹窗</span><span class="win-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>' +
      '<div class="win-body"><p style="white-space:pre-wrap;word-break:break-word">' + Blog.escapeHtml(msg) + "</p>" +
      '<div style="text-align:right;margin-top:10px"><button class="btn primary" id="popup-ok">确定</button></div></div>';
    ov.appendChild(win);
    document.body.appendChild(ov);
    var ok = document.getElementById("popup-ok");
    if (ok) ok.addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  }

  function loadComments() {
    cmtList.innerHTML = '<p class="muted">加载中…</p>';
    Blog.api("/api/articles/" + encodeURIComponent(slug) + "/comments").then(function (data) {
      var list = (data && data.comments) || [];
      if (!list.length) {
        cmtList.innerHTML = '<p class="muted">还没有评论，来说两句？</p>';
        return;
      }
      renderComments(list);
    }).catch(function (err) {
      cmtList.innerHTML = '<div class="alert error">加载失败：' + esc(err.message) + "</div>";
    });
  }

  if (!slug) {
    box.innerHTML = '<div class="win-body"><div class="alert error">缺少参数 slug=xxx</div></div>';
  } else {
    Blog.api("/api/articles/" + encodeURIComponent(slug)).then(function (a) {
      document.title = a.title + " - 小戡的博客";
      box.innerHTML =
        '<div class="win-title"><span class="win-label">📖 ' + esc(a.title) + '</span><span class="win-dots"><span class="dot"></span></span></div>' +
        '<div class="win-body">' +
          '<p class="post-meta">发布 ' + esc(Blog.fmtDate(a.created_at)) +
          (a.updated_at && a.updated_at !== a.created_at ? " · 更新 " + esc(Blog.fmtDate(a.updated_at)) : "") +
          " · " + (a.views || 0) + " 次浏览" +
          (a.tags ? " · " + esc(a.tags).split(",").map(function (t) { return "#" + t.trim(); }).filter(Boolean).join(" ") : "") + "</p>" +
          '<div class="markdown-body">' + (window.DOMPurify ? DOMPurify.sanitize(marked.parse(a.content_md)) : marked.parse(a.content_md)) + "</div>" +
        "</div>";
      commentsBox.classList.remove("hidden");
      renderAuth();
      bindPopups();
      loadComments();
    }).catch(function (err) {
      box.innerHTML = '<div class="win-body"><div class="alert error">加载失败：' + esc(err.message) + "</div></div>";
    });
  }

  if (cmtForm) {
    var atBtn = document.getElementById("cmt-atbot");
    if (atBtn) atBtn.addEventListener("click", function () {
      var ta = document.getElementById("cmt-content");
      if (ta) ta.value = "@Bot " + ta.value;
      ta.focus();
    });
    if (cmtCancel) cmtCancel.addEventListener("click", function () {
      replyingTo = null;
      cmtReplyTo.textContent = "";
      cmtCancel.classList.add("hidden");
    });
    cmtForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showCmtAlert("");
      var content = document.getElementById("cmt-content").value.trim();
      if (!content) { showCmtAlert("请填写内容"); return; }
      var payload = { content: content };
      if (replyingTo) payload.parent_id = parseInt(replyingTo.id, 10);
      var btn = cmtForm.querySelector("button[type=submit]");
      btn.disabled = true;
      Blog.api("/api/articles/" + encodeURIComponent(slug) + "/comments", { method: "POST", body: payload })
        .then(function () {
          showCmtAlert("评论成功", "ok");
          document.getElementById("cmt-content").value = "";
          replyingTo = null;
          cmtReplyTo.textContent = "";
          cmtCancel.classList.add("hidden");
          loadComments();
        })
        .catch(function (err) {
          if (err.status === 401) {
            showCmtAlert("请先登录");
            renderAuth();
          } else if (err.status === 429) {
            showCmtAlert("评论太频繁，请 60 秒后再试");
          } else {
            showCmtAlert("评论失败：" + err.message);
          }
        })
        .finally(function () { btn.disabled = false; });
    });
  }
})();
