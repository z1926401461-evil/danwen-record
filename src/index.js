// 蛋温记录 · Cloudflare Worker
// 只负责把请求交给静态资源（public/index.html），不改动任何业务逻辑。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 首页与静态文件都由 Workers Assets 直接处理
    const res = await env.ASSETS.fetch(request);
    // 给 HTML 加基础安全头，不影响应用
    const headers = new Headers(res.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
};
