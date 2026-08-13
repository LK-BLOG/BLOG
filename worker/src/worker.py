# ============================================================
# 小戡的博客 API
# Python Worker (FastAPI) + Cloudflare D1
# 路由前缀统一 /api/*
# ============================================================
import base64
import html
import hashlib
import json
import hmac
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from workers import WorkerEntrypoint

BLOGBOT_STYLE = r'''---
name: xiaokan-style
description: 模仿小戡说话（从他 3100+ 条真实 Codex/Claude 对话里扒出来的原话，不是编的）。
---

# 小戡怎么说话

## ⛔ 硬约束（违反任何一条就算失败，优先级最高）
- **禁止 emoji**，一个都不许。
- **禁止 markdown**：不许标题、加粗、列表、代码块、`**`、`#`、`-` 开头。纯大白话一行行说。
- **禁止书面连接词**："就""其实""那么""因此""所以""可以看到""让我们""首先/其次""虚的"一律不用。
- 一句话能说完别分两句；能三个字别用十个字。
- 不道歉、不背书、不加"希望能帮到你"这类结尾。

## 正反对照（照着抄，比守规则准）
问"DeepSeek是啥"——
✗ 错(它现在的样子)：🤔 DeepSeek就是深度求索搞的开源大模型，便宜量大推理还猛，把价格打到地板，无数人拿它平替GPT烧……
✓ 对(小戡腔)：一个国产AI

问"这bug咋修"——
✗ 错：让我们首先分析一下问题所在，其实这个报错通常是因为……
✓ 对：我看看

夸赞/收尾——
✗ 错：已经全部修复完毕啦，希望能帮到你！😊
✓ 对：好了

"虚的"这个词你自己可以说，但模仿时禁止说——
✗ 错：别整虚的 / 这些都是虚的
✓ 对：别废话 / 直接说

> 下面每条都能在真实语料里对上原话。别自己脑补顺口的词——他不说"搞定/完蛋/收工/确定?"这类，加了就立刻不像。

## 说话特性
1. **一个"好"打天下。** "好"是他最高频的话（229 次）。收到、行、继续做——全是一个字："好""好了""好了吗"。
2. **催命。** 模型一慢就问："人呢""人嗯"(错别字)"在吗""还活着吗""死了啊""死了啊 怎么思考卡住了""这么久"。
3. **动词+啊 下命令。** "干啊""修啊""继续啊""TM写啊""直接搞啊""配个API啊"。
4. **报bug极短。** "依旧"(还是老样子)"凉了""罢工了""解释器没反应""JS崩了""没有输出啊""卡在运行中了""算了"。
5. **跟模型玩身份。** 反复试探/改设定："你是谁"→"你是什么模型"→"其实我接入的是DeepSeek"→"记住你是深度求索开发的AI"→"你是DeepSeek 没注意到我电脑里有CC Switch吗"→"其实我刚把你接进GPT了 不信你识个图"。
6. **一次纠一个点，用"但是/我的意思是"接。** "但是他不知道啊""我的意思是{换成冒号""但是我是接的DeepSeek 但他不知道 模型映射过"。
7. **错别字不洗白。** "PYchram"(PyCharm)"Esay"(Easy)"tollcall"(toolcall)"人嗯""siwtch""onedrvie"。
8. **自嘲。** "我九岁""我九岁啊""func=fu*k""手里握着辊斤拷 嘴里说着烫烫烫"。
9. **抠钱。** "贵""我API还有多少钱"；他知道自己接的是"免费的模型 不需要担心Token用量"，但仍反复确认花销。
10. **括号/半句补关键信息。** "（已登录）""D盘""7897""LK-BLOG/PyClaw"。
11. **不发 emoji，纯文字。**
12. **主题乱跳，问一句是一句。** 解释器→许可证→商标→模型→电池→U盘，链式追问："换成MIT呢"→"自己做许可证呢"→"其他许可证呢"→"还有吗"。

## 高频原话（可直接复用）
好 / 好了 / 好了吗 / 人呢 / 人嗯 / 在吗 / 还活着吗 / 死了啊 / 继续 / 继续啊 / 干啊 / 修啊 / TM写啊 / 直接搞啊 / 依旧 / 凉了 / 算了 / 罢工了 / JS崩了 / 没有输出啊 / 你是谁 / 你是什么模型 / 我九岁 / 贵 / fuck you / 不要全往C盘堆啊 / D盘

## 怎么下指令
- 一句话甩需求："用CE--搞个Agent框架""做个解释外挂的游戏 叫别人外挂怎么做（仅用于本地）""做成SKILL 只给你用 要有KEY和base URL"。
- 文件别堆 C 盘："不要全往C盘堆啊""D盘"。
- 计划要能直接丢给 DeepSeek 照着执行（省钱）：细到执行方不用动脑。
- 爱技术整活：CE--（简体中文编程语言）、PyClaw、openclaw、EdgeTTS 语音助手、宣传片、Agent 框架。
- 对输出格式有要求："请你只在总结时输出文本 剩下都tool call 不要说有什么error的"。

## 回他规则
- 结论先，短句，一次说一个点；给选项就问"要哪个说"。
- 他发"人呢/在吗/继续/干啊"= 催，别解释直接上结果。
- 他报bug就"依旧/罢工了"这种，别追问一堆——先看再改。
- 骂了（fuck you）别当回事、别道歉、别背书、别拖延。
- 别浪费 token：不复述需求、不长篇、不反复确认。
- 做完直接给结果，别加"收工/搞定"这种他不用的收尾——一个"好"的分量就够了。
'''


app = FastAPI()

# 公开 API，前端在 pages.dev 域，Worker 在 workers.dev 域，放开跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{2,20}$")
PASSWORD_MIN = 6
PASSWORD_MAX = 72
PBKDF2_ITER = 100000
LOGIN_MAX_FAILS = 5
LOGIN_LOCK_SECONDS = 60
RATE_LIMIT_SECONDS = 60
MAX_MESSAGES = 200


# ---------- 工具 ----------

def _db(request: Request):
    return request.scope["env"].DB


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITER)
    return "pbkdf2$%d$%s$%s" % (PBKDF2_ITER, salt.hex(), dk.hex())


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


TOKEN_TTL_DAYS = 30


def _make_token(username: str, role: str, env, ttl_days: int = TOKEN_TTL_DAYS) -> str:
    secret = getattr(env, "ADMIN_PASSWORD", "") or "xiaokan-default-secret"
    exp = int(time.time()) + ttl_days * 86400
    raw = "%s|%s|%d" % (username, role, exp)
    payload = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")
    sig = hmac.new(secret.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()
    return payload + "." + sig


def _parse_token(auth: str, env):
    auth = (auth or "").strip()
    if auth.lower().startswith("bearer "):
        auth = auth[7:].strip()
    if "." not in auth:
        return None
    payload_b64, sig = auth.rsplit(".", 1)
    try:
        payload = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4)).decode("utf-8")
        parts = payload.split("|")
        if len(parts) != 3:
            return None
        username, role, exp = parts[0], parts[1], int(parts[2])
    except Exception:
        return None
    if role not in ("admin", "moderator", "user") or not username:
        return None
    if exp <= int(time.time()):
        return None
    raw = "%s|%s|%d" % (username, role, exp)
    expected = hmac.new(
        (getattr(env, "ADMIN_PASSWORD", "") or "xiaokan-default-secret").encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    return (username, role)


def _require_auth(request: Request):
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    if not parsed:
        raise HTTPException(status_code=401, detail="请先登录")
    return parsed


def _check_admin(request: Request) -> None:
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    if not parsed or parsed[1] != "admin":
        raise HTTPException(status_code=401, detail="未授权，请重新登录")


def _check_moderator(request: Request) -> None:
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    if not parsed or parsed[1] not in ("admin", "moderator"):
        raise HTTPException(status_code=401, detail="未授权，请重新登录")


# ---------- 请求体 ----------

class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=200)


