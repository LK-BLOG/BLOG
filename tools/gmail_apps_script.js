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
      htmlBody: buildHtml(data.subject, data.body),
    });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(subject, body) {
  const source = String(body || "");
  const match = source.match(/验证码：(\d{6})/);
  const code = match ? match[1] : "";
  const message = source
    .replace(/验证码：\d{6}/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const messageHtml = message
    ? '<p style="font-size:15px;line-height:1.8;color:#3a3a3c;margin:0 0 18px;">' +
      escapeHtml(message).replace(/\n/g, "<br>") + "</p>"
    : "";
  const codeHtml = code
    ? '<div style="margin:22px 0;padding:16px 20px;background:#f0f7f7;border:1px solid #b8dcdc;' +
      'border-radius:12px;text-align:center;font-size:34px;letter-spacing:6px;font-weight:700;' +
      'color:#006060;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">' +
      code + "</div>"
    : "";
  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f7;' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',Arial,sans-serif;\">" +
    '<div style="max-width:560px;margin:0 auto;padding:32px 16px;">' +
    '<div style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px;overflow:hidden;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.06);">' +
    '<div style="background:#008080;padding:18px 24px;color:#ffffff;font-size:16px;font-weight:600;">小戡的博客</div>' +
    '<div style="padding:28px 24px;color:#1d1d1f;">' +
    '<h1 style="font-size:20px;line-height:1.4;margin:0 0 16px;">' + escapeHtml(subject) + "</h1>" +
    messageHtml + codeHtml +
    '<p style="font-size:13px;line-height:1.6;color:#8e8e93;margin:18px 0 0;">验证码 10 分钟内有效。请勿把验证码告诉别人。</p>' +
    "</div></div>" +
    '<p style="text-align:center;font-size:12px;color:#8e8e93;margin:16px 0 0;">这封邮件由小戡的博客自动发送，请勿回复。</p>' +
    "</div></body></html>"
  );
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
