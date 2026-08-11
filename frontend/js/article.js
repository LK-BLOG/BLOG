/* 文章详情：按 ?slug= 拉取并用 marked 渲染 Markdown */
(function () {
  "use strict";
  var box = document.getElementById("post");
  var params = new URLSearchParams(location.search);
  var slug = params.get("slug") || "";
  if (!slug) {
    box.innerHTML = '<div class="win-body"><div class="alert error">缺少文章参数（?slug=xxx）</div></div>';
    return;
  }
  Blog.api("/api/articles/" + encodeURIComponent(slug)).then(function (a) {
    document.title = a.title + " - 小戡的博客";
    box.innerHTML =
      '<div class="win-title"><span class="win-label">📄 ' + Blog.escapeHtml(a.title) + '</span><span class="win-dots"><span class="dot"></span></span></div>' +
      '<div class="win-body">' +
        '<p class="post-meta">发布于 ' + Blog.escapeHtml(Blog.fmtDate(a.created_at)) +
        (a.updated_at && a.updated_at !== a.created_at ? " · 更新于 " + Blog.escapeHtml(Blog.fmtDate(a.updated_at)) : "") + "</p>" +
        '<div class="markdown-body">' + marked.parse(a.content_md) + "</div>" +
      "</div>";
  }).catch(function (err) {
    box.innerHTML = '<div class="win-body"><div class="alert error">加载文章失败：' + Blog.escapeHtml(err.message) + "</div></div>";
  });
})();