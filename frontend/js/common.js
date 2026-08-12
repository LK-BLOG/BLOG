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

  window.Blog = { api: api, getToken: getToken, setToken: setToken, isAuthed: isAuthed, getUsername: getUsername, getRole: getRole, getDisplayName: getDisplayName, setUser: setUser, logout: logout, escapeHtml: escapeHtml, fmtDate: fmtDate };
})();