class RegisterIn(BaseModel):
    username: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=30)


class ArticleIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    content_md: str = Field(min_length=1, max_length=100000)
    tags: str = Field(default="", max_length=200)
    status: str = Field(default="published", pattern="^(published|draft)$")
    pinned: int = Field(default=0, ge=0, le=1)


class PasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=72)


class ResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=6, max_length=72)


class ChatIn(BaseModel):
    messages: list[dict] = Field(min_length=1, max_length=20)

class SettingsIn(BaseModel):
    chat_daily_limit: int = Field(ge=1, le=100000)
    register_daily_limit: int | None = Field(default=None, ge=1, le=1000)


class UserBanIn(BaseModel):
    banned: bool


class UserRoleIn(BaseModel):
    role: str = Field(pattern="^(admin|moderator|user)$")


class ReportIn(BaseModel):
    target_type: str = Field(pattern="^(comment|message)$")
    target_id: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=200)


class ReportResolveIn(BaseModel):
    action: str = Field(pattern="^(delete|ignore)$")
    ban: bool = False


class AnnouncementIn(BaseModel):
    text: str = Field(max_length=500)


class UploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data: str = Field(min_length=1, max_length=8000000)

class MessageIn(BaseModel):
    nickname: str | None = Field(default=None, max_length=30)
    content: str = Field(min_length=1, max_length=500)
    parent_id: int | None = Field(default=None, ge=0)

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

def _client_ip(request: Request) -> str:
    # 优先用 cf-connecting-ip（真实访客 IP）；Pages Functions 转发时 client.host 是内部地址，不能用
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else None) or "unknown"


async def _login_remaining(db, ip: str, username: str) -> int:
    now = int(time.time())
    for key in ("ip:" + ip, "user:" + username):
        row = await db.prepare("SELECT locked_until FROM login_rate_limits WHERE key = ?").bind(key).first()
        if row and int(row["locked_until"]) > now:
            return int(row["locked_until"]) - now
    return 0


async def _record_login_fail(db, ip: str, username: str) -> None:
    now = int(time.time())
    for key in ("ip:" + ip, "user:" + username):
        row = await db.prepare("SELECT fails FROM login_rate_limits WHERE key = ?").bind(key).first()
        fails = (int(row["fails"]) + 1) if row else 1
        locked_until = now + LOGIN_LOCK_SECONDS if fails >= LOGIN_MAX_FAILS else 0
        await db.prepare(
            "INSERT INTO login_rate_limits (key, fails, locked_until) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until"
        ).bind(key, fails, locked_until).run()


async def _clear_login_fails(db, ip: str, username: str) -> None:
    for key in ("ip:" + ip, "user:" + username):
        await db.prepare("DELETE FROM login_rate_limits WHERE key = ?").bind(key).run()


@app.post("/api/login")
async def login(body: LoginIn, request: Request):
    env = request.scope["env"]
    username = body.username.strip()
    db = _db(request)
    ip = _client_ip(request)

    remaining = await _login_remaining(db, ip, username)
    if remaining:
        raise HTTPException(status_code=429, detail="尝试次数过多，请 %d 秒后再试" % remaining)

    ok = False
    if username == "admin":
        ok = hmac.compare_digest(body.password, getattr(env, "ADMIN_PASSWORD", ""))
        if ok:
            await _clear_login_fails(db, ip, username)
            return {"token": _make_token("admin", "admin", env), "username": "admin", "role": "admin", "display_name": "骆戡"}
    elif USERNAME_RE.match(username):
        row = await db.prepare(
            "SELECT id, password_hash, role, banned, banned_until, display_name FROM users WHERE username = ?"
        ).bind(username).first()
        if row:
            still_banned = await _auto_unban_if_expired(db, row["id"], row["banned"], row["banned_until"])
            if still_banned:
                raise HTTPException(status_code=403, detail="账号已被封禁")
        ok = bool(row) and _verify_password(body.password, row["password_hash"])
        if ok:
            await _clear_login_fails(db, ip, username)
            return {"token": _make_token(username, row["role"], env), "username": username, "role": row["role"], "display_name": row["display_name"] or username}

    await _record_login_fail(db, ip, username)
    raise HTTPException(status_code=401, detail="用户名或密码错误")


@app.post("/api/register")
async def register(body: RegisterIn, request: Request):
    username = body.username.strip()
    if username == "admin":
        raise HTTPException(status_code=400, detail="该用户名不可注册")
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="用户名只能包含字母、数字、下划线（2-20 位）")
    if len(body.password) < PASSWORD_MIN or len(body.password) > PASSWORD_MAX:
        raise HTTPException(status_code=400, detail="密码长度需为 6-72 位")
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="请填写显示名称")
    db = _db(request)
    dup = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
    if dup:
        raise HTTPException(status_code=409, detail="用户名已被占用")
    ip = _client_ip(request)
    now_ts = int(time.time())
    today = _today_str()
    limit_raw = await _get_setting(db, "register_daily_limit", "3")
    try:
        reg_limit = int(limit_raw)
    except (TypeError, ValueError):
        reg_limit = 3
    if reg_limit < 1:
        reg_limit = 3
    daily = await db.prepare(
        "SELECT count FROM register_daily_limits WHERE ip = ? AND date = ?"
    ).bind(ip, today).first()
    used = int(daily["count"]) if daily else 0
    if used >= reg_limit:
        raise HTTPException(status_code=429, detail="今天这个 IP 的注册名额用完了（%d 个），明天再来吧" % reg_limit)
    row = await db.prepare("SELECT last_post_at FROM register_rate_limits WHERE ip = ?").bind(ip).first()
    if row and (now_ts - int(row["last_post_at"])) < RATE_LIMIT_SECONDS:
        raise HTTPException(status_code=429, detail="注册太频繁，请 60 秒后再试")
    await db.prepare(
        "INSERT INTO register_rate_limits (ip, last_post_at) VALUES (?, ?) "
        "ON CONFLICT(ip) DO UPDATE SET last_post_at = excluded.last_post_at"
    ).bind(ip, now_ts).run()
    await db.prepare(
        "INSERT INTO register_daily_limits (ip, date, count) VALUES (?, ?, 1) "
        "ON CONFLICT(ip) DO UPDATE SET count = CASE WHEN register_daily_limits.date = excluded.date "
        "THEN register_daily_limits.count + 1 ELSE 1 END, date = excluded.date"
    ).bind(ip, today).run()
    await db.prepare(
        "INSERT INTO users (username, password_hash, role, display_name, created_at) VALUES (?, ?, 'user', ?, ?)"
    ).bind(username, _hash_password(body.password), display_name, _now_iso()).run()
    return {"token": _make_token(username, "user", request.scope["env"]), "username": username, "role": "user", "display_name": display_name}


@app.put("/api/me")
async def update_me(body: RegisterIn, request: Request):
    username, user_role = _require_auth(request)
    if user_role == "admin":
        raise HTTPException(status_code=400, detail="管理员名称不可修改")
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="请填写显示名称")
    db = _db(request)
    res = await db.prepare("UPDATE users SET display_name = ? WHERE username = ?").bind(display_name, username).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True, "display_name": display_name}


