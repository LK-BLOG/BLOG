/* Set the account palette before its stylesheets and body are parsed. */
(function () {
  var theme = new URLSearchParams(location.search).get("theme");
  if (theme === "retro") document.documentElement.setAttribute("data-theme", theme);
})();
