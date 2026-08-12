// 小戡的博客：Pages Functions 同源代理
// 浏览器请求 /api/* -> Cloudflare Pages 边缘转发到 Python Worker
// 解决 workers.dev 直连被墙/超时的问题
const WORKER_API = "https://xiaokan-api.gunmu1145.workers.dev";

export async function onRequest(context: { request: Request; params: { path?: string[] } }) {
  const suffix = (context.params.path || []).join("/");
  const url = new URL(context.request.url);
  const target = WORKER_API + "/api/" + suffix + url.search;

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(context.request.method)) {
    init.body = await context.request.arrayBuffer();
  }

  const resp = await fetch(target, init as RequestInit);
  const outHeaders = new Headers(resp.headers);
  outHeaders.set("Access-Control-Allow-Origin", "*");
  return new Response(resp.body, { status: resp.status, headers: outHeaders });
}