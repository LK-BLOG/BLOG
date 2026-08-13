/* 管理后台：登录 → 文章增删改 / 留言删除 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var loginView = $("login-view"), panelView = $("panel-view");
  var currentTab = "articles";
  var editingSlug = null; // 正在编辑的文章 slug（null = 新文章）

  function showAlert(boxId, msg, type) {
    $(boxId).innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
  }

  /* ---------- 登录 ---------- */

  /* ---------- 富文本编辑器（Quill + Turndown） ---------- */
  var quill = null;
  var turndown = null;
  var editorMode = "rich";

  function initEditor() {
    if (window.Quill) {
      quill = new Quill("#e-quill", {
        theme: "snow",
        placeholder: "在这里写正文…",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["blockquote", "code-block"],
            ["link", "clean"]
          ]
        }
      });
      var Embed = Quill.import("blots/embed");
      var PopupBtn = class extends Embed {
        static create(value) {
          var node = super.create();
          node.classList.add("popup-btn");
          node.setAttribute("data-msg", (value && value.msg) || "");
          node.setAttribute("data-url", (value && value.url) || "");
          node.textContent = (value && value.text) || "";
          return node;
        }
        static value(node) {
          return { text: node.textContent, msg: node.getAttribute("data-msg") || "", url: node.getAttribute("data-url") || "" };
        }
      };
      PopupBtn.blotName = "popupBtn";
      PopupBtn.tagName = "button";
      PopupBtn.className = "popup-btn";
      Quill.register(PopupBtn);
    }
    if (window.TurndownService) {
      turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
      turndown.keep(["button", "u"]);
      turndown.addRule("strikethrough", {
        filter: ["del", "s", "strike"],
        replacement: function (content) { return "~~" + content + "~~"; }
      });
    }
    $("mode-rich").addEventListener("click", function () { setEditorMode("rich"); });
    $("mode-md").addEventListener("click", function () { setEditorMode("md"); });
    function insertHtmlAtCursor(html) {
      var ta = $("e-content");
      if (editorMode === "rich" && quill) {
        var idx = quill.getSelection() ? quill.getSelection().index : quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(idx, html, "user");
        return;
      }
      var start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      var end = ta.selectionEnd != null ? ta.selectionEnd : start;
      var prefix = (start > 0 && ta.value.charAt(start - 1) !== "\n") ? "\n" : "";
      var ins = prefix + html + "\n";
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      ta.focus();
      var pos = start + ins.length;
      if (ta.setSelectionRange) ta.setSelectionRange(pos, pos);
    }
    var upBtn = $("e-img-upload");
    var fileInput = $("e-img-file");
    if (upBtn && fileInput) {
      upBtn.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("\u56fe\u7247\u4e0d\u80fd\u8d85\u8fc7 5MB"); fileInput.value = ""; return; }
        var reader = new FileReader();
        reader.onload = function () {
          var b64 = String(reader.result).split(",")[1] || "";
          Blog.api("/api/upload", { method: "POST", body: { filename: file.name, data: b64 } })
            .then(function (d) {
              insertHtmlAtCursor('<img src="' + d.url + '" alt="' + Blog.escapeHtml(file.name) + '">');
            })
            .catch(function (err) { alert("\u4e0a\u4f20\u5931\u8d25\uff1a" + err.message); })
            .finally(function () { fileInput.value = ""; });
        };
        reader.readAsDataURL(file);
      });
    }
    var imgBtn = $("e-img-url");
    if (imgBtn) imgBtn.addEventListener("click", function () {
      var url = prompt("图片链接 URL（外链或上传后的地址）");
      if (!url) return;
      insertHtmlAtCursor('<img src="' + Blog.escapeHtml(url) + '" alt="图片">');
    });
    var popupBtn = $("e-popup");
    if (popupBtn) popupBtn.addEventListener("click", function () { openPopupConfig(); });
    function openPopupConfig() {
      $("pb-text").value = "";
      $("pb-msg").value = "";
      $("pb-url").value = "";
      $("pb-alert").innerHTML = "";
      var m = document.querySelector('input[name="pb-type"][value="msg"]');
      if (m) m.checked = true;
      togglePbRows("msg");
      $("popup-config").style.display = "flex";
    }
    function closePopupConfig() {
      $("popup-config").style.display = "none";
    }
    function togglePbRows(type) {
      $("pb-msg-row").classList.toggle("hidden", type !== "msg");
      $("pb-url-row").classList.toggle("hidden", type !== "url");
    }
    function insertPopupBtn() {
      var text = $("pb-text").value.trim();
      var typeEl = document.querySelector('input[name="pb-type"]:checked');
      var type = typeEl ? typeEl.value : "msg";
      var msg = $("pb-msg").value.trim();
      var url = $("pb-url").value.trim();
      if (!text) { showAlert("pb-alert", "按钮文字不能为空"); return; }
      if (window.Quill && quill && editorMode === "rich") {
        var idx = quill.getSelection() ? quill.getSelection().index : quill.getLength();
        quill.insertEmbed(idx, "popupBtn", { text: text, msg: type === "msg" ? msg : "", url: type === "url" ? url : "" }, "user");
      } else if (type === "msg") {
        if (!msg) { showAlert("pb-alert", "弹窗内容不能为空"); return; }
        insertHtmlAtCursor('<button class="popup-btn" data-msg="' + Blog.escapeHtml(msg) + '">' + Blog.escapeHtml(text) + "</button>");
      } else {
        if (!url) { showAlert("pb-alert", "链接 URL 不能为空"); return; }
        insertHtmlAtCursor('<button class="popup-btn" data-url="' + Blog.escapeHtml(url) + '">' + Blog.escapeHtml(text) + "</button>");
      }
      closePopupConfig();
    }
    var pbOk = $("pb-ok"), pbCancel = $("pb-cancel");
    if (pbOk) pbOk.addEventListener("click", insertPopupBtn);
    if (pbCancel) pbCancel.addEventListener("click", closePopupConfig);
    document.querySelectorAll('input[name="pb-type"]').forEach(function (r) {
      r.addEventListener("change", function () { togglePbRows(r.value); });
    });
  }

  function mdToHtml(md) {
  var html = window.marked ? marked.parse(md || "") : (md || "");
    return window.DOMPurify ? DOMPurify.sanitize(html) : html;
  }

  function setEditorMode(mode) {
    editorMode = mode;
    var isRich = mode === "rich";
    $("e-quill-wrap").classList.toggle("hidden", !isRich);
    $("e-content").classList.toggle("hidden", isRich);
    $("mode-rich").classList.toggle("primary", isRich);
    $("mode-md").classList.toggle("primary", !isRich);
    if (isRich && quill) {
      quill.clipboard.dangerouslyPasteHTML(mdToHtml(getMarkdown()));
    } else {
      $("e-content").value = getMarkdown();
    }
  }

  function getMarkdown() {
    if (editorMode === "rich" && quill) {
      var html = quill.getSemanticHTML();
      return turndown ? turndown.turndown(html) : html;
    }
    return $("e-content").value;
  }

  function setMarkdown(md) {
    $("e-content").value = md || "";
    if (quill) quill.setContents([]);
    if (quill && editorMode === "rich") {
      quill.clipboard.dangerouslyPasteHTML(mdToHtml(md));
    }
  }
  function init() {
    if (Blog.isAuthed()) {
      var r = Blog.getRole();
      if (r === "admin" || r === "moderator") { enterPanel(); return; }
      Blog.logout();
    }
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = this.querySelector("button");
      btn.disabled = true;
      Blog.api("/api/login", { method: "POST", body: { username: $("username").value.trim(), password: $("password").value } })
        .then(function (data) {
          if (data.role !== "admin" && data.role !== "moderator") { throw new Error("\u8be5\u8d26\u53f7\u6ca1\u6709\u7ba1\u7406\u6743\u9650"); }
          Blog.setToken(data.token);
          Blog.setUser(data.username, data.role);
          $("password").value = "";
          enterPanel();
        })
        .catch(function (err) {
          showAlert("login-alert", "登录失败：" + err.message + "（密码错误？）");
        })
        .finally(function () { btn.disabled = false; });
    });
  }

  function enterPanel() {
    loginView.classList.add("hidden");
    panelView.classList.remove("hidden");
    bindPanelEvents();
    bindBotForm();
    bindOverview();
    var isMod = Blog.getRole() === "moderator";
    ["tab-articles", "tab-users", "tab-bot", "tab-editor", "new-article-btn"].forEach(function (id) {
      var el = $(id);
      if (el) el.style.display = isMod ? "none" : "";
    });
    if (isMod) {
      switchTab("messages");
    } else {
      switchTab("overview");
    }
    loadMessages();
  }

  function bindPanelEvents() {
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });
    $("new-article-btn").addEventListener("click", function () { openEditor(null); });
    $("logout-btn").addEventListener("click", function () {
      if (!confirm("确定退出登录？")) return;
      Blog.logout();
      location.reload();
    });
    $("editor-form").addEventListener("submit", saveArticle);
    $("editor-cancel").addEventListener("click", function () { switchTab("articles"); });
    $("preview-toggle").addEventListener("click", function () {
      var pv = $("e-preview");
      if (pv.classList.contains("hidden")) {
        pv.innerHTML = mdToHtml(getMarkdown());
        pv.classList.remove("hidden");
      } else {
        pv.classList.add("hidden");
      }
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.classList.toggle("primary", b.dataset.tab === tab);
    });
    ["overview", "articles", "messages", "comments", "users", "reports", "audit", "bot", "editor"].forEach(function (t) {
      $("tab-" + t).classList.toggle("hidden", t !== tab);
    });
    if (tab === "overview") loadOverview();
    if (tab === "articles") loadArticles();
    if (tab === "messages") loadMessages();
    if (tab === "comments") loadComments();
    if (tab === "users") loadUsers();
    if (tab === "reports") loadReports();
    if (tab === "audit") loadAudit();
    if (tab === "bot") loadBotSettings();
  }

  /* ---------- 文章管理 ---------- */
  function loadArticles() {
    var box = $("articles-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/articles?all=1").then(function (data) {
      var list = (data && data.articles) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有文章，点「＋ 写新文章」开写。</p>';
        return;
      }
      var html = '<table><tr><th>标题</th><th>日期</th><th style="width:150px">操作</th></tr>';
      list.forEach(function (a) {
        var mark = a.status === "draft" ? ' <span class="tag tag-danger">草稿</span>' : "";
        html += "<tr><td>" + Blog.escapeHtml(a.title) + mark + "</td>" +
          "<td class='nowrap'>" + Blog.escapeHtml(Blog.fmtDate(a.created_at)) + "</td>" +
          "<td><button class='btn' data-edit='" + Blog.escapeHtml(a.slug) + "'>编辑</button> " +
          "<button class='btn danger' data-del='" + Blog.escapeHtml(a.slug) + "'>删除</button></td></tr>";
      });
      html += "</table>";
      box.innerHTML = html;
      box.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () { openEditor(b.dataset.edit); });
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除这篇文章？不可恢复。")) return;
          Blog.api("/api/articles/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
            .then(function () { loadArticles(); })
            .catch(function (err) { alert("删除失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">加载失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  function openEditor(slug) {
    editingSlug = slug;
    $("editor-alert").innerHTML = "";
    $("e-preview").classList.add("hidden");
    $("e-title").value = "";
    $("e-slug").value = "";
    $("e-slug").readOnly = false;
    if ($("e-tags")) $("e-tags").value = "";
    if ($("e-status")) $("e-status").value = "published";
    if ($("e-pinned")) $("e-pinned").checked = false;
    setMarkdown("");
    setEditorMode("rich");
    $("editor-title").textContent = slug ? "编辑文章：" + slug : "写新文章";
    switchTab("editor");
    if (slug) {
      Blog.api("/api/articles/" + encodeURIComponent(slug)).then(function (a) {
        $("e-title").value = a.title;
        $("e-slug").value = a.slug;
        $("e-slug").readOnly = true;
        if ($("e-tags")) $("e-tags").value = a.tags || "";
        if ($("e-status")) $("e-status").value = a.status || "published";
        if ($("e-pinned")) $("e-pinned").checked = !!a.pinned;
        setMarkdown(a.content_md);
      }).catch(function (err) {
        showAlert("editor-alert", "加载文章失败：" + err.message);
      });
    }
  }

  function saveArticle(e) {
    e.preventDefault();
    var title = $("e-title").value.trim();
    var content = getMarkdown().trim();
    if (!title || !content) { showAlert("editor-alert", "标题和正文都不能为空。"); return; }
    var slug = $("e-slug").value.trim();
    if (!slug) slug = "post-" + Date.now();

    var payload = { title: title, slug: slug, content_md: content, tags: $("e-tags") ? $("e-tags").value.trim() : "", status: $("e-status") ? $("e-status").value : "published", pinned: ($("e-pinned") && $("e-pinned").checked) ? 1 : 0 };
    var req = editingSlug
      ? Blog.api("/api/articles/" + encodeURIComponent(editingSlug), { method: "PUT", body: payload })
      : Blog.api("/api/articles", { method: "POST", body: payload });

    req.then(function () {
      showAlert("editor-alert", "保存成功！", "ok");
      switchTab("articles");
    }).catch(function (err) {
      showAlert("editor-alert", "保存失败：" + err.message);
    });
  }

  /* ---------- 评论管理 ---------- */
  function loadComments() {
    var box = $("comments-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/comments").then(function (data) {
      var list = (data && data.comments) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有评论。</p>';
        return;
      }
      var html = '<table><tr><th>文章</th><th style="width:110px">昵称</th><th>内容</th><th style="width:130px">时间</th><th style="width:70px">操作</th></tr>';
      list.forEach(function (m) {
        html += "<tr><td>" + (m.article_title ? Blog.escapeHtml(m.article_title) : Blog.escapeHtml(m.article_slug)) + "</td>" +
          "<td>" + Blog.escapeHtml(m.nickname) + "</td>" +
          "<td>" + Blog.escapeHtml(m.content) + "</td>" +
          "<td class='nowrap'>" + Blog.escapeHtml(Blog.fmtDate(m.created_at)) + "</td>" +
          "<td><button class='btn danger' data-del='" + m.id + "'>删除</button></td></tr>";
      });
      html += "</table>";
      box.innerHTML = '<input class="field mb8" type="text" id="cmt-search" placeholder="按昵称筛选…" style="max-width:240px">' + html;
      var si2 = document.getElementById("cmt-search");
      if (si2) si2.addEventListener("input", function () {
        var kw = si2.value.trim().toLowerCase();
        box.querySelectorAll("table tr").forEach(function (tr, idx) {
          if (idx === 0) return;
          var nick = (tr.children[1] ? tr.children[1].textContent : "").toLowerCase();
          tr.style.display = (!kw || nick.indexOf(kw) >= 0) ? "" : "none";
        });
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除这条评论？")) return;
          Blog.api("/api/comments/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
            .then(function () { loadComments(); })
            .catch(function (err) { alert("删除失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">加载失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  /* ---------- 概览 + 导出 + 公告 ---------- */
  function loadOverview() {
    Blog.api("/api/stats").then(function (d) {
      var items = [
        ["文章", d.articles], ["草稿", d.drafts],
        ["留言", d.messages], ["评论", d.comments],
        ["用户", d.users], ["今日注册", d.reg_today],
        ["今日留言", d.msg_today], ["今日评论", d.cmt_today],
        ["待处理举报", d.reports_open], ["今日 Bot 聊天", d.bot_today]
      ];
      var html = "";
      items.forEach(function (it) {
        html += '<div class="stat-card"><div class="stat-num">' + it[1] + '</div><div class="stat-label">' + it[0] + "</div></div>";
      });
      $("stats-grid").innerHTML = html;
    }).catch(function (err) {
      $("stats-grid").innerHTML = '<div class="alert error">' + Blog.escapeHtml(err.message) + "</div>";
    });
    Blog.api("/api/announcement").then(function (d) {
      $("ann-text").value = (d && d.text) || "";
    }).catch(function () {});
  }

  function bindOverview() {
    var box = $("tab-overview");
    if (!box) return;
    box.querySelectorAll("[data-export]").forEach(function (b) {
      b.addEventListener("click", function () {
        location.href = "/api/export/" + b.dataset.export + "?t=" + Date.now();
      });
    });
    var form = $("ann-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      Blog.api("/api/announcement", { method: "PUT", body: { text: $("ann-text").value.trim() } })
        .then(function () { $("ann-alert").innerHTML = '<div class="alert ok">已保存</div>'; })
        .catch(function (err) { $("ann-alert").innerHTML = '<div class="alert error">' + Blog.escapeHtml(err.message) + "</div>"; });
    });
  }

  /* ---------- 操作日志 ---------- */
  function loadAudit() {
    var box = $("audit-box");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/audit").then(function (d) {
      var list = (d && d.audit) || [];
      if (!list.length) { box.innerHTML = '<p class="muted px12">还没有操作记录。</p>'; return; }
      var html = '<table><tr><th>操作者</th><th>操作</th><th>目标</th><th>详情</th><th style="width:130px">时间</th></tr>';
      list.forEach(function (a) {
        html += "<tr><td>" + Blog.escapeHtml(a.actor) + "</td><td>" + Blog.escapeHtml(a.action) + "</td><td>" + Blog.escapeHtml(a.target_type || "") + " " + (a.target_id || "") + "</td><td>" + Blog.escapeHtml(a.detail || "") + "</td><td class='nowrap'>" + Blog.escapeHtml(Blog.fmtDate(a.created_at)) + "</td></tr>";
      });
      html += "</table>";
      box.innerHTML = html;
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  /* ---------- 用户管理 ---------- */
  /* ---------- 用户管理 ---------- */
  function loadUsers() {
    var box = $("users-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/users").then(function (data) {
      var list = (data && data.users) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有用户。</p>';
        return;
      }
      var html = '<div class="user-grid">';
      list.forEach(function (u) {
        var status = u.banned ? '已封禁' : (u.username === "admin" ? '管理员' : '正常');
        var roleTxt = u.role === "admin" ? "管理员" : (u.role === "moderator" ? "协管" : "普通");
        var ops = '';
        if (u.username !== "admin") {
          ops += "<button class='btn btn-sm " + (u.role === "moderator" ? "primary" : "") + "' data-role='" + u.username + "' data-set='moderator'>协管</button>";
          ops += "<button class='btn btn-sm " + (u.role === "admin" ? "primary" : "") + "' data-role='" + u.username + "' data-set='admin'>管理</button>";
          ops += "<button class='btn btn-sm " + (u.role === "user" ? "primary" : "") + "' data-role='" + u.username + "' data-set='user'>普通</button>";
          ops += "<button class='btn btn-sm " + (u.banned ? "" : "danger") + "' data-ban='" + u.username + "' data-state='" + (u.banned ? "0" : "1") + "'>" + (u.banned ? "解封" : "封禁") + "</button>";
          ops += "<button class='btn btn-sm danger' data-del='" + u.username + "'>删除</button>";
          ops += "<button class='btn btn-sm' data-resetpw='" + u.username + "'>重置</button>";
        } else {
          ops = '<span class="muted px12">不可操作</span>';
        }
        html += '<div class="user-card">' +
          '<div class="user-card-head">' + Blog.escapeHtml(u.username) + ' <span class="tag">' + roleTxt + '</span> <span class="tag ' + (u.banned ? "tag-danger" : "") + '">' + status + '</span></div>' +
          '<div class="user-card-meta">名称：' + Blog.escapeHtml(u.display_name || "-") + " · ID " + u.id + "<br>" + Blog.escapeHtml(Blog.fmtDate(u.created_at)) + "</div>" +
          '<div class="user-card-ops">' + ops + "</div>" +
          "</div>";
      });
      html += "</div>";
      box.innerHTML = html;
      box.querySelectorAll("[data-role]").forEach(function (b) {
        b.addEventListener("click", function () {
          var roleName = b.dataset.set === "admin" ? "管理员" : (b.dataset.set === "moderator" ? "协管" : "普通用户");
          if (!confirm("确定把 " + b.dataset.role + " 设为" + roleName + "？")) return;
          Blog.api("/api/users/" + encodeURIComponent(b.dataset.role) + "/role", { method: "PUT", body: { role: b.dataset.set } })
            .then(function () { loadUsers(); })
            .catch(function (err) { alert("设置失败：" + err.message); });
        });
      });
      box.querySelectorAll("[data-resetpw]").forEach(function (b) {
        b.addEventListener("click", function () {
          var np = prompt("为 " + b.dataset.resetpw + " 设置新密码（6-72 位）");
          if (!np || np.length < 6) { alert("密码至少 6 位"); return; }
          Blog.api("/api/users/" + encodeURIComponent(b.dataset.resetpw) + "/password", { method: "PUT", body: { new_password: np } })
            .then(function () { alert("已重置"); })
            .catch(function (err) { alert("重置失败：" + err.message); });
        });
      });
      box.querySelectorAll("[data-ban]").forEach(function (b) {
        b.addEventListener("click", function () {
          var banned = b.dataset.state === "1";
          if (!confirm((banned ? "确定封禁 " : "确定解封 ") + b.dataset.ban + "？")) return;
          Blog.api("/api/users/" + encodeURIComponent(b.dataset.ban), { method: "PUT", body: { banned: banned } })
            .then(function () { loadUsers(); })
            .catch(function (err) { alert("操作失败：" + err.message); });
        });
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除用户 " + b.dataset.del + "？此操作不可恢复！")) return;
          Blog.api("/api/users/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
            .then(function () { loadUsers(); })
            .catch(function (err) { alert("删除失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">加载失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  /* ---------- 举报记录 ---------- */
  function loadReports() {
    var box = $("reports-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/reports").then(function (data) {
      var list = (data && data.reports) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有举报记录。</p>';
        return;
      }
      var html = '<table><tr><th>类型</th><th>被举报内容</th><th>原因</th><th>举报人</th><th>状态</th><th style="width:130px">时间</th><th style="width:150px">操作</th></tr>';
      list.forEach(function (r) {
        var st = r.status === "handled" ? "已处理" : "待处理";
        var ops = "";
        if (r.status === "open") {
          ops = "<button class='btn btn-sm danger' data-resolve='" + r.id + "' data-act='delete'>删除+封</button> " +
                "<button class='btn btn-sm' data-resolve='" + r.id + "' data-act='ignore'>忽略</button>";
        }
        html += "<tr><td>" + (r.target_type === "comment" ? "评论" : "留言") + "</td>" +
          "<td>" + Blog.escapeHtml(r.content || "") + "</td>" +
          "<td>" + Blog.escapeHtml(r.reason || "") + "</td>" +
          "<td>" + Blog.escapeHtml(r.reporter || "") + "</td><td>" + st + "</td>" +
          "<td class='nowrap'>" + Blog.escapeHtml(Blog.fmtDate(r.created_at)) + "</td><td>" + ops + "</td></tr>";
      });
      html += "</table>";
      box.innerHTML = html;
      box.querySelectorAll("[data-resolve]").forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.dataset.act;
          if (act === "delete" && !confirm("确定删除该内容并封禁作者？")) return;
          Blog.api("/api/reports/" + encodeURIComponent(b.dataset.resolve) + "/resolve", { method: "POST", body: { action: act, ban: act === "delete" } })
            .then(function () { loadReports(); })
            .catch(function (err) { alert("处理失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">加载失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  /* ---------- 机器人设置 ---------- */
  function loadBotSettings() {
    var box = $("bot-limit"), reg = $("reg-limit");
    Blog.api("/api/settings").then(function (data) {
      box.value = data.chat_daily_limit;
      if (reg) reg.value = data.register_daily_limit;
    }).catch(function (err) {
      $("bot-alert").innerHTML = '<div class="alert error">加载设置失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  function bindBotForm() {
    var form = $("bot-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = parseInt($("bot-limit").value, 10);
      if (!val || val < 1) { $("bot-alert").innerHTML = '<div class="alert error">请输入大于 0 的数字</div>'; return; }
      var payload = { chat_daily_limit: val };
      var regInput = $("reg-limit");
      if (regInput) {
        var regVal = parseInt(regInput.value, 10);
        if (!regVal || regVal < 1) { $("bot-alert").innerHTML = '<div class="alert error">每 IP 注册上限请填大于 0 的数字</div>'; return; }
        payload.register_daily_limit = regVal;
      }
      Blog.api("/api/settings", { method: "PUT", body: payload })
        .then(function () {
          $("bot-alert").innerHTML = '<div class="alert ok">保存成功！每日对话上限 = ' + val + " 轮</div>";
        })
        .catch(function (err) {
          $("bot-alert").innerHTML = '<div class="alert error">保存失败：' + Blog.escapeHtml(err.message) + "</div>";
        });
    });
  }

  /* ---------- 留言管理 ---------- */
  function loadMessages() {
    var box = $("messages-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/messages").then(function (data) {
      var list = (data && data.messages) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有留言。</p>';
        return;
      }
      var html = '<table><tr><th style="width:110px">昵称</th><th>内容</th><th style="width:130px">时间</th><th style="width:70px">操作</th></tr>';
      list.forEach(function (m) {
        html += "<tr><td>" + Blog.escapeHtml(m.nickname) + "</td>" +
          "<td>" + Blog.escapeHtml(m.content) + "</td>" +
          "<td class='nowrap'>" + Blog.escapeHtml(Blog.fmtDate(m.created_at)) + "</td>" +
          "<td><button class='btn danger' data-del='" + m.id + "'>删除</button></td></tr>";
      });
      html += "</table>";
      box.innerHTML = '<input class="field mb8" type="text" id="msg-search" placeholder="按昵称筛选…" style="max-width:240px">' + html;
      var si = document.getElementById("msg-search");
      if (si) si.addEventListener("input", function () {
        var kw = si.value.trim().toLowerCase();
        box.querySelectorAll("table tr").forEach(function (tr, idx) {
          if (idx === 0) return;
          var nick = (tr.children[0] ? tr.children[0].textContent : "").toLowerCase();
          tr.style.display = (!kw || nick.indexOf(kw) >= 0) ? "" : "none";
        });
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除这条留言？")) return;
          Blog.api("/api/messages/" + encodeURIComponent(b.dataset.del), { method: "DELETE" })
            .then(function () { loadMessages(); })
            .catch(function (err) { alert("删除失败：" + err.message); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">加载失败：' + Blog.escapeHtml(err.message) + "</div>";
    });
  }

  init();
  initEditor();
})();