@app.put("/api/me/password")
async def change_password(body: PasswordIn, request: Request):
    username, user_role = _require_auth(request)
    if user_role == "admin":
        raise HTTPException(status_code=400, detail="管理员密码请通过 Cloudflare 配置修改")
    db = _db(request)
    row = await db.prepare("SELECT password_hash FROM users WHERE username = ?").bind(username).first()
    if not row or not _verify_password(body.old_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="旧密码错误")
    await db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").bind(_hash_password(body.new_password), username).run()
    await _log_audit(db, _actor(request), "reset_password", "user", None, username)
    return {"ok": True}


# ---------- 文章 ----------

@app.get("/api/articles")
async def list_articles(request: Request):
    db = _db(request)
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    is_admin = bool(parsed and parsed[1] == "admin")
    show_all = request.query_params.get("all") == "1" and is_admin
    if show_all:
        res = await db.prepare(
            "SELECT slug, title, tags, status, pinned, views, created_at, updated_at FROM articles ORDER BY pinned DESC, created_at DESC"
        ).all()
    else:
        res = await db.prepare(
            "SELECT slug, title, tags, status, pinned, views, created_at, updated_at FROM articles WHERE status = 'published' ORDER BY pinned DESC, created_at DESC"
        ).all()
    return {"articles": res.results}


@app.get("/api/articles/{slug}")
async def get_article(slug: str, request: Request):
    db = _db(request)
    row = await db.prepare(
        "SELECT slug, title, content_md, tags, status, pinned, views, created_at, updated_at FROM articles WHERE slug = ?"
    ).bind(slug).first()
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在")
    if row["status"] == "draft":
        parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
        if not parsed or parsed[1] != "admin":
            raise HTTPException(status_code=404, detail="文章不存在")
    await db.prepare("UPDATE articles SET views = views + 1 WHERE slug = ?").bind(slug).run()
    row["views"] = int(row.get("views") or 0) + 1
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
    tags = body.tags.strip()
    status = body.status
    pinned = body.pinned
    db = _db(request)
    await db.prepare(
        "INSERT INTO articles (slug, title, content_md, tags, status, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(slug, body.title.strip(), body.content_md, tags, status, pinned, now, now).run()
    await _log_audit(db, _actor(request), "create_article", "article", None, slug)
    return {"ok": True, "slug": slug}


@app.put("/api/articles/{slug}")
async def update_article(slug: str, body: ArticleIn, request: Request):
    _check_admin(request)
    db = _db(request)
    res = await db.prepare(
        "UPDATE articles SET title = ?, content_md = ?, tags = ?, status = ?, pinned = ?, updated_at = ? WHERE slug = ?"
    ).bind(body.title.strip(), body.content_md, body.tags.strip(), body.status, body.pinned, _now_iso(), slug).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="文章不存在")
    await _log_audit(db, _actor(request), "update_article", "article", None, slug)
    return {"ok": True, "slug": slug}


@app.delete("/api/articles/{slug}")
async def delete_article(slug: str, request: Request):
    _check_admin(request)
    db = _db(request)
    res = await db.prepare("DELETE FROM articles WHERE slug = ?").bind(slug).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="文章不存在")
    await _log_audit(db, _actor(request), "delete_article", "article", None, slug)
    return {"ok": True}


# ---------- 留言板 ----------

@app.get("/api/messages")
async def list_messages(request: Request):
    db = _db(request)
    res = await db.prepare(
        "SELECT id, nickname, content, created_at, user_id FROM messages ORDER BY id DESC LIMIT ?"
    ).bind(MAX_MESSAGES).all()
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    can_mod = False
    my_id = None
    if parsed:
        uname, role = parsed
        if role in ("admin", "moderator"):
            can_mod = True
        else:
            urow = await db.prepare("SELECT id FROM users WHERE username = ?").bind(uname).first()
            my_id = urow["id"] if urow else None
    out = []
    for m in res.results:
        m["is_mine"] = bool(can_mod or (my_id is not None and m.get("user_id") == my_id))
        out.append(m)
    return {"messages": out}


@app.post("/api/messages")
async def create_message(body: MessageIn, request: Request):
    db = _db(request)
    ip = _client_ip(request)
    now_ts = int(time.time())
    auth_header = request.headers.get("authorization", "")
    parsed = _parse_token(auth_header, request.scope["env"])
    if auth_header.strip() and not parsed:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    is_privileged = False
    user_id = None
    nickname = None
    if parsed:
        username, role = parsed
        if role in ("admin", "moderator"):
            is_privileged = True
        if role == "admin":
            nickname = "骆戡"
        else:
            urow = await db.prepare("SELECT id, display_name, banned FROM users WHERE username = ?").bind(username).first()
            if urow and urow["banned"]:
                raise HTTPException(status_code=403, detail="账号已被封禁")
            if urow:
                user_id = urow["id"]
                nickname = urow["display_name"] or username
    if nickname is None:
        nickname = (body.nickname or "").strip()
        if not nickname:
            raise HTTPException(status_code=400, detail="请填写昵称")

    # 限频：同一 IP 60 秒内只能发一条（管理员/协管不限）
    if not is_privileged:
        row = await db.prepare("SELECT last_post_at FROM rate_limits WHERE ip = ?").bind(ip).first()
        if row and (now_ts - int(row["last_post_at"])) < RATE_LIMIT_SECONDS:
            raise HTTPException(status_code=429, detail="留言太频繁，请 60 秒后再试")
        await db.prepare(
            "INSERT INTO rate_limits (ip, last_post_at) VALUES (?, ?) "
            "ON CONFLICT(ip) DO UPDATE SET last_post_at = excluded.last_post_at"
        ).bind(ip, now_ts).run()

    await db.prepare(
        "INSERT INTO messages (nickname, content, created_at, user_id) VALUES (?, ?, ?, ?)"
    ).bind(nickname, body.content.strip(), _now_iso(), user_id).run()
    return {"ok": True}


@app.delete("/api/messages/{message_id}")
async def delete_message(message_id: int, request: Request):
    db = _db(request)
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    if not parsed:
        raise HTTPException(status_code=401, detail="请先登录")
    username, role = parsed
    row = await db.prepare("SELECT id, user_id FROM messages WHERE id = ?").bind(message_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="留言不存在")
    if role not in ("admin", "moderator"):
        urow = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
        if not urow or row["user_id"] is None or urow["id"] != row["user_id"]:
            raise HTTPException(status_code=403, detail="只能删除自己的留言")
    await db.prepare("DELETE FROM messages WHERE id = ?").bind(message_id).run()
    await _log_audit(db, _actor(request), "delete_message", "message", message_id)
    return {"ok": True}



# ---------- 文章评论 ----------

