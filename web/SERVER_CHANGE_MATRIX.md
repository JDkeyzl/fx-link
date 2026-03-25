# 改动类型 ↔ 服务器操作对照

> 仓库根目录在服务器上的示例路径：`/home/admin/fx-link`；前端 `web/`，后端 `server/`。  
> 构建与小内存、Swap 等细节见 **`DEPLOY_HTTP.md`**。

下列凡涉及 **`git pull`** 的，均在服务器对应目录执行；**改 PM2 环境** 后建议 `pm2 restart ... --update-env`。

---

## 1. 仅改前端业务代码（`web/src/**`、组件、样式、文案 i18n）

| 操作 |
|------|
| `cd /home/admin/fx-link && git pull` |
| `cd web && npm ci --omit=dev`（仅当 `package.json` / `package-lock.json` 有变时；不确定可执行） |
| `npm run build:vps`（或 `build:low-mem`；需带正确的 `NEXT_PUBLIC_SITE_URL`、`PARTS_API_BASE_URL`） |
| `pm2 restart crealink-web` |

---

## 2. 改了 `web/package.json` 或 `package-lock.json`（新增/升级依赖）

| 操作 |
|------|
| `git pull` |
| `cd web && npm ci --omit=dev`（**必须**） |
| `npm run build:vps` + `pm2 restart crealink-web` |

---

## 3. 改了 `web/ecosystem.config.cjs`（PM2：端口、`NEXT_PUBLIC_*`、`PARTS_API_BASE_URL`）

| 操作 |
|------|
| `git pull` |
| 若修改了 **`NEXT_PUBLIC_*`**：**必须重新 `build`**（该变量会打进前端包） |
| `pm2 restart crealink-web --update-env`（或 `delete` 后用 `ecosystem.config.cjs` 重建） |

---

## 4. 改了静态资源流程（`web/scripts/copy-assets.cjs`、`web/source/**`）

**注意**：`source/` 里的大图若未进 Git，需自行同步到服务器同名路径。

| 操作 |
|------|
| 将本机 `web/source/**`（含 `logo.png`、`logo/*.png` 等）拷到服务器 `web/source/**`（若 Git 未包含） |
| `git pull`（若有脚本或路径变更） |
| `cd web && npm run copy-assets` |
| 若仅改 `public/` 下文件、**未**改 `src/`：理论上可只 `copy-assets` + `pm2 restart crealink-web`；**改了 layout/ metadata / 引用路径则仍要 build** |

---

## 5. 仅改 `web/public/` 里已跟踪文件（如 `robots.txt`），未改 `src/`

| 操作 |
|------|
| `git pull` |
| `pm2 restart crealink-web`（确保进程读到新静态文件；有缓存时可重启） |

若文件是 **build 时从 `source` 生成**的，应以第 4 节为准跑 `copy-assets`。

---

## 6. 改了站点图标 / `metadata`（如 `layout.tsx` 里 `icons`、`metadataBase`）

| 操作 |
|------|
| `git pull` |
| `npm run copy-assets`（保证 `public/logo.png` 等为最新） |
| **`npm run build:vps` + `pm2 restart crealink-web`**（Metadata 由构建产物决定） |
| 浏览器可能强缓存 favicon，客户端可做硬刷新或无痕验证 |

---

## 7. 仅改后端（`server/src/**`，不含 DB 结构大改）

| 操作 |
|------|
| `git pull` |
| `cd server && npm ci --omit=dev`（仅 lock 有变时必需） |
| `pm2 restart crealink-backend` |

---

## 8. 替换或更新 `parts.db`（配件数据）

| 操作 |
|------|
| 停后端：`pm2 stop crealink-backend`（推荐，避免 WAL 拷贝异常） |
| 覆盖 `server/data/parts.db`（或按项目约定路径） |
| `pm2 start crealink-backend` |
| 若站点依赖 **sitemap 全量 URL**：见第 9 节重新生成 sitemap |

---

## 9. 生成 / 更新配件 sitemap（`parts-sitemap-*.xml`）

| 操作 |
|------|
| `cd server && SITE_URL=https://你的域名 npm run generate-part-sitemaps` |
| 输出在 `web/public/sitemaps/` |
| 若 Nginx/Next 曾缓存旧 404：`pm2 restart crealink-web` |
| **`robots.txt` 里 Sitemap 地址与 `SITE_URL` 协议（http/https）保持一致** |

---

## 10. 改 Nginx（反代、HTTPS、域名）

| 操作 |
|------|
| 编辑站点配置后：`sudo nginx -t && sudo systemctl reload nginx` |
| 证书续期后一般 reload 即可；**若改了对外 URL**，同步改 **`NEXT_PUBLIC_SITE_URL`、sitemap、`robots.txt`** 并 **重新 build + 第 9 节** |

---

## 11. 小内存机器：`npm ci` / `build` 被 `Killed`

| 操作 |
|------|
| 配置 **Swap**（见 `DEPLOY_HTTP.md`） |
| `export TMPDIR=/home/admin/tmp` 后再 `npm ci` / `build` |
| 或使用 **`npm run build:vps`**；仍失败则加内存或 **本机构建后仅同步 `web/.next/`**（见 `DEPLOY_HTTP.md`） |

---

## 12. 一键自检（改完后）

```bash
curl -sS http://127.0.0.1:3001/healthz
curl -I  http://127.0.0.1:3000
pm2 status
```

对外域名（HTTPS）再测首页与一条配件详情 URL。

---

## 汇总表（极简）

| 改动内容 | git pull | web `npm ci` | `copy-assets` | web `build` | `pm2 web` | `pm2 backend` | sitemap |
|----------|----------|--------------|---------------|-------------|-----------|---------------|---------|
| 前端 `src/` | ✅ | 视 lock | 视资源 | ✅ | ✅ | — | — |
| `NEXT_PUBLIC_*` / layout metadata | ✅ | 视 lock | 视 logo | ✅ | ✅ | — | — |
| `source/` / logo / 合作伙伴图 | ✅ | — | ✅ | 视是否改引用 | 视情况 | — | — |
| `package-lock`（web） | ✅ | ✅ | — | ✅ | ✅ | — | — |
| 后端 `server/src/` | ✅ | — | — | — | — | ✅ | 视情况 |
| `parts.db` | — | — | — | — | — | ✅ | 建议 |
| 仅 sitemap | — | — | — | — | 视情况 | — | ✅ |

---

文档版本：与仓库内 `DEPLOY_HTTP.md`、`ecosystem.config.cjs` 保持一致维护；域名与协议以你当前生产环境为准。
