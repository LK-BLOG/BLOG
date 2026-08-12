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
    }
    if (window.TurndownService) {
      turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
    }
    $("mode-rich").addEventListener("click", function () { setEditorMode("rich"); });
    $("mode-md").addEventListener("click", function () { setEditorMode("md"); });
  }

  function setEditorMode(mode) {
    editorMode = mode;
    var isRich = mode === "rich";
    $("e-quill-wrap").classList.toggle("hidden", !isRich);
    $("e-content").classList.toggle("hidden", isRich);
    $("mode-rich").classList.toggle("primary", isRich);
    $("mode-md").classList.toggle("primary", !isRich);
    if (isRich && quill) {
      quill.clipboard.dangerouslyPasteHTML(marked.parse(getMarkdown() || ""));
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
      quill.clipboard.dangerouslyPasteHTML(marked.parse(md || ""));
    }
  }
  function init() {
    if (Blog.isAuthed()) { enterPanel(); return; }
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = this.querySelector("button");
      btn.disabled = true;
      Blog.api("/api/login", { method: "POST", body: { password: $("password").value } })
        .then(function (data) {
          Blog.setToken(data.token);
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
    switchTab("articles");
    loadArticles();
    loadMessages();
  }

  function bindPanelEvents() {
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });
    $("new-article-btn").addEventListener("click", function () { openEditor(null); });
    $("logout-btn").addEventListener("click", function () {
      if (!confirm("确定退出登录？")) return;
      Blog.setToken("");
      location.reload();
    });
    $("editor-form").addEventListener("submit", saveArticle);
    $("editor-cancel").addEventListener("click", function () { switchTab("articles"); });
    $("preview-toggle").addEventListener("click", function () {
      var pv = $("e-preview");
      if (pv.classList.contains("hidden")) {
        pv.innerHTML = marked.parse(getMarkdown() || "");
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
    ["articles", "messages", "editor"].forEach(function (t) {
      $("tab-" + t).classList.toggle("hidden", t !== tab);
    });
    if (tab === "articles") loadArticles();
    if (tab === "messages") loadMessages();
  }

  /* ---------- 文章管理 ---------- */
  function loadArticles() {
    var box = $("articles-manage");
    box.innerHTML = '<p class="muted px12">加载中…</p>';
    Blog.api("/api/articles").then(function (data) {
      var list = (data && data.articles) || [];
      if (!list.length) {
        box.innerHTML = '<p class="muted px12">还没有文章，点「＋ 写新文章」开写。</p>';
        return;
      }
      var html = '<table><tr><th>标题</th><th>日期</th><th style="width:150px">操作</th></tr>';
      list.forEach(function (a) {
        html += "<tr><td>" + Blog.escapeHtml(a.title) + "</td>" +
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
    setMarkdown("");
    setEditorMode("rich");
    $("editor-title").textContent = slug ? "编辑文章：" + slug : "写新文章";
    switchTab("editor");
    if (slug) {
      Blog.api("/api/articles/" + encodeURIComponent(slug)).then(function (a) {
        $("e-title").value = a.title;
        $("e-slug").value = a.slug;
        $("e-slug").readOnly = true;
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

    var payload = { title: title, slug: slug, content_md: content };
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
      box.innerHTML = html;
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