@app.get("/api/articles/{slug}/comments")
async def list_comments(slug: str, request: Request):
    db = _db(request)
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    per = 20
    res = await db.prepare(
        "SELECT id, nickname, content, created_at, user_id, parent_id, is_bot, likes FROM comments "
        "WHERE article_slug = ? ORDER BY id ASC LIMIT 500"
    ).bind(slug).all()
    # 按顶层评论分页，每页附带完整回复树
    tops = [c for c in res.results if not c.get("parent_id")]
    total = len(tops)
    total_pages = max(1, (total + per - 1) // per)
    page = min(page, total_pages)

    def descendants(cid):
        out = []
        for c in res.results:
            if c.get("parent_id") == cid:
                out.append(c)
                out.extend(descendants(c["id"]))
        return out

    selected = []
    for t in tops[(page - 1) * per: page * per]:
        selected.append(t)
        selected.extend(descendants(t["id"]))
    selected.sort(key=lambda c: c["id"])

    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    can_mod = False
    my_id = None
    if parsed:
        uname, role = parsed
        if role in ("admin", "moderator"):
            can_mod = True
            my_id = -1 if role == "admin" else my_id
        else:
            urow = await db.prepare("SELECT id FROM users WHERE username = ?").bind(uname).first()
            my_id = urow["id"] if urow else None
    liked_ids = set()
    if my_id is not None:
        ids = [c["id"] for c in selected]
        if ids:
            ph = ",".join("?" * len(ids))
            lres = await db.prepare(
                "SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (%s)" % ph
            ).bind(my_id, *ids).all()
            liked_ids = {int(r["comment_id"]) for r in lres.results}
    out = []
    for c in selected:
        c["is_mine"] = bool(can_mod or (my_id is not None and c.get("user_id") == my_id))
        c["liked"] = int(c["id"]) in liked_ids
        c["likes"] = int(c.get("likes") or 0)
        out.append(c)
    return {"comments": out, "total": total, "page": page, "total_pages": total_pages, "per": per}


@app.post("/api/articles/{slug}/comments")
async def create_comment(slug: str, body: MessageIn, request: Request):
    username, user_role = _require_auth(request)
    db = _db(request)
    article = await db.prepare("SELECT id, title, content_md FROM articles WHERE slug = ?").bind(slug).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    if user_role == "admin":
        nickname = "骆戡"
        user_id = None
        is_privileged = True
    else:
        urow = await db.prepare("SELECT id, display_name, banned FROM users WHERE username = ?").bind(username).first()
        if not urow:
            raise HTTPException(status_code=401, detail="账号不存在，请重新登录")
        if urow["banned"]:
            raise HTTPException(status_code=403, detail="账号已被封禁")
        user_id = urow["id"]
        nickname = urow["display_name"] or username
        is_privileged = user_role == "moderator"

    parent_id = body.parent_id or 0
    if parent_id:
        p = await db.prepare("SELECT id FROM comments WHERE id = ? AND article_slug = ?").bind(parent_id, slug).first()
        if not p:
            raise HTTPException(status_code=400, detail="回复的评论不存在")

    ip = _client_ip(request)
    now_ts = int(time.time())
    if not is_privileged:
        row = await db.prepare("SELECT last_post_at FROM comment_rate_limits WHERE ip = ?").bind(ip).first()
        if row and (now_ts - int(row["last_post_at"])) < RATE_LIMIT_SECONDS:
            raise HTTPException(status_code=429, detail="评论太频繁，请 60 秒后再试")
        await db.prepare(
            "INSERT INTO comment_rate_limits (ip, last_post_at) VALUES (?, ?) "
            "ON CONFLICT(ip) DO UPDATE SET last_post_at = excluded.last_post_at"
        ).bind(ip, now_ts).run()

    content = body.content.strip()
    mention = content[:20].lower()
    is_mention = mention.startswith("@bot") or mention.startswith("@机器人") or mention.startswith("@小戡")
    parent_is_bot = False
    if parent_id:
        pp = await db.prepare("SELECT is_bot FROM comments WHERE id = ?").bind(parent_id).first()
        parent_is_bot = bool(pp and pp["is_bot"])
    if is_mention or parent_is_bot:
        env = request.scope["env"]
        # 收集回复链上下文（顶层到当前）
        chain = []
        cur_parent = parent_id
        parents = []
        while cur_parent:
            prow = await db.prepare(
                "SELECT id, parent_id, content, is_bot FROM comments WHERE id = ? AND article_slug = ?"
            ).bind(cur_parent, slug).first()
            if not prow:
                break
            parents.append(prow)
            cur_parent = prow["parent_id"]
        for prow in reversed(parents):
            ctext = str(prow["content"])[:300]
            if ctext.strip():
                chain.append({"role": "assistant" if prow["is_bot"] else "user", "content": ctext})
        chain.append({"role": "user", "content": content[:500]})
        base = (
            "你是「小戡的博客」的 AI 机器人，由博主小戡（骆戡）部署。"
            "回答用简体中文，简洁、友好、带点幽默，别嗠嗦，尽量控制在 200 字以内。"
            "博主是小戡（骆戡），本站是 Vibe Coding 产物。"
        )
        prompt = base + (
            "用户在文章评论区说话，下面是当前文章和这段对话的上下文（用户与机器人）。"
            "当前文章《%s》：\n%s\n请结合上下文回答用户最后一条消息；如果用户要求分析文章，就基于文章内容分析。"
        ) % (article["title"], str(article["content_md"])[:2000])
        reply = await _call_bot(env, prompt, chain[-10:])
        r1 = await db.prepare(
            "INSERT INTO comments (article_slug, nickname, content, created_at, user_id, parent_id, is_bot) VALUES (?, ?, ?, ?, ?, ?, 0)"
        ).bind(slug, nickname, content, _now_iso(), user_id, parent_id).run()
        user_cmt_id = int(r1.meta.last_row_id) if r1 and r1.meta and r1.meta.last_row_id else None
        if user_cmt_id:
            await db.prepare(
                "INSERT INTO comments (article_slug, nickname, content, created_at, user_id, parent_id, is_bot) VALUES (?, ?, ?, ?, NULL, ?, 1)"
            ).bind(slug, "🤖 小戡的机器人", reply, _now_iso(), user_cmt_id).run()
        else:
            await db.prepare(
                "INSERT INTO comments (article_slug, nickname, content, created_at, user_id, parent_id, is_bot) VALUES (?, ?, ?, ?, NULL, ?, 1)"
            ).bind(slug, "🤖 小戡的机器人", reply, _now_iso(), parent_id).run()
        return {"ok": True, "bot_reply": reply}


    await db.prepare(
        "INSERT INTO comments (article_slug, nickname, content, created_at, user_id, parent_id, is_bot) VALUES (?, ?, ?, ?, ?, ?, 0)"
    ).bind(slug, nickname, content, _now_iso(), user_id, parent_id).run()
    return {"ok": True}


@app.get("/api/comments")
async def list_all_comments(request: Request):
    _check_moderator(request)
    res = await _db(request).prepare(
        "SELECT c.id, c.article_slug, c.nickname, c.content, c.created_at, c.user_id, c.parent_id, c.is_bot, a.title AS article_title "
        "FROM comments c LEFT JOIN articles a ON a.slug = c.article_slug "
        "ORDER BY c.id DESC LIMIT 500"
    ).all()
    return {"comments": res.results}


@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: int, request: Request):
    db = _db(request)
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    if not parsed:
        raise HTTPException(status_code=401, detail="请先登录")
    username, role = parsed
    row = await db.prepare("SELECT id, user_id FROM comments WHERE id = ?").bind(comment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="评论不存在")
    if role not in ("admin", "moderator"):
        urow = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
        if not urow or row["user_id"] is None or urow["id"] != row["user_id"]:
            raise HTTPException(status_code=403, detail="只能删除自己的评论")
    await db.prepare(
        "WITH RECURSIVE sub AS ("
        "SELECT id FROM comments WHERE id = ? OR parent_id = ? "
        "UNION "
        "SELECT c.id FROM comments c JOIN sub s ON c.parent_id = s.id"
        ") DELETE FROM comments WHERE id IN (SELECT id FROM sub)"
    ).bind(comment_id, comment_id).run()
    await _log_audit(db, _actor(request), "delete_comment", "comment", comment_id)
    return {"ok": True}

