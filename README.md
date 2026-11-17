# 蛋温记录 · 网页版（Cloudflare Worker）

单文件 HTML 蛋温记录应用，**前后端一体**部署为一个 Cloudflare Worker `temperature-app`：
静态前端（Workers Assets）+ 登录/云同步后端 API（D1 数据库）。

## 线上地址

- `https://wd.10704002.xyz/`（原后端域名，现同时提供新版网页）
- `https://danwen.10704002.xyz/`（新域名，2026-11-17 合并后指向同一 Worker）
- `https://temperature-app.z1926401461.workers.dev/`（备用）

两个域名指向**同一个 Worker**，页面与数据完全一致。

## 架构（2026-11-17 合并后）

原本有两个重复 Worker：
- `temperature-app`：旧版网页 + 后端 API（D1）— 在 `wd`
- `danwen-record`：新版网页（纯静态）— 在 `danwen`，跨域调 `wd` 后端

现已合并：把新版网页放进 `temperature-app` 的静态资源，保留其后端脚本与 D1 绑定一字不改，
让 `wd` 和 `danwen` 都指向它，并删除了重复的 `danwen-record`。访问地址不变、数据零迁移。

## 结构

- `public/index.html` — 新版上云版基线逐字节副本（sha256 前 12 位 `dcab7f9dc4db`）
- `src/index.js` — Worker 入口：非 `/api/` 请求交给静态资源；`/api/` 走 D1 后端（原样保留）
- `wrangler.toml` — Worker 配置 `name="temperature-app"`，两个自定义域路由 + D1 绑定 `DB`

## 更新页面

只改上云版基线，再重新部署：

```bash
cp /c/Users/zzh/Desktop/temapp/temperature-app/public/index.html public/index.html
wrangler deploy
```

`wrangler deploy` 会用本地 wrangler.toml 覆盖线上配置（含两个域与 D1 绑定），勿删改这些配置。

## 数据与回滚

- D1 数据库 `temperature-app-db`（id `04003cff-41d4-4d08-b969-7b64223a404c`）未做任何迁移或改动。
- 合并前的脚本、旧页面、D1 导出备份保存在本机工作区 `webapp/`：
  `worker-original.js`、`backup-old-wd-index.html`、`backup-d1-temperature-app.sql`。
- 需要回滚时用 Cloudflare 的版本历史选择合并前的 Version，或重新部署备份脚本。

## 说明

- 不上云版（本地 APK）由 `python temapp/tools/build_local.py` 从基线裁剪，与此 Worker 无关。
- 本仓库名沿用旧的 `danwen-record`，但内容已是合并后的 `temperature-app` 源码备份。
