/* ============================================================
 * 公共工具：API 请求、日期、HTML 转义、admin token
 * ============================================================ */
(function () {
  "use strict";

  var API = (window.API_BASE || "").replace(/\/+$/, "");

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {});
    if (options.body && typeof options.body !== "string") {
      options.body = JSON.stringify(options.body);
      options.headers["Content-Type"] = "application/json";
    }
    var token = getToken();
    if (token) options.headers["Authorization"] = "Bearer " + token;
    return fetch(API + path, options).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.detail) ? data.detail : ("HTTP " + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function getToken() {
    try { return localStorage.getItem("xiaokan_token") || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { if (t) localStorage.setItem("xiaokan_token", t); else localStorage.removeItem("xiaokan_token"); } catch (e) {}
  }
  function isAuthed() { return !!getToken(); }
  function getUsername() {
    try { return localStorage.getItem("xiaokan_username") || ""; } catch (e) { return ""; }
  }
  function getRole() {
    try { return localStorage.getItem("xiaokan_role") || ""; } catch (e) { return ""; }
  }
  function setUser(username, role, displayName) {
    try {
      if (username) localStorage.setItem("xiaokan_username", username); else localStorage.removeItem("xiaokan_username");
      if (role) localStorage.setItem("xiaokan_role", role); else localStorage.removeItem("xiaokan_role");
      if (displayName) localStorage.setItem("xiaokan_display_name", displayName); else localStorage.removeItem("xiaokan_display_name");
    } catch (e) {}
  }
  function getDisplayName() {
    try { return localStorage.getItem("xiaokan_display_name") || ""; } catch (e) { return ""; }
  }
  function getMe() { return api("/api/me"); }
  function logout() {
    setToken("");
    setUser("", "");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // 管理后台保存的站点内容，存在对应容器时自动渲染
  function loadSiteContent() {
    if (!document.getElementById("site-friends-list") && !document.getElementById("site-skills-list") && !document.getElementById("site-projects-list") && !document.getElementById("site-social-list") && !document.getElementById("site-bio")) return;
    api("/api/site-content").then(function (d) {
      var bio = document.getElementById("site-bio"); if (bio) bio.textContent = d.bio || "还没有简介，去后台写。";
      function render(id, items, emptyText) {
        var box = document.getElementById(id);
        if (!box) return;
        if (!Array.isArray(items) || !items.length) {
          if (emptyText) box.innerHTML = '<div class="win"><div class="win-body"><p class="muted">' + escapeHtml(emptyText) + '</p></div></div>';
          return;
        }
        box.innerHTML = items.map(function (x) { return '<div class="win"><div class="win-title"><span class="win-label">' + escapeHtml(x.name || "未命名") + '</span></div><div class="win-body"><p>' + escapeHtml(x.desc || "") + '</p>' + (x.url ? '<p class="mt8"><a class="btn" href="' + escapeHtml(x.url) + '" target="_blank" rel="noopener">打开 ↗</a></p>' : '') + '</div></div>'; }).join("");
      }
      render("site-skills-list", d.skills, "后台还没加技能。");
      render("site-friends-list", d.friends, "还没有友链。想交换友链？留言板吱一声。");
      render("site-projects-list", d.projects, "后台还没加项目。");
      render("site-social-list", d.social, "后台还没加社交平台。");
    }).catch(function () {});
  }

  function showBindAlert(msg, type) {
    var box = document.getElementById("bind-email-alert");
    if (box) box.innerHTML = '<div class="alert ' + (type || "error") + '">' + escapeHtml(msg) + "</div>";
  }

  function showBindEmailModal() {
    if (document.getElementById("bind-email-modal")) return;
    var overlay = document.createElement("div");
    overlay.id = "bind-email-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="win modal-card">' +
        '<div class="win-title"><span class="win-label">绑定邮箱</span><span class="win-dots"><span class="dot"></span></span></div>' +
        '<div class="win-body">' +
          '<p class="muted mb8">账号还没绑邮箱。绑定后可以自助重置密码。</p>' +
          '<div id="bind-email-alert"></div>' +
          '<div class="form-row"><label for="bind-email">邮箱</label><input class="field" id="bind-email" type="email" maxlength="254" placeholder="you@example.com"></div>' +
          '<div class="mb8"><button class="btn primary" id="bind-send-code" type="button">发送验证码</button></div>' +
          '<div class="form-row"><label for="bind-code">验证码</label><input class="field" id="bind-code" inputmode="numeric" maxlength="6" placeholder="6 位数字"></div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            '<button class="btn" id="bind-later" type="button">稍后</button>' +
            '<button class="btn primary" id="bind-verify" type="button">确认绑定</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var emailInput = document.getElementById("bind-email");
    var codeInput = document.getElementById("bind-code");
    document.getElementById("bind-later").addEventListener("click", function () { overlay.remove(); });
    document.getElementById("bind-send-code").addEventListener("click", function () {
      var email = emailInput.value.trim();
      if (!email) { showBindAlert("先填邮箱"); return; }
      this.disabled = true;
      api("/api/me/email/code", { method: "POST", body: { email: email } })
        .then(function () { showBindAlert("验证码已进入发信队列，稍等查收。", "ok"); })
        .catch(function (err) { showBindAlert(err.message || "发送失败"); })
        .finally(function () { document.getElementById("bind-send-code").disabled = false; });
    });
    document.getElementById("bind-verify").addEventListener("click", function () {
      var email = emailInput.value.trim();
      var code = codeInput.value.trim();
      if (!email || !code) { showBindAlert("邮箱和验证码都要填"); return; }
      this.disabled = true;
      api("/api/me/email/verify", { method: "POST", body: { email: email, code: code } })
        .then(function () {
          showBindAlert("绑定成功", "ok");
          setTimeout(function () { overlay.remove(); }, 800);
        })
        .catch(function (err) { showBindAlert(err.message || "绑定失败"); })
        .finally(function () { document.getElementById("bind-verify").disabled = false; });
    });
  }

  function promptEmailBinding() {
    if (!isAuthed() || getRole() === "admin") return;
    var file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (file !== "index.html" && file !== "") return;
    getMe().then(function (me) {
      if (me && me.needs_email_binding) showBindEmailModal();
    }).catch(function () {});
  }

  function initCommon() {
    loadSiteContent();
    promptEmailBinding();
  }

  window.Blog = {
    api: api,
    getToken: getToken,
    setToken: setToken,
    isAuthed: isAuthed,
    getUsername: getUsername,
    getRole: getRole,
    getDisplayName: getDisplayName,
    getMe: getMe,
    setUser: setUser,
    logout: logout,
    escapeHtml: escapeHtml,
    fmtDate: fmtDate
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initCommon); else initCommon();
})();