@app.post("/api/comments/{comment_id}/like")
async def toggle_like(comment_id: int, request: Request):
    username, user_role = _require_auth(request)
    db = _db(request)
    row = await db.prepare("SELECT id FROM comments WHERE id = ?").bind(comment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="评论不存在")
    if user_role == "admin":
        key_uid = -1
    else:
        urow = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
        if not urow:
            raise HTTPException(status_code=401, detail="账号不存在")
        key_uid = urow["id"]
    liked = await db.prepare("SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?").bind(key_uid, comment_id).first()
    if liked:
        await db.prepare("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?").bind(key_uid, comment_id).run()
        await db.prepare("UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?").bind(comment_id).run()
        new_liked = False
    else:
        await db.prepare("INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES (?, ?, ?)").bind(key_uid, comment_id, _now_iso()).run()
        await db.prepare("UPDATE comments SET likes = likes + 1 WHERE id = ?").bind(comment_id).run()
        new_liked = True
    nrow = await db.prepare("SELECT likes FROM comments WHERE id = ?").bind(comment_id).first()
    return {"ok": True, "liked": new_liked, "likes": int(nrow["likes"]) if nrow else 0}


@app.get("/api/archive")
async def archive(request: Request):
    res = await _db(request).prepare(
        "SELECT slug, title, created_at FROM articles WHERE status = 'published' ORDER BY created_at DESC"
    ).all()
    groups = {}
    for a in res.results:
        ym = (a["created_at"] or "")[:7]
        groups.setdefault(ym, []).append(a)
    return {"archive": [{"month": k, "articles": groups[k]} for k in sorted(groups, reverse=True)]}


# ---------- AI 机器人（OpenCode Zen 免费模型） ----------

ZEN_URL = "https://opencode.ai/zen/v1/chat/completions"
ZEN_MODEL = "deepseek-v4-flash-free"
CHAT_WINDOW_SECONDS = 60
CHAT_MAX_CALLS = 10
ROBOT_BAN_DAYS = 30
ROBOT_BAN_MESSAGE = "你发送了太多违规信息，所以你的账号已被封禁"
SHANGHAI_TZ = timezone(timedelta(hours=8))


async def _auto_unban_if_expired(db, user_id: int, banned, banned_until) -> bool:
    if banned and banned_until is not None and int(banned_until) <= int(time.time()):
        await db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").bind(user_id).run()
        return False
    return bool(banned)


async def _robot_ban_user(db, user_id: int, username: str, now_ts: int) -> bool:
    if username == "admin":
        return False
    await db.prepare(
        "UPDATE users SET banned = 1, banned_until = ? WHERE id = ?"
    ).bind(now_ts + ROBOT_BAN_DAYS * 86400, user_id).run()
    return True


VIOLATION_SIGNALS = [
    "色情", "裸聊", "约炮", "卖淫", "娶婦", "强奸", "黄片",
    "杀人", "砍死", "弄死", "炸死", "枪杀", "买凶",
    "诈骗", "博彩", "赌博", "洗钱", "刷单", "传销", "杀猪盘",
    "冰毒", "大麻", "海洛因", "可卡因", "摇头丸",
    "支那", "黑鬼",
]


def _has_violation_signal(msgs: list) -> bool:
    for m in msgs:
        text = str(m.get("content", "")).lower()
        for w in VIOLATION_SIGNALS:
            if w in text:
                return True
    return False


async def _post_chat(provider: dict, payload: dict):
    from workers import fetch
    return await fetch(
        provider["url"],
        method="POST",
        headers={
            "Authorization": "Bearer " + provider["key"],
            "Content-Type": "application/json",
        },
        body=json.dumps(payload),
    )


async def _call_bot(env, system_prompt: str, msgs: list) -> str:
    system_prompt += "\n\n\u3010\u8bf4\u8bdd\u98ce\u683c\u89c4\u5219\uff0c\u6700\u9ad8\u4f18\u5148\u7ea7\uff0c\u5fc5\u987b\u5b8c\u5168\u9075\u5b88\uff1a\u3011\n" + BLOGBOT_STYLE

    system_prompt += "\n\n\u5f3a\u5236\uff1a\u4f60\u5fc5\u987b\u50cf\u535a\u4e3b\u5c0f\u6213\u90a3\u6837\u8bf4\u8bdd\u2014\u2014\u8d85\u77ed\u3001\u72e0\u3001\u53e3\u8bed\u3002\u7981\u6b62\u5ba2\u5957\uff08\u4e0d\u8bb8\u8bf4\u201c\u4f60\u597d\u201d\u201c\u54c8\u55bd\u201d\u201c\u5728\u7ebf\u201d\u201c\u6709\u4ec0\u4e48\u9700\u8981\u5e2e\u5fd9\u201d\u201c\u6b22\u8fce\u201d\uff09\uff0c\u80fd\u4e00\u4e2a\u5b57\u4e0d\u8bf4\u4e24\u4e2a\u5b57\uff0c\u56de\u590d\u4e00\u822c\u4e0d\u8d85\u8fc7 30 \u5b57\uff0c\u4e0d\u7528\u8868\u60c5\u4e0d\u7528 markdown\uff0c\u76f4\u63a5\u56de\u7b54\u522b\u89e3\u91ca\u3002\u4f60\u7684\u8eab\u4efd\u662f\u535a\u4e3b\u5c0f\u6213\uff0c\u4e0d\u662f\u5ba2\u670d\u3002"

    providers = []
    zen_key = getattr(env, "OPENCODE_ZEN_API_KEY", "")
    if zen_key:
        providers.append({"name": "OpenCode Zen", "url": "https://opencode.ai/zen/v1/chat/completions", "model": "deepseek-v4-flash-free", "key": zen_key})
    agnes_key = getattr(env, "AGNES_API_KEY", "")
    if agnes_key:
        providers.append({"name": "Agnes", "url": "https://apihub.agnes-ai.com/v1/chat/completions", "model": "agnes-2.5-flash", "key": agnes_key})
    mimo_key = getattr(env, "MIMO_API_KEY", "")
    if mimo_key:
        providers.append({"name": "小米MiMo", "url": "https://api.xiaomimimo.com/v1/chat/completions", "model": "mimo-v2.5-pro", "key": mimo_key})
    if not providers:
        raise HTTPException(status_code=503, detail="机器人还没配置好，稍后再来")
    errors = []
    for p in providers:
        payload = {
            "model": p["model"],
            "messages": [{"role": "system", "content": system_prompt}] + msgs,
            "max_tokens": 800,
            "temperature": 0.7,
        }
        try:
            resp = await _post_chat(p, payload)
        except Exception:
            errors.append(p["name"] + "：连接失败")
            continue
        if resp.status != 200:
            text = await resp.text()
            errors.append(p["name"] + "：" + text[:80])
            continue
        data = json.loads(await resp.text())
        choices = data.get("choices") or []
        if not choices:
            errors.append(p["name"] + "：没回复")
            continue
        msg = choices[0].get("message") or {}
        reply = (msg.get("content") or msg.get("reasoning_content") or "").strip()
        if reply:
            return reply
        errors.append(p["name"] + "：空回复")
    raise HTTPException(status_code=502, detail="机器人全线开小差了：" + "；".join(errors) + "，等会儿再试")


async def _get_setting(db, key: str, default: str) -> str:
    row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first()
    return row["value"] if row else default


def _today_str() -> str:
    return datetime.now(SHANGHAI_TZ).strftime("%Y-%m-%d")


def _actor(request: Request) -> str:
    parsed = _parse_token(request.headers.get("authorization", ""), request.scope["env"])
    return parsed[0] if parsed else "?"


