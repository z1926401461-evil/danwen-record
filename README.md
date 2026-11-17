# 蛋温记录 · 网页版（Cloudflare Worker）

单文件 HTML 蛋温记录应用，部署为一个 Cloudflare Worker，登录/云同步走 `https://wd.10704002.xyz` 后端。

## 结构

- `public/index.html` — 来自上云版基线 `C:\Users\zzh\Desktop\temapp\temperature-app\public\index.html` 的逐字节副本（sha256 前 12 位 `dcab7f9dc4db`）
- `src/index.js` — Worker 入口，把请求交给静态资源，仅加两个安全响应头
- `wrangler.toml` — Worker 配置，名字 `danwen-record`，走 `workers.dev` 子域

## 更新页面

只改上云版基线，然后重新生成仓库里的静态文件：

```bash
cp /c/Users/zzh/Desktop/temapp/temperature-app/public/index.html public/index.html
wrangler deploy
```

或 `git add -A && git commit -m "update" && git push`，GitHub Actions 会自动部署（需在仓库 Secrets 配 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`）。

## 说明

- 不上云版（本地 APK）由 `python temapp/tools/build_local.py` 从基线裁剪，与此 Worker 无关
- Worker 用的是 `workers.dev` 域名，不占 `wd.10704002.xyz`（那是后端 API 域名）
