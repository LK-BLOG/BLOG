/* 文章列表：搜索 + 标签筛选 + 浏览量 */
(function () {
  "use strict";
  var box = document.getElementById("article-list");
  var searchInput = document.getElementById("search-input");
  var tagBox = document.getElementById("tag-filter");
  var all = [];
  var activeTag = "";

  function esc(s) { return Blog.escapeHtml(s); }

  function tagsOf(a) {
    return (a.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function render() {
    var kw = (searchInput ? searchInput.value.trim().toLowerCase() : "");
    var list = all.filter(function (a) {
      if (activeTag && tagsOf(a).indexOf(activeTag) < 0) return false;
      if (kw && (a.title || "").toLowerCase().indexOf(kw) < 0 && (a.slug || "").toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    if (!list.length) {
      box.innerHTML = '<p class="muted px12">没有匹配的文章。</p>';
      return;
    }
    var html = "";
    list.forEach(function (a) {
      var tags = tagsOf(a).map(function (t) {
        return '<span class="article-tag" data-tag="' + esc(t) + '">#' + esc(t) + "</span>";
      }).join(" ");
      var pin = a.pinned ? "📌 " : "";
      html += '<div class="article-row">' +
        '<a href="article.html?slug=' + encodeURIComponent(a.slug) + '">' + pin + esc(a.title) + "</a>" +
        '<span class="article-date">' + esc(Blog.fmtDate(a.created_at)) + " · " + (a.views || 0) + " 次浏览" + (tags ? " · " + tags : "") + "</span>" +
        "</div>";
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-tag]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeTag = b.dataset.tag;
        renderTagFilter();
        render();
      });
    });
  }

  function renderTagFilter() {
    if (!tagBox) return;
    var tagSet = {};
    all.forEach(function (a) { tagsOf(a).forEach(function (t) { tagSet[t] = 1; }); });
    var tags = Object.keys(tagSet);
    var html = '<span class="muted px12">标签：</span>';
    if (activeTag) {
      html += '<button class="btn" data-clear="1">✕ 取消</button> ';
    }
    tags.forEach(function (t) {
      html += '<button class="btn ' + (activeTag === t ? "primary" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button> ";
    });
    tagBox.innerHTML = html;
    tagBox.querySelectorAll("[data-tag]").forEach(function (b) {
      b.addEventListener("click", function () { activeTag = b.dataset.tag; renderTagFilter(); render(); });
    });
    var clear = tagBox.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () { activeTag = ""; renderTagFilter(); render(); });
  }

  Blog.api("/api/articles").then(function (data) {
    all = (data && data.articles) || [];
    renderTagFilter();
    render();
  }).catch(function (err) {
    box.innerHTML = '<div class="alert error">加载失败：' + esc(err.message) + "（检查 config.js 里的 API 地址）</div>";
  });

  function renderArchive() {
    box.innerHTML = '<p class="muted">加载中…</p>';
    Blog.api("/api/archive").then(function (d) {
      var groups = (d && d.archive) || [];
      if (!groups.length) { box.innerHTML = '<p class="muted px12">还没有文章。</p>'; return; }
      var html = "";
      groups.forEach(function (g) {
        html += '<div class="archive-month"><b>' + esc(g.month) + "</b> (" + g.articles.length + ")</div>";
        g.articles.forEach(function (a) {
          html += '<div class="article-row"><a href="article.html?slug=' + encodeURIComponent(a.slug) + '">' + esc(a.title) + "</a>" +
            '<span class="article-date">' + esc(Blog.fmtDate(a.created_at)) + "</span></div>";
        });
      });
      box.innerHTML = html;
    }).catch(function (err) {
      box.innerHTML = '<div class="alert error">' + esc(err.message) + "</div>";
    });
  }

  if (searchInput) searchInput.addEventListener("input", render);
  var viewBtn = document.getElementById("view-toggle");
  if (viewBtn) viewBtn.addEventListener("click", function () {
    var arch = viewBtn.dataset.arch === "1";
    if (arch) {
      viewBtn.dataset.arch = "0";
      viewBtn.textContent = "📂 归档";
      if (tagBox) tagBox.style.display = "";
      if (searchInput) searchInput.style.display = "";
      render();
    } else {
      viewBtn.dataset.arch = "1";
      viewBtn.textContent = "📖 列表";
      if (tagBox) tagBox.style.display = "none";
      if (searchInput) searchInput.style.display = "none";
      renderArchive();
    }
  });
})();
