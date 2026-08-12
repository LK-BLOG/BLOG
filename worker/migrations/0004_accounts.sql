-- 账号体系：用户 + 按账号的机器人限流
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

-- 短期限频：60 秒窗口最多 10 次（按账号）
CREATE TABLE IF NOT EXISTS user_chat_rate_limits (
  user_id INTEGER PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- 每日用量：每账号每天最多 N 轮对话（默认 20，admin 可调）
CREATE TABLE IF NOT EXISTS user_chat_daily_usage (
  user_id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- 注册限频：同一 IP 60 秒内只能注册一次
CREATE TABLE IF NOT EXISTS register_rate_limits (
  ip TEXT PRIMARY KEY,
  last_post_at INTEGER NOT NULL
);
