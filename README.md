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

## GitHub Actions 自动部署（可选，需一次性开启）

仓库根目录的 `github-actions-deploy.yml` 是 Actions 配置模板。因为 GitHub 要求写入 `.github/workflows/` 的 token 带 `workflows` 权限，这里没替你直接放进去。启用步骤：

1. 在 GitHub 网页打开本仓库 → Settings → Secrets and variables → Actions → New repository secret，加两个：
   - `CLOUDFLARE_API_TOKEN`：Cloudflare API Token（权限 Workers Script:Edit + Account:Read）
   - `CLOUDFLARE_ACCOUNT_ID`：`aa39df8086721d5a4465b21e85a16ff8`
2. 把 `github-actions-deploy.yml` 的内容新建为文件 `.github/workflows/deploy.yml`。
3. 以后 `git push` 到 main 就会自动部署。

不启用也没关系：本地 `wrangler deploy` 一样能更新线上。

## 说明

- 不上云版（本地 APK）由 `python temapp/tools/build_local.py` 从基线裁剪，与此 Worker 无关
- Worker 用的是 `workers.dev` 域名，不占 `wd.10704002.xyz`（那是后端 API 域名）
