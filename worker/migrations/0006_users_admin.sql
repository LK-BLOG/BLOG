-- 用户管理 + 每 IP 每日注册上限 + 账号封禁
ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS register_daily_limits (
  ip TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('register_daily_limit', '3');
