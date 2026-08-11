/* 友链：从 data.js 渲染 */
(function () {
  "use strict";
  var box = document.getElementById("friend-list");
  var list = (window.FRIEND_LINKS || []);
  if (!list.length) {
    box.innerHTML = '<div class="win"><div class="win-body"><p class="muted">还没有友链。想交换友链？留言板吱一声。</p></div></div>';
    return;
  }
  var html = "";
  list.forEach(function (f) {
    html += '<div class="win"><div class="win-title"><span class="win-label">🤝 ' + Blog.escapeHtml(f.name) + '</span><span class="win-dots"><span class="dot"></span></span></div>' +
      '<div class="win-body center">' +
      '<p class="mb8">' + Blog.escapeHtml(f.desc || "") + "</p>" +
      '<a class="btn" href="' + Blog.escapeHtml(f.url) + '" target="_blank" rel="noopener noreferrer">去看看 ↗</a>' +
      "</div></div>";
  });
  box.innerHTML = html;
})();