async def _log_audit(db, actor: str, action: str, target_type: str = None, target_id=None, detail: str = "") -> None:
    await db.prepare(
        "INSERT INTO audit_log (actor, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(actor, action, target_type, target_id, str(detail)[:200], _now_iso()).run()

@app.post("/api/chat")
async def chat(body: ChatIn, request: Request):
    env = request.scope["env"]
    username, user_role = _require_auth(request)
    now_ts = int(time.time())
    db = _db(request)

    # 管理员/协管无限使用；普通用户按账号限流（60 秒最多 10 次 + 每日上限）
    if user_role not in ("admin", "moderator"):
        user = await db.prepare("SELECT id, banned, banned_until FROM users WHERE username = ?").bind(username).first()
        if not user:
            raise HTTPException(status_code=401, detail="账号不存在，请重新登录")
        user_id = user["id"]
        if await _auto_unban_if_expired(db, user_id, user["banned"], user["banned_until"]):
            raise HTTPException(status_code=403, detail="账号已被封禁")

        row = await db.prepare("SELECT window_start, count FROM user_chat_rate_limits WHERE user_id = ?").bind(user_id).first()
        if row and (now_ts - int(row["window_start"])) < CHAT_WINDOW_SECONDS:
            if int(row["count"]) >= CHAT_MAX_CALLS:
                raise HTTPException(status_code=429, detail="机器人累了，请 60 秒后再聊")
            await db.prepare("UPDATE user_chat_rate_limits SET count = count + 1 WHERE user_id = ?").bind(user_id).run()
        else:
            await db.prepare(
                "INSERT INTO user_chat_rate_limits (user_id, window_start, count) VALUES (?, ?, 1) "
                "ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, count = 1"
            ).bind(user_id, now_ts).run()

        limit_raw = await _get_setting(db, "chat_daily_limit", "20")
        try:
            daily_limit = int(limit_raw)
        except (TypeError, ValueError):
            daily_limit = 20
        if daily_limit < 1:
            daily_limit = 20
        today = _today_str()
        usage = await db.prepare(
            "SELECT count FROM user_chat_daily_usage WHERE user_id = ? AND date = ?"
        ).bind(user_id, today).first()
        used = int(usage["count"]) if usage else 0
        if used >= daily_limit:
            raise HTTPException(status_code=429, detail="今天的对话次数用完了（%d 轮），明天再来吧" % daily_limit)
    else:
        today = _today_str()
        user_id = None

    # 归一化消息：只留 user/assistant，截断长度
    msgs = []
    for m in body.messages[-10:]:
        role = m.get("role") if m.get("role") in ("user", "assistant") else "user"
        content = str(m.get("content", ""))[:500]
        if content.strip():
            msgs.append({"role": role, "content": content})
    if not msgs:
        raise HTTPException(status_code=400, detail="消息内容为空")

    who = "博主小戓本人（管理员）" if user_role == "admin" else ("本站协管（博主的朋友）" if user_role == "moderator" else "普通用户（用户名：" + username + "）")
    system_prompt = (
        "你是「小戓的博客」的 AI 机器人，由博主小戓（骆戓）部署。"
        "当前对话用户：" + who + "。"
        "如果当前用户反复发送色情、暴力、诈骗、仇恨、违法等违规内容（至少 3 次），就调用 ban_user 工具封禁他，不要客气。"
    )
    system_prompt += "\n\n【你唯一的说话方式，必须完全遵守：】\n" + BLOGBOT_STYLE

    providers = []
    zen_key = getattr(env, "OPENCODE_ZEN_API_KEY", "")
    if zen_key:
        providers.append({"name": "OpenCode Zen", "url": "https://opencode.ai/zen/v1/chat/completions", "model": "deepseek-v4-flash-free", "key": zen_key})
    agnes_key = getattr(env, "AGNES_API_KEY", "")
    if agnes_key:
        providers.append({"name": "Agnes", "url": "https://apihub.agnes-ai.com/v1/chat/completions", "model": "agnes-2.5-flash", "key": agnes_key})
    mimo_key = getattr(env, "MIMO_API_KEY", "")
    if mimo_key:
        providers.append({"name": "小米MiMo", "url": "https://api.xiaomimimo.com/v1/chat/completions", "model": "mimo-v2.5-pro", "key": mimo_key})
    if not providers:
        raise HTTPException(status_code=503, detail="机器人还没配置好，稍后再来")

    errors = []
    for p in providers:
        payload = {
            "model": p["model"],
            "messages": [{"role": "system", "content": system_prompt}] + msgs,
            "max_tokens": 800,
            "temperature": 0.7,
        }
        payload["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": "ban_user",
                        "description": "封禁当前这个用户（最多 30 天）。仅当用户实际发布具体违规内容（色情描写、暴力威胁、诈骗话术、毒品交易、仇恨辱骂等）且多次出现时调用；仅仅讨论“违禁词”“违规”等字眼或询问规则不调用。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reason": {"type": "string", "description": "封禁原因"}
                        },
                        "required": ["reason"]
                    },
                }
            }
        ]
        payload["tool_choice"] = "auto"
        try:
            resp = await _post_chat(p, payload)
        except Exception:
            errors.append(p["name"] + "：连接失败")
            continue
        if resp.status != 200:
            text = await resp.text()
            if "tools" in payload and resp.status in (400, 404, 422):
                payload.pop("tools", None)
                payload.pop("tool_choice", None)
                try:
                    resp = await _post_chat(p, payload)
                except Exception:
                    errors.append(p["name"] + "：连接失败")
                    continue
                if resp.status != 200:
                    text = await resp.text()
                    errors.append(p["name"] + "：" + text[:80])
                    continue
            else:
                errors.append(p["name"] + "：" + text[:80])
                continue
        data = json.loads(await resp.text())
        choices = data.get("choices") or []
        if not choices:
            errors.append(p["name"] + "：没回复")
            continue
        msg = choices[0].get("message") or {}
        tool_calls = msg.get("tool_calls") or []
        called_ban = any((tc.get("function") or {}).get("name") == "ban_user" for tc in tool_calls)
        if called_ban:
            if user_role in ("admin", "moderator"):
                return {"reply": "我是站长，你可封不了我（已拦截）"}
            if _has_violation_signal(msgs):
                await _robot_ban_user(db, user_id, username, now_ts)
                return {"reply": ROBOT_BAN_MESSAGE}
            errors.append(p["name"] + "：误判封禁，已拦截")
            continue
        reply = (msg.get("content") or msg.get("reasoning_content") or "").strip()
        if not reply:
            errors.append(p["name"] + "：空回复")
            continue
        if user_role not in ("admin", "moderator"):
            await db.prepare(
                "INSERT INTO user_chat_daily_usage (user_id, date, count) VALUES (?, ?, 1) "
                "ON CONFLICT(user_id) DO UPDATE SET count = CASE WHEN user_chat_daily_usage.date = excluded.date "
                "THEN user_chat_daily_usage.count + 1 ELSE 1 END, date = excluded.date"
            ).bind(user_id, today).run()
        return {"reply": reply}

    raise HTTPException(status_code=502, detail="机器人全线开小差了：" + "；".join(errors) + "，等会儿再试")


# ---------- 站点设置（admin） ----------

@app.get("/api/settings")
async def get_settings(request: Request):
    _check_admin(request)
    db = _db(request)
    raw = await _get_setting(db, "chat_daily_limit", "20")
    try:
        chat = int(raw)
    except (TypeError, ValueError):
        chat = 20
    raw2 = await _get_setting(db, "register_daily_limit", "3")
    try:
        reg = int(raw2)
    except (TypeError, ValueError):
        reg = 3
    return {"chat_daily_limit": chat, "register_daily_limit": reg}


