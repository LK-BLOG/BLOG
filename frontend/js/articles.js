/* 文章列表 */
(function () {
  "use strict";
  var box = document.getElementById("article-list");
  Blog.api("/api/articles").then(function (data) {
    var list = (data && data.articles) || [];
    if (!list.length) {
      box.innerHTML = '<p class="muted px12">还没有文章。等博主有空写吧。</p>';
      return;
    }
    var html = "";
    list.forEach(function (a) {
      html += '<div class="article-row">' +
        '<a href="article.html?slug=' + encodeURIComponent(a.slug) + '">' + Blog.escapeHtml(a.title) + "</a>" +
        '<span class="article-date">' + Blog.escapeHtml(Blog.fmtDate(a.created_at)) + "</span>" +
        "</div>";
    });
    box.innerHTML = html;
  }).catch(function (err) {
    box.innerHTML = '<div class="alert error">加载文章失败：' + Blog.escapeHtml(err.message) + "（请检查 config.js 里的 API 地址）</div>";
  });
})();