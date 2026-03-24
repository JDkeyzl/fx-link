# crealink.shop — HTTP 部署要点（无 HTTPS）

完整步骤：`docs/deploy-crealink-shop-http.md`。

服务器路径示例：**`/home/admin/fx-link`**（web：`.../web`，server：`.../server`）。

## 环境变量（生产）

`web/ecosystem.config.cjs` 已写入默认值；**首次或修改 `NEXT_PUBLIC_*` 后必须重新 build**：

```bash
cd /home/admin/fx-link/web
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build
```

### 小内存机器（约 1GB RAM）构建被 `Killed`（OOM）

Next 16 默认生产构建可能走 Turbopack，峰值内存较高。可改用 **Webpack 构建**（仓库已加脚本）：

```bash
cd /home/admin/fx-link/web
pm2 stop crealink-web 2>/dev/null || true
export TMPDIR=/home/admin/tmp
mkdir -p "$TMPDIR"
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build:low-mem
```

仍被杀死时：加大 **swap**（例如再挂 2～4G swap 文件），或改用下面 **「本地构建 + 同步 `.next`」**（不在服务器上 build）。

## 本地构建 + 同步到服务器（推荐：小内存 VPS）

服务器只做 **安装依赖 + `next start`**，**不在服务器执行 `npm run build`**。

### 1. 在你自己的电脑（Mac）上

在仓库 **`web`** 目录，**与线上一致的** `NEXT_PUBLIC_SITE_URL` 必须出现在 build 时（会打进前端包）：

```bash
cd /path/to/tk-link/web
export NEXT_PUBLIC_SITE_URL=http://crealink.shop
export PARTS_API_BASE_URL=http://127.0.0.1:3001
npm ci
npm run build
# 若本机构建也吃紧，可用：npm run build:low-mem
```

### 2. 把构建产物拷到服务器

用 **`rsync`**（推荐，可增量、可删过期 chunk）或 **`scp`**。示例（把 `IP`、路径改成你的）：

```bash
# 仍在本地 web 目录；若用密钥：rsync -avz -e "ssh -i ~/.ssh/你的.pem" ...

rsync -avz --delete ./.next/ admin@IP:/home/admin/fx-link/web/.next/
rsync -avz ./public/ admin@IP:/home/admin/fx-link/web/public/
```

代码仍建议用 **`git pull`** 更新（`package.json` / `package-lock.json` / `src` 等与线上一致）；**`.next` 以你本机这次 build 为准覆盖服务器**。

### 3. 在服务器上

```bash
cd /home/admin/fx-link/web
git pull   # 若已在仓库根 pull 过可省略
npm ci --omit=dev
pm2 restart crealink-web
```

**不要**再执行 `npm run build`。

### 注意

- **Node 主版本**尽量与服务器一致（例如都用 **Node 20**），减少差异。
- 从 **macOS 构建、Linux 运行**在多数纯 JS 项目上可行；若 `next/image` 等出现异常，可改为在 **Linux CI（如 GitHub Actions）** 上 build 再同步 `.next`，或换用与线上一致的 Docker 里构建。
- 改了 **`NEXT_PUBLIC_*`** 必须在本地 **重新 build** 后再同步 `.next`。

运行时（PM2）仍需与 build 时一致的 `NEXT_PUBLIC_SITE_URL`（已在 ecosystem 中）。

```bash
export NEXT_PUBLIC_SITE_URL=http://crealink.shop
export PARTS_API_BASE_URL=http://127.0.0.1:3001
```

## Nginx（80 → Next 3000）

```nginx
server {
    listen 80;
    server_name crealink.shop www.crealink.shop;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 同时运行

- `server`：`PORT=3001`（Express + SQLite）
- `web`：`npm run start`（默认 3000）

## Sitemap

```bash
cd ../server && SITE_URL=http://crealink.shop npm run generate-part-sitemaps
```

然后重新 `npm run build`（或把生成的 `public/sitemaps/*.xml` 放到构建环境）。
