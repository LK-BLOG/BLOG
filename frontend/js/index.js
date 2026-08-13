/* 首页：拉取最新 3 篇文章（失败则静默隐藏） */
(function () {
  "use strict";
  // 公告
  Blog.api("/api/announcement").then(function (d) {
    var el = document.getElementById("announcement");
    if (el && d && d.text) {
      el.textContent = "📢 " + d.text;
      el.classList.remove("hidden");
    }
  }).catch(function () {});
  var box = document.getElementById("latest-articles");
  if (!box) return;
  Blog.api("/api/articles").then(function (data) {
    var list = (data && data.articles) || [];
    if (!list.length) {
      box.innerHTML = '<p class="muted px12">还没有文章，去 admin 面板写第一篇吧。</p>';
      return;
    }
    var html = "";
    list.slice(0, 3).forEach(function (a) {
      html += '<div class="article-row">' +
        '<a href="article.html?slug=' + encodeURIComponent(a.slug) + '">' + Blog.escapeHtml(a.title) + "</a>" +
        '<span class="article-date">' + Blog.escapeHtml(Blog.fmtDate(a.created_at)) + "</span>" +
        "</div>";
    });
    box.innerHTML = html;
  }).catch(function () {
    var sec = document.getElementById("latest-section");
    if (sec) sec.classList.add("hidden");
  });
})();