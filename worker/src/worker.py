# ============================================================
# 小戡的博客 API
# Python Worker (FastAPI) + Cloudflare D1
# 路由前缀统一 /api/*
# ============================================================
import hashlib
import hmac
import re
import time
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from workers import WorkerEntrypoint

app = FastAPI()

# 公开 API，前端在 pages.dev 域，Worker 在 workers.dev 域，放开跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
RATE_LIMIT_SECONDS = 60
MAX_MESSAGES = 200


# ---------- 工具 ----------

def _db(request: Request):
    return request.scope["env"].DB


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _make_token(password: str) -> str:
    return hmac.new(password.encode("utf-8"), b"xiaokan-blog-admin-v1", hashlib.sha256).hexdigest()


def _check_admin(request: Request) -> None:
    env = request.scope["env"]
    expected = _make_token(getattr(env, "ADMIN_PASSWORD", ""))
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        auth = auth[7:]
    if not hmac.compare_digest(auth, expected):
        raise HTTPException(status_code=401, detail="未授权，请重新登录")


# ---------- 请求体 ----------

class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class ArticleIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    content_md: str = Field(min_length=1, max_length=100000)


class MessageIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=30)
    content: str = Field(min_length=1, max_length=500)

    @field_validator("nickname", "content")
    @classmethod
    def strip_and_check(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("不能为空")
        return v


# ---------- 健康检查 ----------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---------- 登录 ----------

@app.post("/api/login")
async def login(body: LoginIn, request: Request):
    env = request.scope["env"]
    if not hmac.compare_digest(body.password, getattr(env, "ADMIN_PASSWORD", "")):
        raise HTTPException(status_code=401, detail="密码错误")
    return {"token": _make_token(env.ADMIN_PASSWORD)}


# ---------- 文章 ----------

@app.get("/api/articles")
async def list_articles(request: Request):
    res = await _db(request).prepare(
        "SELECT slug, title, created_at, updated_at FROM articles ORDER BY created_at DESC"
    ).all()
    return {"articles": res.results}


@app.get("/api/articles/{slug}")
async def get_article(slug: str, request: Request):
    row = await _db(request).prepare(
        "SELECT slug, title, content_md, created_at, updated_at FROM articles WHERE slug = ?"
    ).bind(slug).first()
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在")
    return row


@app.post("/api/articles")
async def create_article(body: ArticleIn, request: Request):
    _check_admin(request)
    slug = body.slug.strip()
    if not SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="slug 只能包含字母、数字、中划线、下划线（1-120 位）")
    dup = await _db(request).prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first()
    if dup:
        raise HTTPException(status_code=409, detail="slug 已存在，换个标识")
    now = _now_iso()
    await _db(request).prepare(
        "INSERT INTO articles (slug, title, content_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(slug, body.title.strip(), body.content_md, now, now).run()
    return {"ok": True, "slug": slug}


@app.put("/api/articles/{slug}")
async def update_article(slug: str, body: ArticleIn, request: Request):
    _check_admin(request)
    res = await _db(request).prepare(
        "UPDATE articles SET title = ?, content_md = ?, updated_at = ? WHERE slug = ?"
    ).bind(body.title.strip(), body.content_md, _now_iso(), slug).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {"ok": True, "slug": slug}


@app.delete("/api/articles/{slug}")
async def delete_article(slug: str, request: Request):
    _check_admin(request)
    res = await _db(request).prepare("DELETE FROM articles WHERE slug = ?").bind(slug).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {"ok": True}


# ---------- 留言板 ----------

@app.get("/api/messages")
async def list_messages(request: Request):
    res = await _db(request).prepare(
        "SELECT id, nickname, content, created_at FROM messages ORDER BY id DESC LIMIT ?"
    ).bind(MAX_MESSAGES).all()
    return {"messages": res.results}


@app.post("/api/messages")
async def create_message(body: MessageIn, request: Request):
    ip = (request.client.host if request.client else None) or request.headers.get("cf-connecting-ip") or "unknown"
    now_ts = int(time.time())
    db = _db(request)

    # 限频：同一 IP 60 秒内只能发一条
    row = await db.prepare("SELECT last_post_at FROM rate_limits WHERE ip = ?").bind(ip).first()
    if row and (now_ts - int(row["last_post_at"])) < RATE_LIMIT_SECONDS:
        raise HTTPException(status_code=429, detail="留言太频繁，请 60 秒后再试")

    await db.prepare(
        "INSERT INTO rate_limits (ip, last_post_at) VALUES (?, ?) "
        "ON CONFLICT(ip) DO UPDATE SET last_post_at = excluded.last_post_at"
    ).bind(ip, now_ts).run()

    await db.prepare(
        "INSERT INTO messages (nickname, content, created_at) VALUES (?, ?, ?)"
    ).bind(body.nickname.strip(), body.content.strip(), _now_iso()).run()
    return {"ok": True}


@app.delete("/api/messages/{message_id}")
async def delete_message(message_id: int, request: Request):
    _check_admin(request)
    res = await _db(request).prepare("DELETE FROM messages WHERE id = ?").bind(message_id).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="留言不存在")
    return {"ok": True}


# ---------- Worker 入口 ----------

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi
        return await asgi.fetch(app, request.js_object, self.env)