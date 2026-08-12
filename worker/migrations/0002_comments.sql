-- 文章评论区
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_slug TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_slug, id);

-- 评论限频（按 IP）
CREATE TABLE IF NOT EXISTS comment_rate_limits (
  ip TEXT PRIMARY KEY,
  last_post_at INTEGER NOT NULL
);