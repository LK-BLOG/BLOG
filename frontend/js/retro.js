/* The millennium theme uses a separate HTML 4 document and plain XHR. */
(function () {
  var title = document.getElementById("retro-title");
  var content = document.getElementById("retro-content");
  var params = {};
  var pairs = location.search.substring(1).split("&");
  var i;
  for (i = 0; i < pairs.length; i++) {
    var parts = pairs[i].split("=");
    try {
      if (/^(page|slug|q|tag|view|sort|p|cp|back)$/.test(parts[0])) {
        params[parts[0]] = decodeURIComponent((parts[1] || "").replace(/\+/g, " "));
      }
    } catch (error) { /* ignore malformed query parameters */ }
  }
  var page = params.page || "home";
  var keyword = (params.q || "").substring(0, 120);
  var token = "";
  var username = "";
  try {
    token = localStorage.getItem("xiaokan_token") || "";
    username = localStorage.getItem("xiaokan_username") || "";
  } catch (error) { /* storage can be disabled */ }

  function append(parent, tag, value) {
    var element = document.createElement(tag);
    if (value !== undefined) element.appendChild(document.createTextNode(value));
    parent.appendChild(element);
    return element;
  }

  function link(parent, value, href) {
    var a = append(parent, "a", value);
    a.href = href;
    return a;
  }

  function query(values) {
    var result = [];
    var key;
    for (key in values) {
      if (Object.prototype.hasOwnProperty.call(values, key) && values[key]) {
        result.push(encodeURIComponent(key) + "=" + encodeURIComponent(values[key]));
      }
    }
    return result.length ? "?" + result.join("&") : "";
  }

  function modernUrl(theme) {
    var back = page === "home" ? params.back : page;
    if (!/^(article|articles|guestbook|about|friends|admin|login)$/.test(back || "")) back = "index";
    var hash = location.hash === "#retro-comments" ? "#comments" : location.hash;
    return back + ".html" + query({
      theme: theme, slug: params.slug,
      q: back === "articles" ? keyword : "", tag: params.tag, view: params.view, sort: params.sort
    }) + hash;
  }

  var theme = document.getElementById("retro-theme");
  theme.onchange = function () {
    if (theme.value !== "retro") location.href = modernUrl(theme.value);
  };
  document.getElementById("retro-normal").href = modernUrl("normal");
  var activeNav = document.getElementById("retro-nav-" + (page === "article" ? "articles" : page));
  if (activeNav) activeNav.className = "current";
  var account = document.getElementById("retro-account");
  account.href = "login.html" + query({ theme: "retro", next: location.pathname + location.search + location.hash });

  function request(url, done, payload, failed, token) {
    var xhr = new XMLHttpRequest();
    xhr.open(payload ? "POST" : "GET", url, true);
    if (payload) xhr.setRequestHeader("Content-Type", "application/json");
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.timeout = 12000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var data;
        try { data = JSON.parse(xhr.responseText); }
        catch (error) {
          if (failed) failed("响应读不出来，请刷新重试。");
          else append(content, "p", "响应读不出来，请刷新重试。");
          return;
        }
        done(data);
      } else {
        var message = xhr.status === 404 ? "找不到这个页面。" :
          xhr.status === 429 ? "操作太频繁，等一分钟再试。" : "请求失败，请重试。";
        if (failed) {
          try { message = JSON.parse(xhr.responseText).detail || message; } catch (error) { /* keep status text */ }
          failed(typeof message === "string" ? message : "请检查填写的内容。");
        }
        else append(content, "p", message);
      }
    };
    xhr.send(payload ? JSON.stringify(payload) : null);
  }

  function heading(value) {
    title.firstChild.nodeValue = value;
    document.title = value + " | 小戡的个人主页";
  }

  function searchForm(target, label) {
    var form = append(content, "form");
    form.className = "retro-search";
    form.action = "retro.html";
    form.method = "get";
    var route = append(form, "input");
    route.type = "hidden";
    route.name = "page";
    route.value = target;
    if (page === "articles") {
      ["tag", "sort", "view"].forEach(function (name) {
        if (!params[name]) return;
        var state = append(form, "input");
        state.type = "hidden";
        state.name = name;
        state.value = params[name];
      });
    }
    var caption = append(form, "label", label);
    caption.htmlFor = "retro-search";
    var controls = append(form, "table");
    controls.summary = "";
    controls.className = "search-controls";
    var row = controls.insertRow(-1);
    var inputCell = row.insertCell(-1);
    var buttonCell = row.insertCell(-1);
    buttonCell.className = "search-action";
    var field = append(inputCell, "input");
    field.type = "text";
    field.id = "retro-search";
    field.name = "q";
    field.maxLength = 120;
    field.value = keyword;
    var submit = append(buttonCell, "input");
    submit.type = "submit";
    submit.value = "搜索";
  }

  function articleListUrl(tag, sort, view) {
    return "retro.html" + query({ page: "articles", q: keyword, tag: tag, sort: sort, view: view });
  }

  function articleFilters(parent, articles, results) {
    var bar = append(parent, "p");
    bar.className = "retro-filters";
    var view = params.view === "archive" ? "" : "archive";
    link(bar, view ? "按月归档" : "返回列表", articleListUrl(params.tag, params.sort, view));
    append(bar, "span", " · ");
    var sortLabel = append(bar, "label", "排序 ");
    var order = append(sortLabel, "select");
    var modes = [["latest", "最新发布"], ["oldest", "最早发布"], ["popular", "最多浏览"]];
    modes.forEach(function (mode) { append(order, "option", mode[1]).value = mode[0]; });
    order.value = /^(oldest|popular)$/.test(params.sort) ? params.sort : "latest";
    order.disabled = !view;
    order.onchange = function () { location.href = articleListUrl(params.tag, order.value, params.view); };
    var random = append(bar, "button", "随便读一篇");
    random.type = "button";
    random.disabled = !results.length;
    random.onclick = function () {
      location.href = "retro.html" + query({ page: "article", slug: results[Math.floor(Math.random() * results.length)].slug });
    };
    var tags = [];
    articles.forEach(function (article) {
      tagsOf(article).forEach(function (tag) { if (tags.indexOf(tag) < 0) tags.push(tag); });
    });
    if (params.tag && tags.indexOf(params.tag) < 0) tags.push(params.tag);
    var filters = append(parent, "p", "标签 ");
    link(filters, "全部", articleListUrl("", params.sort, params.view));
    tags.forEach(function (tag) {
      append(filters, "span", " · ");
      var item = link(filters, tag, articleListUrl(tag, params.sort, params.view));
      if (tag === params.tag) item.setAttribute("aria-current", "true");
    });
    append(parent, "p", "找到 " + results.length + " 篇");
  }

  function tagsOf(article) {
    return (article.tags || "").split(",").map(function (tag) { return tag.replace(/^\s+|\s+$/g, ""); })
      .filter(function (tag) { return tag; });
  }

  function articleList() {
    var target = content;
    if (page === "home") {
      heading("首页");
      searchForm("articles", "搜索文章");
      var portal = append(content, "table");
      portal.className = "portal";
      portal.summary = "";
      var row = portal.insertRow(-1);
      var main = row.insertCell(-1);
      main.className = "portal-main";
      var sidebar = row.insertCell(-1);
      target = panel(main, "最新文章");
      var projects = panel(main, "项目");
      var profile = panel(sidebar, "站长资料");
      var links = panel(sidebar, "友情链接");
      request("/api/site-content", function (site) {
        if (site.bio) append(profile, "p", site.bio);
        linksList(profile, site.social);
        linksList(projects, site.projects);
        linksList(links, (site.friends || []).slice(0, 5));
        link(links, "全部友链", "retro.html?page=friends");
      });
    } else {
      heading("文章");
      searchForm("articles", "全文搜索");
    }
    request("/api/articles" + query({ q: keyword }), function (data) {
      var articles = data.articles || [];
      var results = articles.filter(function (a) { return !params.tag || tagsOf(a).indexOf(params.tag) >= 0; });
      var archive = page === "articles" && params.view === "archive";
      if (page === "articles") {
        results.sort(function (a, b) {
          var newest = (b.created_at || "").localeCompare(a.created_at || "");
          if (archive) return newest;
          var pinned = (Number(b.pinned) || 0) - (Number(a.pinned) || 0);
          if (pinned) return pinned;
          if (params.sort === "oldest") return -newest;
          return params.sort === "popular" ? (Number(b.views) || 0) - (Number(a.views) || 0) || newest : newest;
        });
        articleFilters(target, articles, results);
      } else results = results.slice(0, 5);
      var list;
      var previousMonth;
      results.forEach(function (a) {
        var month = (a.created_at || "").substring(0, 7) || "日期未知";
        if (!list || (archive && month !== previousMonth)) {
          if (archive) append(target, "h3", month);
          list = append(target, "ul");
          list.className = "retro-entries";
          previousMonth = month;
        }
        var row = append(list, "li");
        link(row, a.title, "retro.html" + query({ page: "article", slug: a.slug }));
        append(row, "small", " — " + (a.created_at || "").substring(0, 10) + " · " + (Number(a.views) || 0) + " 次浏览").className = "retro-date";
      });
      if (!results.length) append(target, "p", "没有匹配的文章。");
      if (page === "home" && results.length) link(append(target, "p"), "全部文章", "retro.html?page=articles");
    });
  }

  function panel(parent, caption) {
    var frame = append(parent, "div");
    frame.className = "portal-panel";
    append(frame, "h3", caption);
    var body = append(frame, "div");
    body.className = "panel-body";
    return body;
  }

  function linksList(parent, items) {
    if (!items || !items.length) return;
    var list = append(parent, "ul");
    var n;
    for (n = 0; n < items.length; n++) {
      var item = items[n];
      var entry = append(list, "li");
      var url = readerLink(item.url);
      if (url) link(entry, item.name || url, url);
      else append(entry, "b", item.name || "");
      if (item.desc) append(entry, "div", item.desc);
    }
  }

  function sitePage() {
    heading(page === "friends" ? "友情链接" : "关于我");
    request("/api/site-content", function (site) {
      if (page === "friends") {
        if (site.friends && site.friends.length) linksList(content, site.friends);
        else append(content, "p", "还没有友链。");
      } else {
        if (site.bio) append(content, "p", site.bio);
        linksList(panel(content, "项目"), site.projects);
        linksList(panel(content, "联系方式"), site.social);
      }
    });
  }

  function safeLink(value) {
    return /^(https?:\/\/[^\s]+|\/api\/media\/[a-z0-9._/-]+)$/i.test(value || "") ? value : "";
  }

  function readerLink(value) {
    var href = safeLink(value);
    if (!href && !/^(#|\/?(?:index|articles?|guestbook|friends|about)(?:\.html)?(?:[?#]|$))/i.test(value || "")) return "";
    var destination = document.createElement("a");
    destination.href = href || value;
    if (destination.host !== location.host || destination.protocol !== location.protocol) return href;
    var route = destination.pathname.replace(/^\//, "").replace(/\.html$/i, "");
    if (route === "index" || !route) route = "home";
    if (!/^(home|articles?|guestbook|friends|about)$/.test(route)) return href || value;
    var search = destination.search ? "&" + destination.search.substring(1) : "";
    return "retro.html?page=" + route + search + destination.hash;
  }

  function inline(parent, value) {
    var markup = /(!?)\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
    var last = 0;
    var match;
    while ((match = markup.exec(value))) {
      parent.appendChild(document.createTextNode(value.substring(last, match.index)));
      var url = match[1] ? safeLink(match[3]) : readerLink(match[3]);
      if (match[4]) append(parent, "code", match[4]);
      else if (match[5]) append(parent, "b", match[5]);
      else if (match[1] && url) {
        var image = append(parent, "img");
        image.src = url;
        image.alt = match[2];
      } else if (url) link(parent, match[2], url);
      else parent.appendChild(document.createTextNode(match[2]));
      last = markup.lastIndex;
    }
    parent.appendChild(document.createTextNode(value.substring(last)));
  }

  function renderArticle(markdown) {
    var directory = document.createElement("div");
    var entries = panel(directory, "文章目录");
    var contents = append(entries, "ul");
    var start = append(content, "div");
    var lines = (markdown || "").split(/\r?\n/);
    var code = null;
    var list = null;
    var sectionNumber = 0;
    var n;
    for (n = 0; n < lines.length; n++) {
      var line = lines[n].replace(/^\uFEFF+|\uFEFF+$/g, "");
      if (/^```/.test(line)) {
        if (code) {
          append(content, "pre", code.join("\n"));
          code = null;
        } else code = [];
        list = null;
        continue;
      }
      if (code) { code.push(line); continue; }
      if (!line) { list = null; continue; }
      var section = /^(#{1,5})\s+(.+)$/.exec(line);
      var bullet = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
      var button = /<button\b[^>]*\bdata-url="([^"]+)"[^>]*>(.*?)<\/button>/i.exec(line);
      if (bullet) {
        var listType = /^\s*\d+\./.test(line) ? "OL" : "UL";
        if (!list || list.tagName !== listType) list = append(content, listType.toLowerCase());
        inline(append(list, "li"), bullet[1]);
      } else {
        list = null;
        if (section) {
          var headingLevel = section[1].length;
          var entry = append(content, "h" + Math.max(3, headingLevel));
          if (headingLevel >= 2 && headingLevel <= 4) {
            entry.id = "section-" + (++sectionNumber);
            var item = append(contents, "li");
            item.className = "contents-level-" + headingLevel;
            link(item, section[2], "#" + entry.id);
          }
          inline(entry, section[2]);
        }
        else if (button && safeLink(button[1])) {
          link(append(content, "p"), button[2].replace(/<[^>]+>|\uFEFF/g, ""), button[1]);
        } else inline(append(content, "p"), line);
      }
    }
    if (code) append(content, "pre", code.join("\n"));
    if (sectionNumber > 1) content.insertBefore(directory, start);
    content.removeChild(start);
  }

  function article() {
    if (!params.slug) { heading("缺少文章编号"); return; }
    request("/api/articles/" + encodeURIComponent(params.slug), function (data) {
      heading(data.title);
      append(content, "small", (data.created_at || "").substring(0, 10)).className = "retro-date";
      append(content, "span", " · ");
      link(content, "评论", "#retro-comments");
      tagsOf(data).forEach(function (tag) {
        append(content, "span", " · ");
        link(content, "#" + tag, "retro.html" + query({ page: "articles", tag: tag }));
      });
      renderArticle(data.content_md);
      append(content, "hr");
      articleComments();
      var anchor = location.hash.substring(1);
      var target = /^section-\d+$|^retro-comments$/.test(anchor) && document.getElementById(anchor);
      if (target) target.scrollIntoView();
    });
  }

  function articleComments() {
    var section = panel(content, "评论区");
    section.id = "retro-comments";
    var url = "/api/articles/" + encodeURIComponent(params.slug) + "/comments";
    var base = "retro.html" + query({ page: "article", slug: params.slug });
    if (token) {
      var form = append(section, "form");
      var label = append(form, "label", "评论：");
      label.htmlFor = "retro-comment";
      append(form, "br");
      var input = append(form, "textarea");
      input.id = "retro-comment";
      input.maxLength = 500;
      input.rows = 3;
      input.cols = 42;
      append(form, "br");
      var submit = append(form, "input");
      submit.type = "submit";
      submit.value = "提交评论";
      var status = append(form, "span");
      status.setAttribute("aria-live", "polite");
      form.onsubmit = function () {
        var value = input.value.replace(/^\s+|\s+$/g, "");
        if (!value) { status.textContent = " 请填写评论。"; return false; }
        submit.disabled = true;
        request(url, function () {
          location.href = base + "#retro-comments";
          location.reload();
        }, { content: value }, function (error) {
          status.textContent = " " + error;
          submit.disabled = false;
        }, token);
        return false;
      };
    } else {
      link(append(section, "p"), "登录后回来评论", "login.html" + query({ theme: "retro", next: base + "#retro-comments" }));
    }
    request(url + query({ page: parseInt(params.cp, 10) || 1 }), function (data) {
      var comments = data.comments || [];
      var n;
      if (!comments.length) append(section, "p", "还没有评论。");
      for (n = 0; n < comments.length; n++) {
        var c = comments[n];
        var entry = append(section, "div");
        entry.className = c.parent_id ? "retro-comment retro-reply" : "retro-comment";
        var header = append(entry, "p");
        append(header, "b", c.nickname);
        append(header, "small", " — " + (c.created_at || "").substring(0, 10));
        append(entry, "p", c.content);
      }
      if (data.total_pages > 1) {
        var nav = append(section, "p");
        if (data.page > 1) link(nav, "上一页", base + "&cp=" + (data.page - 1) + "#retro-comments");
        append(nav, "span", " 第 " + data.page + " / " + data.total_pages + " 页 ");
        if (data.page < data.total_pages) link(nav, "下一页", base + "&cp=" + (data.page + 1) + "#retro-comments");
      }
    });
  }

  function guestbook() {
    heading("留言板");
    searchForm("guestbook", "搜留言");
    var form = append(content, "form");
    var nicknameRow = append(form, "p");
    var nicknameLabel = append(nicknameRow, "label", "昵称：");
    nicknameLabel.htmlFor = "retro-nickname";
    var nickname = append(nicknameRow, "input");
    nickname.id = "retro-nickname";
    nickname.type = "text";
    nickname.maxLength = 30;
    if (token) nicknameRow.style.display = "none";
    var messageRow = append(form, "p");
    var messageLabel = append(messageRow, "label", "留言：");
    messageLabel.htmlFor = "retro-message";
    append(messageRow, "br");
    var message = append(messageRow, "textarea");
    message.id = "retro-message";
    message.cols = 42;
    message.rows = 3;
    message.maxLength = 500;
    var length = append(messageRow, "small");
    var draftKey = "xiaokan_guestbook_draft:" + (token ? username : "guest");
    try { message.value = (localStorage.getItem(draftKey) || "").substring(0, 500); }
    catch (error) { /* storage can be disabled */ }
    function saveDraft() {
      length.textContent = " " + message.value.length + " / 500";
      try {
        if (message.value) localStorage.setItem(draftKey, message.value);
        else localStorage.removeItem(draftKey);
      } catch (error) { /* storage can be disabled */ }
    }
    saveDraft();
    message.oninput = saveDraft;
    var submit = append(form, "input");
    submit.type = "submit";
    submit.value = "提交留言";
    var status = append(form, "strong");
    status.setAttribute("aria-live", "polite");
    form.onsubmit = function () {
      var name = nickname.value.replace(/^\s+|\s+$/g, "");
      var value = message.value.replace(/^\s+|\s+$/g, "");
      if ((!token && !name) || !value || value.length > 500) {
        status.textContent = " 请填昵称和留言，留言最多 500 字。";
        return false;
      }
      submit.disabled = true;
      status.textContent = " 正在提交…";
      var payload = { content: value };
      if (!token) payload.nickname = name;
      request("/api/messages", function () {
        if (message.value.replace(/^\s+|\s+$/g, "") === value) {
          message.value = "";
          saveDraft();
        }
        location.href = "retro.html?page=guestbook";
      }, payload, function (error) {
        status.textContent = " " + error;
        submit.disabled = false;
      }, token);
      return false;
    };
    var number = parseInt(params.p, 10) || 1;
    request("/api/messages" + query({ page: number, q: keyword }), function (data) {
      var messages = data.messages || [];
      var n;
      if (!messages.length) append(content, "p", "没有匹配的留言。");
      for (n = 0; n < messages.length; n++) {
        var m = messages[n];
        append(content, "hr");
        var byline = append(content, "p");
        append(byline, "b", m.nickname);
        append(byline, "small", " — " + (m.created_at || "").substring(0, 10));
        append(content, "p", m.content);
      }
      var nav = append(content, "p");
      if (data.page > 1) link(nav, "上一页", "retro.html" + query({ page: "guestbook", q: keyword, p: data.page - 1 }));
      append(nav, "span", " 第 " + data.page + " / " + data.total_pages + " 页 ");
      if (data.page < data.total_pages) link(nav, "下一页", "retro.html" + query({ page: "guestbook", q: keyword, p: data.page + 1 }));
    });
  }

  if (page === "article") article();
  else if (page === "guestbook") guestbook();
  else if (page === "friends" || page === "about") sitePage();
  else articleList();
})();
