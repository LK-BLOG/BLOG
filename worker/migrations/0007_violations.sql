-- 机器人封号：违规累计 + 临时封禁截止时间
ALTER TABLE users ADD COLUMN banned_until INTEGER;

CREATE TABLE IF NOT EXISTS user_violations (
  user_id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
