-- 安全加固：token 可吊销、邮件正文不再明文、发信配额、浏览防刷
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE email_outbox ADD COLUMN body_cipher TEXT;
-- 旧队列里可能躺着已经过期的验证码明文，直接清掉。
UPDATE email_outbox SET body = '' WHERE body LIKE '%验证码：%';

CREATE INDEX IF NOT EXISTS idx_email_verifications_cleanup
  ON email_verifications(created_ts);

CREATE INDEX IF NOT EXISTS idx_email_outbox_created
  ON email_outbox(created_at);

CREATE TABLE IF NOT EXISTS email_send_quotas (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS article_view_limits (
  article_slug TEXT NOT NULL,
  ip TEXT NOT NULL,
  last_view_at INTEGER NOT NULL,
  PRIMARY KEY (article_slug, ip)
);

CREATE INDEX IF NOT EXISTS idx_article_view_limits_cleanup
  ON article_view_limits(last_view_at);
