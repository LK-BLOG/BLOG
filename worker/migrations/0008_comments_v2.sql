-- 评论系统升级：显示名 / 回复 / 登录制 / bot 评论 / 举报表
ALTER TABLE users ADD COLUMN display_name TEXT;

ALTER TABLE comments ADD COLUMN user_id INTEGER;
ALTER TABLE comments ADD COLUMN parent_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;

ALTER TABLE messages ADD COLUMN user_id INTEGER;

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT,
  reporter TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
