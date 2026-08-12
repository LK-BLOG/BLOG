-- 登录防暴力破解：密码错 5 次锁 60 秒（按 IP + 用户名 分别计数）
CREATE TABLE IF NOT EXISTS login_rate_limits (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
