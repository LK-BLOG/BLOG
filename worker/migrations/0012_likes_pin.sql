-- 评论点赞 + 文章置顶
ALTER TABLE comments ADD COLUMN likes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, comment_id)
);
