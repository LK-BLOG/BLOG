# 小戡的博客

90 年代 Win98 复古风个人主页：Vibe Coding 产物（无框架、无 Tailwind、无任何蓝紫渐变）+ Cloudflare Python Worker（FastAPI）+ D1 数据库。

- 首页：个人简介 / 技能 / 项目 / 社交账号 / 最新文章
- 文章：admin 面板写 Markdown 发布（密码走环境变量，不写进仓库）
- 留言板：免登录留言，60 秒/IP 限频，admin 可删
- 关于 / 友链 / 404

## 目录结构

```
blog/
├── frontend/            # Cloudflare Pages 托管的静态站
│   ├── index.html        # 首页
│   ├── articles.html     # 文章列表
│   ├── article.html      # 文章详情（?slug=xxx）
│   ├── guestbook.html    # 留言板
│   ├── about.html        # 关于
│   ├── friends.html      # 友链
│   ├── admin.html        # 管理后台
│   ├── 404.html
│   ├── css/style.css     # Win98 复古样式
│   ├── js/               # 页面脚本
│   ├── lib/marked.min.js # 本地 Markdown 渲染（不依赖 CDN）
│   └── assets/favicon.svg
└── worker/              # Cloudflare Python Worker（API）
    ├── wrangler.toml
    ├── pyproject.toml
    ├── src/worker.py     # FastAPI 全部接口
    └── migrations/       # D1 表结构
```

## API

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | /api/login | 密码换 token | - |
| GET | /api/articles | 文章列表 | - |
| GET | /api/articles/{slug} | 文章详情 | - |
| POST | /api/articles | 新建文章 | admin |
| PUT | /api/articles/{slug} | 更新文章 | admin |
| DELETE | /api/articles/{slug} | 删除文章 | admin |
| GET | /api/messages | 留言列表 | - |
| POST | /api/messages | 发留言（60s/IP 限频） | - |
| DELETE | /api/messages/{id} | 删除留言 | admin |

## 本地调试

前置：Node 18+、Python 3.12（uv 会自动装）、uv。

```powershell
# 1. 装 uv（如果还没有）
python -m pip install uv

# 2. 起 Worker + 本地 D1
cd worker
uv sync
uv run pywrangler d1 migrations apply xiaokan-blog --local
uv run pywrangler dev --local --port 8787

# 3. 另开终端起前端
cd frontend
python -m http.server 8000
```

本地调试时把 `frontend/js/config.js` 里的 `window.API_BASE` 改成 `"http://127.0.0.1:8787"`。
浏览器开 http://127.0.0.1:8000 ，admin 入口在页脚。
先在 worker/.dev.vars 里配好 ADMIN_PASSWORD（复制 .dev.vars.example，密码自己定）。

## 上线部署

### 1. GitHub
- 新建仓库（建议 `blog`），把本项目 `frontend/` 和 `worker/` 一起推上去。

### 2. Cloudflare Pages（静态前端）
- Cloudflare 控制台 → Workers & Pages → 创建 → Pages → 连接 Git 仓库。
- 构建配置：**无需构建命令**，构建输出目录填 `frontend`。
- 部署完成得到一个 `https://xxx.pages.dev` 域名，可自己改名（如 `xiaokan.pages.dev`）。

### 3. D1 数据库
```powershell
cd worker
npx wrangler d1 create xiaokan-blog
# 把返回的 database_id 填进 wrangler.toml 的 [[d1_databases]]
npx wrangler d1 migrations apply xiaokan-blog --remote
```

### 4. 部署 Worker
```powershell
npx wrangler deploy
# 会输出你的 workers.dev 地址，例如 https://xiaokan-api.xxx.workers.dev
```

### 5. 让前端连上 API
把 `frontend/js/config.js` 里的 `window.API_BASE` 改成 Worker 地址，推送到 GitHub，Pages 自动更新。

### 6. 配置 admin 密码（重要）
密码不写进仓库：本地用 worker/.dev.vars，线上执行 
px wrangler secret put ADMIN_PASSWORD。

### 7. 验收
- 首页能显示最新文章；文章列表/详情正常。
- 留言板能发留言，1 分钟内重复发会被限频。
- 页脚「管理入口」用你配置的 `ADMIN_PASSWORD` 登录，能写文章、删留言。

## 安全提示（上线前建议）

- admin 密码不写在仓库里（`wrangler.toml` 无明文）。本地用 `.dev.vars`，线上用：
  ```powershell
  npx wrangler secret put ADMIN_PASSWORD
  ```
- 本地测试数据和生产数据是分开的（`--local` 用本地 SQLite，`--remote` 用线上 D1）。`n- 忘了密码？直接改 `.dev.vars` / 重新 `wrangler secret put ADMIN_PASSWORD` 即可，前端无需改动。

## 如果 Python Worker beta 出问题

降级方案：用 JS Worker 实现同一组接口（逻辑完全一样，D1 绑定不变），前端 `config.js` 改一下地址即可，前端零改动。