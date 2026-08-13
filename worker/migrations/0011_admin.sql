-- 文章草稿状态 + 操作审计
ALTER TABLE articles ADD COLUMN status TEXT NOT NULL DEFAULT 'published';

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL
);
