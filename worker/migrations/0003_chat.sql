-- AI 机器人
-- 短期限频：60 秒窗口最多 10 次
CREATE TABLE IF NOT EXISTS chat_rate_limits (
  ip TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- 每日用量：每 IP 每天最多 N 轮对话（默认 20，admin 可调）
CREATE TABLE IF NOT EXISTS chat_daily_usage (
  ip TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- 站点设置（key-value）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_daily_limit', '20');