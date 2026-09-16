#!/usr/bin/env python3
"""把小戡博客 D1 里的待发邮件队列发给 agently-cli。

Cloudflare Worker 不能直接调用本机 CLI，所以 Worker 只负责把验证码邮件
写进 email_outbox；本脚本在本机 poll 队列，再用已授权的
pyclaw@agent.qq.com 发出去。

默认只展示待发邮件，不会发送。明确加 --yes 才会执行发送：

    $env:ADMIN_PASSWORD="..."
    python tools/email_bridge.py --yes
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request


DEFAULT_API = "https://xiaokan-esn.pages.dev"

BROWSER_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
}


def api_request(base, path, method="GET", payload=None, token=""):
    data = None
    headers = dict(BROWSER_HEADERS)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base.rstrip("/") + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            detail = json.loads(raw).get("detail", raw)
        except Exception:
            detail = raw
        raise RuntimeError("HTTP %s: %s" % (exc.code, detail)) from exc


def run_cli(args):
    proc = subprocess.run(
        ["agently-cli"] + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError("agently-cli 没返回 JSON：%s" % ((proc.stdout or proc.stderr or "").strip()[:500])) from exc
    if proc.returncode != 0:
        message = (data.get("error") or {}).get("message") or (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError("agently-cli 退出码 %s：%s" % (proc.returncode, message[:500]))
    return data


def send_mail(to_email, subject, body):
    base_args = ["message", "+send", "--to", to_email, "--subject", subject, "--body", body]
    first = run_cli(base_args)
    token = ((first.get("data") or {}).get("confirmation_token") or "").strip()
    if not token:
        raise RuntimeError("agently-cli 没返回 confirmation_token")
    second = run_cli(base_args + ["--confirmation-token", token])
    if not second.get("ok"):
        raise RuntimeError(second.get("error") or "发送失败")
    return second


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("BLOG_API", DEFAULT_API))
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", ""))
    parser.add_argument("--yes", action="store_true", help="明确同意发送队列里的邮件")
    args = parser.parse_args()

    if not args.password:
        print("缺 ADMIN_PASSWORD 环境变量或 --password", file=sys.stderr)
        return 2

    login = api_request(args.api, "/api/login", "POST", {
        "username": args.username,
        "password": args.password,
    })
    token = login.get("token") or ""
    if not token:
        print("登录失败：没拿到 token", file=sys.stderr)
        return 3

    outbox = api_request(args.api, "/api/mail/outbox", token=token)
    emails = outbox.get("emails") or []
    if not emails:
        print("没有待发邮件")
        return 0

    if not args.yes:
        print("有 %d 封待发邮件。确认发送请重跑并加 --yes：" % len(emails))
        for item in emails:
            print("#%s -> %s | %s" % (item.get("id"), item.get("to_email"), item.get("subject")))
        return 0

    failed = 0
    for item in emails:
        mail_id = item.get("id")
        try:
            send_mail(item.get("to_email"), item.get("subject"), item.get("body"))
            api_request(args.api, "/api/mail/outbox/%s/sent" % mail_id, "POST", {}, token)
            print("已发送 #%s -> %s" % (mail_id, item.get("to_email")))
        except Exception as exc:
            failed += 1
            api_request(
                args.api,
                "/api/mail/outbox/%s/failed" % mail_id,
                "POST",
                {"error": str(exc)[:500]},
                token,
            )
            print("发送失败 #%s：%s" % (mail_id, exc), file=sys.stderr)

    print("完成：成功 %d，失败 %d" % (len(emails) - failed, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
