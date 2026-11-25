  (function () {
    "use strict";
    var $ = function (id) { return document.getElementById(id); };
    var params = new URLSearchParams(location.search);
    var pendingEmail = "";
    function returnPath(theme) {
      theme = theme || document.documentElement.getAttribute("data-theme");
      return Blog.loginReturnPath(params.get("next") || (theme === "retro" ? "retro.html" : ""));
    }

    function show(msg, type) {
      $("login-alert").innerHTML = '<div class="alert ' + (type || "error") + '">' + Blog.escapeHtml(msg) + "</div>";
    }
    var ghError = new URLSearchParams(location.search).get("github_error");
    if (ghError) show(ghError);

    var embeddedNext = "";
    if (window.__XIAOKAN_EMBEDDED__) {
      try {
        var topLoc = window.top.location;
        var topFile = topLoc.pathname.split("/").pop() || "index.html";
        if (/^[A-Za-z0-9_.-]+\.html$/.test(topFile)) embeddedNext = topFile + (topLoc.search || "");
      } catch (err) {}
    }
    function githubUrl(theme) {
      return (window.API_BASE || "").replace(/\/+$/, "") +
        "/api/auth/github/start?next=" + encodeURIComponent(embeddedNext || returnPath(theme));
    }
    $("github-login").setAttribute("href", githubUrl());
    document.addEventListener("change", function (event) {
      if (event.target.hasAttribute("data-theme-select")) {
        $("github-login").setAttribute("href", githubUrl(event.target.value));
      }
    });
    $("github-login").addEventListener("click", function (e) {
      e.preventDefault();
      var ghUrl = githubUrl();
      if (window.__XIAOKAN_EMBEDDED__) {
        try { window.top.location.href = ghUrl; return; } catch (err) {}
      }
      window.location.href = ghUrl;
    });
    function setMode(register) {
      $("login-form").classList.toggle("hidden", register);
      $("register-form").classList.toggle("hidden", !register);
      $("verify-form").classList.add("hidden");
      $("forgot-form").classList.add("hidden");
      $("goto-register").parentElement.classList.toggle("hidden", register);
      $("register-switch").classList.toggle("hidden", !register);
    }
    function saveAuth(data) {
      Blog.setToken(data.token);
      Blog.setUser(data.username, data.role, data.display_name);
    }
    function finish(data) {
      saveAuth(data);
      location.href = returnPath();
    }
    function sendRegisterCode(email) {
      $("verify-alert").innerHTML = "";
      Blog.api("/api/me/email/code", { method: "POST", body: { email: email } })
        .then(function () { $("verify-alert").innerHTML = '<div class="alert ok">验证码已发送，查收邮箱。</div>'; })
        .catch(function (err) { $("verify-alert").innerHTML = '<div class="alert error">' + Blog.escapeHtml(err.message || "发送失败") + "</div>"; });
    }

    $("goto-register").addEventListener("click", function () { setMode(true); });
    $("forgot-pw").addEventListener("click", function () {
      var form = $("forgot-form");
      var show = form.classList.contains("hidden");
      form.classList.toggle("hidden", !show);
      $("login-form").classList.toggle("hidden", show);
      $("register-form").classList.add("hidden");
      $("verify-form").classList.add("hidden");
      $("goto-register").parentElement.classList.toggle("hidden", show);
      $("register-switch").classList.add("hidden");
    });
    $("goto-login").addEventListener("click", function () { setMode(false); });
    $("forgot-goto-login").addEventListener("click", function () { setMode(false); $("username").focus(); });

    $("fp-send").addEventListener("click", function () {
      var identifier = $("fp-id").value.trim();
      if (!identifier) { show("先填用户名或邮箱"); return; }
      this.disabled = true;
      Blog.api("/api/auth/password-reset/code", { method: "POST", body: { identifier: identifier } })
        .then(function () { show("如果该账号已绑定邮箱，验证码会进入发信队列，稍等查收。", "ok"); })
        .catch(function (err) { show(err.message || "发送失败"); })
        .finally(function () { $("fp-send").disabled = false; });
    });

    $("forgot-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var identifier = $("fp-id").value.trim();
      var code = $("fp-code").value.trim();
      var p = $("fp-password").value;
      if (!identifier || !code || !p) { show("信息没填全"); return; }
      if (p !== $("fp-password2").value) { show("两次密码不一致"); return; }
      var btn = this.querySelector("button[type='submit']");
      btn.disabled = true;
      Blog.api("/api/auth/password-reset/confirm", { method: "POST", body: { identifier: identifier, code: code, new_password: p } })
        .then(function () {
          show("密码已重置，可以登录了。", "ok");
          setMode(false);
          $("password").focus();
        })
        .catch(function (err) { show(err.message || "重置失败"); })
        .finally(function () { btn.disabled = false; });
    });

    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = this.querySelector("button");
      btn.disabled = true;
      Blog.api("/api/login", { method: "POST", body: { username: $("username").value.trim(), password: $("password").value } })
        .then(finish)
        .catch(function (err) { show(err.message || "登录失败"); })
        .finally(function () { btn.disabled = false; });
    });

    $("register-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var u = $("r-username").value.trim();
      var p = $("r-password").value;
      var n = $("r-name").value.trim();
      var email = $("r-email").value.trim();
      if (p !== $("r-password2").value) { show("两次密码不一致"); return; }
      if (!n) { show("请填写显示名称"); return; }
      if (!email) { show("请填写邮箱"); return; }
      var btn = this.querySelector("button");
      btn.disabled = true;
      Blog.api("/api/register", { method: "POST", body: { username: u, password: p, display_name: n, email: email } })
        .then(function (data) {
          saveAuth(data);
          pendingEmail = data.email || email;
          $("verify-email").textContent = pendingEmail;
          $("login-form").classList.add("hidden");
          $("register-form").classList.add("hidden");
          $("verify-form").classList.remove("hidden");
          $("goto-register").parentElement.classList.add("hidden");
          $("register-switch").classList.add("hidden");
          sendRegisterCode(pendingEmail);
        })
        .catch(function (err) { show(err.message || "注册失败"); })
        .finally(function () { btn.disabled = false; });
    });

    $("verify-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("v-code").value.trim();
      if (!code) { return; }
      var btn = this.querySelector("button[type='submit']");
      btn.disabled = true;
      Blog.api("/api/me/email/verify", { method: "POST", body: { email: pendingEmail, code: code } })
        .then(function () { location.href = returnPath(); })
        .catch(function (err) { $("verify-alert").innerHTML = '<div class="alert error">' + Blog.escapeHtml(err.message || "验证失败") + "</div>"; })
        .finally(function () { btn.disabled = false; });
    });

    $("v-resend").addEventListener("click", function () {
      if (pendingEmail) sendRegisterCode(pendingEmail);
    });
    $("verify-goto-login").addEventListener("click", function () { setMode(false); });
  })();