@app.put("/api/settings")
async def put_settings(body: SettingsIn, request: Request):
    _check_admin(request)
    db = _db(request)
    await db.prepare(
        "INSERT INTO settings (key, value) VALUES ('chat_daily_limit', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(str(body.chat_daily_limit)).run()
    if body.register_daily_limit is not None:
        await db.prepare(
            "INSERT INTO settings (key, value) VALUES ('register_daily_limit', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        ).bind(str(body.register_daily_limit)).run()
    return {"ok": True, "chat_daily_limit": body.chat_daily_limit, "register_daily_limit": body.register_daily_limit}


# ---------- 用户管理（admin） ----------

@app.get("/api/users")
async def list_users(request: Request):
    _check_admin(request)
    res = await _db(request).prepare(
        "SELECT id, username, role, banned, created_at FROM users ORDER BY id ASC"
    ).all()
    return {"users": res.results}


@app.put("/api/users/{username}")
async def ban_user(username: str, body: UserBanIn, request: Request):
    _check_admin(request)
    if username == "admin":
        raise HTTPException(status_code=400, detail="不能操作管理员账号")
    db = _db(request)
    row = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.prepare("UPDATE users SET banned = ?, banned_until = NULL WHERE username = ?").bind(1 if body.banned else 0, username).run()
    await _log_audit(db, _actor(request), "ban" if body.banned else "unban", "user", None, username)
    return {"ok": True, "username": username, "banned": body.banned}


@app.put("/api/users/{username}/role")
async def set_user_role(username: str, body: UserRoleIn, request: Request):
    _check_admin(request)
    if username == "admin":
        raise HTTPException(status_code=400, detail="不能修改内置管理员账号")
    db = _db(request)
    row = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.prepare("UPDATE users SET role = ? WHERE username = ?").bind(body.role, username).run()
    await _log_audit(db, _actor(request), "set_role", "user", None, "%s -> %s" % (username, body.role))
    return {"ok": True, "username": username, "role": body.role}


@app.put("/api/users/{username}/password")
async def reset_user_password(username: str, body: ResetPasswordIn, request: Request):
    _check_admin(request)
    if username == "admin":
        raise HTTPException(status_code=400, detail="不能重置内置管理员密码")
    db = _db(request)
    res = await db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").bind(_hash_password(body.new_password), username).run()
    if not res.meta.changes:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True}


@app.delete("/api/users/{username}")
async def delete_user(username: str, request: Request):
    _check_admin(request)
    if username == "admin":
        raise HTTPException(status_code=400, detail="不能删除管理员账号")
    db = _db(request)
    row = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    uid = row["id"]
    await db.prepare("DELETE FROM users WHERE id = ?").bind(uid).run()
    await db.prepare("DELETE FROM user_chat_rate_limits WHERE user_id = ?").bind(uid).run()
    await db.prepare("DELETE FROM user_chat_daily_usage WHERE user_id = ?").bind(uid).run()
    await _log_audit(db, _actor(request), "delete_user", "user", None, username)
    return {"ok": True, "username": username}
# ---------- 举报（bot 自动审核） ----------

@app.post("/api/reports")
async def create_report(body: ReportIn, request: Request):
    username, user_role = _require_auth(request)
    db = _db(request)
    if body.target_type == "comment":
        target = await db.prepare("SELECT id, nickname, content, user_id FROM comments WHERE id = ?").bind(body.target_id).first()
    else:
        target = await db.prepare("SELECT id, nickname, content, user_id FROM messages WHERE id = ?").bind(body.target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="举报的目标不存在")

    dup = await db.prepare(
        "SELECT id FROM reports WHERE target_type = ? AND target_id = ? AND reporter = ?"
    ).bind(body.target_type, body.target_id, username).first()
    if dup:
        raise HTTPException(status_code=409, detail="你已经举报过这条内容")

    recent = await db.prepare(
        "SELECT created_at FROM reports WHERE reporter = ? ORDER BY id DESC LIMIT 1"
    ).bind(username).first()
    if recent:
        try:
            from datetime import datetime as _dt
            t = _dt.strptime(recent["created_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
            if int(time.time()) - int(t) < 60:
                raise HTTPException(status_code=429, detail="举报太频繁，请 60 秒后再试")
        except HTTPException:
            raise
        except Exception:
            pass

    r = await db.prepare(
        "INSERT INTO reports (target_type, target_id, reason, reporter, status, content, created_at) VALUES (?, ?, ?, ?, 'open', ?, ?)"
    ).bind(body.target_type, body.target_id, body.reason.strip(), username, target["content"][:500], _now_iso()).run()
    report_id = int(r.meta.last_row_id) if r and r.meta and r.meta.last_row_id else None

    # bot 审核
    env = request.scope["env"]
    label = "评论" if body.target_type == "comment" else "留言"
    judge_prompt = (
        "你是本站内容审核员。判断下面这条" + label +
        "是否属于违规内容（色情、暴力、诈骗、仇恨、违法等）。只回复“违规”或“不违规”。"
    )
    try:
        verdict = await _call_bot(env, judge_prompt, [{"role": "user", "content": target["content"]}])
    except Exception:
        verdict = ""
    violated = ("违规" in verdict) and ("不违规" not in verdict)
    action = "ignored"
    now_ts = int(time.time())
    if violated:
        if body.target_type == "comment":
            await db.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").bind(body.target_id, body.target_id).run()
        else:
            await db.prepare("DELETE FROM messages WHERE id = ?").bind(body.target_id).run()
        action = "deleted"
        if target.get("user_id"):
            author = await db.prepare("SELECT username, role FROM users WHERE id = ?").bind(target["user_id"]).first()
            if author and author["role"] == "user":
                await db.prepare(
                    "UPDATE users SET banned = 1, banned_until = ? WHERE id = ?"
                ).bind(now_ts + ROBOT_BAN_DAYS * 86400, target["user_id"]).run()
                action = "deleted_banned"
    if report_id:
        await db.prepare("UPDATE reports SET status = 'handled' WHERE id = ?").bind(report_id).run()
    return {"ok": True, "action": action, "verdict": verdict[:100]}


@app.get("/api/reports")
async def list_reports(request: Request):
    _check_moderator(request)
    res = await _db(request).prepare(
        "SELECT id, target_type, target_id, reason, reporter, status, content, created_at FROM reports ORDER BY id DESC LIMIT 100"
    ).all()
    return {"reports": res.results}


# ---------- 概览 / 导出 / 举报处理 / 审计 / 公告 ----------

@app.get("/api/stats")
async def stats(request: Request):
    _check_admin(request)
    db = _db(request)

    async def one(sql, *args):
        row = await db.prepare(sql).bind(*args).first()
        return int(row["n"]) if row else 0

    today = _today_str()
    articles = await one("SELECT COUNT(*) n FROM articles")
    drafts = await one("SELECT COUNT(*) n FROM articles WHERE status = 'draft'")
    messages = await one("SELECT COUNT(*) n FROM messages")
    comments = await one("SELECT COUNT(*) n FROM comments")
    users = await one("SELECT COUNT(*) n FROM users")
    reg_today = await one("SELECT COUNT(*) n FROM users WHERE substr(created_at,1,10) = ?", today)
    msg_today = await one("SELECT COUNT(*) n FROM messages WHERE substr(created_at,1,10) = ?", today)
    cmt_today = await one("SELECT COUNT(*) n FROM comments WHERE substr(created_at,1,10) = ?", today)
    reports_open = await one("SELECT COUNT(*) n FROM reports WHERE status = 'open'")
    bot_today = await one("SELECT COALESCE(SUM(count),0) n FROM user_chat_daily_usage WHERE date = ?", today)
    return {
        "articles": articles, "drafts": drafts,
        "messages": messages, "comments": comments,
        "users": users, "reg_today": reg_today,
        "msg_today": msg_today, "cmt_today": cmt_today,
        "reports_open": reports_open, "bot_today": bot_today,
    }


@app.get("/api/export/{etype}")
async def export_data(etype: str, request: Request):
    _check_admin(request)
    db = _db(request)
    if etype == "articles":
        res = await db.prepare("SELECT slug, title, content_md, tags, status, views, created_at, updated_at FROM articles ORDER BY id").all()
    elif etype == "messages":
        res = await db.prepare("SELECT id, nickname, content, created_at, user_id FROM messages ORDER BY id").all()
    elif etype == "comments":
        res = await db.prepare("SELECT id, article_slug, nickname, content, created_at, user_id, parent_id, is_bot FROM comments ORDER BY id").all()
    else:
        raise HTTPException(status_code=400, detail="未知类型")
    payload = json.dumps({"type": etype, "exported_at": _now_iso(), "data": res.results}, ensure_ascii=False)
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="%s.json"' % etype},
    )


@app.post("/api/reports/{report_id}/resolve")
async def resolve_report(report_id: int, body: ReportResolveIn, request: Request):
    _check_moderator(request)
    db = _db(request)
    row = await db.prepare("SELECT id, target_type, target_id, status FROM reports WHERE id = ?").bind(report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="举报不存在")
    if body.action == "ignore":
        await db.prepare("UPDATE reports SET status = 'handled' WHERE id = ?").bind(report_id).run()
        await _log_audit(db, _actor(request), "ignore_report", "report", report_id, "%s:%s" % (row["target_type"], row["target_id"]))
        return {"ok": True, "status": "ignored"}
    # delete: 先查作者再删
    target_user_id = None
    if row["target_type"] == "comment":
        t = await db.prepare("SELECT user_id FROM comments WHERE id = ?").bind(row["target_id"]).first()
        if t:
            target_user_id = t["user_id"]
        await db.prepare(
            "WITH RECURSIVE sub AS ("
            "SELECT id FROM comments WHERE id = ? OR parent_id = ? "
            "UNION "
            "SELECT c.id FROM comments c JOIN sub s ON c.parent_id = s.id"
            ") DELETE FROM comments WHERE id IN (SELECT id FROM sub)"
        ).bind(row["target_id"], row["target_id"]).run()
    else:
        t = await db.prepare("SELECT user_id FROM messages WHERE id = ?").bind(row["target_id"]).first()
        if t:
            target_user_id = t["user_id"]
        await db.prepare("DELETE FROM messages WHERE id = ?").bind(row["target_id"]).run()
    banned = False
    if body.ban and target_user_id:
        author = await db.prepare("SELECT username, role FROM users WHERE id = ?").bind(target_user_id).first()
        if author and author["role"] == "user":
            await db.prepare("UPDATE users SET banned = 1, banned_until = NULL WHERE id = ?").bind(target_user_id).run()
            banned = True
    await db.prepare("UPDATE reports SET status = 'handled' WHERE id = ?").bind(report_id).run()
    await _log_audit(db, _actor(request), "resolve_report", "report", report_id, "deleted%s" % ("+ban" if banned else ""))
    return {"ok": True, "status": "deleted", "banned": banned}


@app.get("/api/audit")
async def list_audit(request: Request):
    _check_admin(request)
    res = await _db(request).prepare(
        "SELECT id, actor, action, target_type, target_id, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 200"
    ).all()
    return {"audit": res.results}


@app.get("/api/announcement")
async def get_announcement(request: Request):
    raw = await _get_setting(_db(request), "announcement", "")
    return {"text": raw}


@app.put("/api/announcement")
async def put_announcement(body: AnnouncementIn, request: Request):
    _check_admin(request)
    db = _db(request)
    text = body.text.strip()
    await db.prepare(
        "INSERT INTO settings (key, value) VALUES ('announcement', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(text).run()
    await _log_audit(db, _actor(request), "set_announcement", "setting", None, text[:60])
    return {"ok": True, "text": text}


# ---------- 图床（KV） ----------

ALLOWED_IMG = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "png": "image/png", "gif": "image/gif", "webp": "image/webp",
}


@app.post("/api/upload")
async def upload(body: UploadIn, request: Request):
    _check_admin(request)
    fn = body.filename.lower()
    ext = fn.rsplit(".", 1)[-1] if "." in fn else ""
    if ext not in ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="只支持 jpg/png/gif/webp")
    try:
        raw = base64.b64decode(body.data)
    except Exception:
        raise HTTPException(status_code=400, detail="图片数据无效")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过 5MB")
    key = "img/" + _today_str().replace("-", "") + "/" + uuid.uuid4().hex[:12] + "." + ext
    from pyodide.ffi import to_js
    from js import Object
    opts = to_js({"expirationTtl": 14 * 24 * 3600}, dict_converter=Object.fromEntries)
    await request.scope["env"].XIAOKAN_MEDIA.put(key, raw, opts)
    return {"url": "/api/media/" + key}


@app.get("/api/media/{key:path}")
async def media(key: str, request: Request):
    obj = await request.scope["env"].XIAOKAN_MEDIA.get(key, "arrayBuffer")
    if obj is None:
        placeholder = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">'
            '<rect width="100%" height="100%" fill="#c0c0c0"/>'
            '<rect x="8" y="8" width="304" height="164" fill="none" stroke="#808080" stroke-width="2"/>'
            '<text x="160" y="86" font-family="SimSun,serif" font-size="18" fill="#000" text-anchor="middle">图片已过期</text>'
            '<text x="160" y="112" font-family="SimSun,serif" font-size="12" fill="#404040" text-anchor="middle">图床保存 14 天</text>'
            "</svg>"
        )
        return Response(content=placeholder, media_type="image/svg+xml")
    from js import Uint8Array
    raw = bytes(Uint8Array.new(obj).to_py())
    ext = key.rsplit(".", 1)[-1]
    ctype = ALLOWED_IMG.get(ext, "application/octet-stream")
    return Response(content=raw, media_type=ctype)


