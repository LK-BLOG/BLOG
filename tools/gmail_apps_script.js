/**
 * 小戡博客 Gmail 发信口。
 *
 * 用法：
 * 1. 新建 Apps Script 项目，把本文件内容粘进去。
 * 2. 改下面的 SECRET。
 * 3. 部署 -> 新部署 -> Web 应用。
 *    - 执行身份：我
 *    - 访问权限：任何人
 * 4. 复制 Web 应用 URL，填到 Cloudflare 的 GMAIL_SCRIPT_URL。
 * 5. SECRET 填到 Cloudflare 的 GMAIL_SCRIPT_TOKEN。
 *
 * 建议专门注册一个博客 Gmail，不要用个人邮箱。
 */

const SECRET = "CHANGE_ME";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.token !== SECRET) return json({ ok: false, error: "bad token" });
    if (!data.to || !data.subject || !data.body) return json({ ok: false, error: "missing fields" });
    GmailApp.sendEmail(data.to, data.subject, data.body, {
      name: data.from_name || "小戡的博客",
    });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
