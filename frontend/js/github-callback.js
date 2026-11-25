  (function () {
    "use strict";
    var $ = function (id) { return document.getElementById(id); };
    function fail(msg) {
      $("gh-alert").innerHTML = '<div class="alert error">' + Blog.escapeHtml(msg) + "</div>";
      $("gh-detail").textContent = "回到登录页再试一次。";
    }
    var params = new URLSearchParams(location.hash.slice(1));
    var token = params.get("token") || "";
    if (!token) { fail("没拿到登录凭据，链接可能失效了"); return; }

    var next = Blog.loginReturnPath(params.get("next"));

    Blog.setToken(token);
    Blog.setUser(params.get("username") || "", params.get("role") || "", params.get("display_name") || "");
    if (history.replaceState) history.replaceState(null, "", "/github-callback");
    location.replace(next);
  })();