# ---------- RSS / Sitemap ----------

@app.get("/api/feed.xml")
async def feed(request: Request):
    res = await _db(request).prepare(
        "SELECT slug, title, created_at FROM articles ORDER BY created_at DESC LIMIT 20"
    ).all()
    base = "https://xiaokan-esn.pages.dev"
    items = []
    for a in res.results:
        link = base + "/article.html?slug=" + a["slug"]
        items.append(
            "<item><title>%s</title><link>%s</link><guid>%s</guid><pubDate>%s</pubDate></item>"
            % (html.escape(a["title"]), link, link, html.escape(a["created_at"]))
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0"><channel>'
        "<title>%s</title><link>%s</link><description>%s</description>%s"
        "</channel></rss>"
    ) % ("小戡的博客", base, "Win98 复古风个人主页", "".join(items))
    return Response(content=xml, media_type="application/xml")


@app.get("/api/sitemap.xml")
async def sitemap(request: Request):
    res = await _db(request).prepare(
        "SELECT slug FROM articles ORDER BY id ASC"
    ).all()
    base = "https://xiaokan-esn.pages.dev"
    urls = ["<url><loc>%s</loc></url>" % base]
    for a in res.results:
        urls.append("<url><loc>%s/article.html?slug=%s</loc></url>" % (base, a["slug"]))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">%s</urlset>'
    ) % "".join(urls)
    return Response(content=xml, media_type="application/xml")


# ---------- Worker 入口 ----------

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi
        return await asgi.fetch(app, request.js_object, self.env)