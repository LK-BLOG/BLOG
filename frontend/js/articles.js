/* 文章列表和月度归档共用筛选结果。 */
(function () {
  "use strict";
  var box = document.getElementById("article-list");
  var search = document.getElementById("search-input");
  var sort = document.getElementById("article-sort");
  var tagBox = document.getElementById("tag-filter");
  var view = document.getElementById("view-toggle");
  var count = document.getElementById("article-count");
  var random = document.getElementById("random-article");
  var visibleArticles = [];
  var all = [];
  var loaded = false;
  var activeTag = "";
  var archive = false;
  var searchTimer;
  var searchRequest = 0;
  var searchResult;
  var esc = Blog.escapeHtml;

  function tagsOf(article) {
    return (article.tags || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean);
  }

  function readUrl() {
    var params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    activeTag = params.get("tag") || "";
    var order = params.get("sort");
    sort.value = ["latest", "oldest", "popular"].includes(order) ? order : "latest";
    archive = params.get("view") === "archive";
  }

  function setParam(params, key, value) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  function updateUrl() {
    var url = new URL(location.href);
    setParam(url.searchParams, "q", search.value.trim());
    setParam(url.searchParams, "tag", activeTag);
    setParam(url.searchParams, "sort", sort.value !== "latest" ? sort.value : "");
    setParam(url.searchParams, "view", archive ? "archive" : "");
    history.replaceState(history.state, "", url);
  }

  function refreshSearch() {
    clearTimeout(searchTimer);
    var keyword = search.value.trim();
    var request = ++searchRequest;
    searchResult = null;
    render();
    if (!keyword) return;
    searchTimer = setTimeout(function () {
      Blog.api("/api/articles?q=" + encodeURIComponent(keyword)).then(function (data) {
        if (request !== searchRequest) return;
        searchResult = data.articles || [];
        render();
      }).catch(function (err) {
        if (request !== searchRequest) return;
        count.textContent = "";
        box.innerHTML = '<div class="alert error">搜索失败：' + esc(err.message) + "</div>";
      });
    }, 250);
  }

  function tagButton(tag, label) {
    var selected = activeTag === tag;
    return '<button type="button" class="btn' + (selected ? " primary" : "") +
      '" aria-pressed="' + selected + '" data-tag="' + esc(tag) + '">' + esc(label) + "</button>";
  }

  function renderTagFilter() {
    var tags = new Set(all.flatMap(tagsOf));
    if (activeTag) tags.add(activeTag);
    tagBox.innerHTML = '<span class="muted px12">标签：</span>' + tagButton("", "全部") +
      Array.from(tags, function (tag) { return tagButton(tag, tag); }).join("");
  }

  function renderRow(article) {
    var tags = tagsOf(article).map(function (tag) {
      return tagButton(tag, "#" + tag);
    }).join(" ");
    var pin = article.pinned && !archive ? Blog.icon("pin") + " " : "";
    return '<div class="article-row"><a href="article.html?slug=' + encodeURIComponent(article.slug) + '">' +
      pin + esc(article.title) + '</a><span class="article-date">' +
      esc(Blog.fmtDate(article.created_at)) + " | " + (Number(article.views) || 0) + " 次浏览" +
      (tags ? " | " + tags : "") + "</span></div>";
  }

  function render() {
    view.setAttribute("aria-pressed", String(archive));
    sort.disabled = archive;
    if (!loaded) return;
    var keyword = search.value.trim();
    if (keyword && !searchResult) {
      visibleArticles = [];
      random.disabled = true;
      count.textContent = "";
      box.innerHTML = '<p class="muted px12">正在搜索正文…</p>';
      return;
    }
    var list = (keyword ? searchResult : all).filter(function (article) {
      return !activeTag || tagsOf(article).includes(activeTag);
    });
    list.sort(function (a, b) {
      var newest = (b.created_at || "").localeCompare(a.created_at || "");
      if (archive) return newest;
      var pinned = Number(b.pinned || 0) - Number(a.pinned || 0);
      if (pinned) return pinned;
      if (sort.value === "oldest") return -newest;
      if (sort.value === "popular") return (Number(b.views) || 0) - (Number(a.views) || 0) || newest;
      return newest;
    });

    visibleArticles = list;
    random.disabled = !list.length;
    count.textContent = "显示 " + list.length + " / " + all.length + " 篇";
    if (!list.length) {
      box.innerHTML = '<p class="muted px12">没有匹配的文章。</p>';
    } else if (archive) {
      var groups = new Map();
      list.forEach(function (article) {
        var month = (article.created_at || "").slice(0, 7) || "日期未知";
        if (!groups.has(month)) groups.set(month, []);
        groups.get(month).push(article);
      });
      box.innerHTML = Array.from(groups, function (entry) {
        return '<div class="archive-month"><b>' + esc(entry[0]) + "</b> (" + entry[1].length +
          ")</div>" + entry[1].map(renderRow).join("");
      }).join("");
    } else {
      box.innerHTML = list.map(renderRow).join("");
    }
  }

  function pickTag(event) {
    var button = event.target.closest("button[data-tag]");
    if (!button) return;
    activeTag = button.dataset.tag;
    renderTagFilter();
    updateUrl();
    render();
    var selected = tagBox.querySelector('[aria-pressed="true"]');
    if (selected) selected.focus();
  }

  readUrl();
  render();
  search.addEventListener("input", function () { updateUrl(); refreshSearch(); });
  sort.addEventListener("change", function () { updateUrl(); render(); });
  tagBox.addEventListener("click", pickTag);
  box.addEventListener("click", pickTag);
  view.addEventListener("click", function () { archive = !archive; updateUrl(); render(); });
  random.addEventListener("click", function () {
    if (!visibleArticles.length) return;
    var article = visibleArticles[Math.floor(Math.random() * visibleArticles.length)];
    location.assign("article.html?slug=" + encodeURIComponent(article.slug));
  });
  window.addEventListener("popstate", function () { readUrl(); renderTagFilter(); refreshSearch(); });
  Blog.api("/api/articles").then(function (data) {
    all = data.articles || [];
    loaded = true;
    renderTagFilter();
    refreshSearch();
  }).catch(function (err) {
    box.innerHTML = '<div class="alert error">加载失败：' + esc(err.message) + "</div>";
  });
})();
