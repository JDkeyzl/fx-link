# crealink.shop — HTTP 部署要点（无 HTTPS）

完整步骤：`docs/deploy-crealink-shop-http.md`。

服务器路径示例：**`/home/admin/fx-link`**（web：`.../web`，server：`.../server`）。

## 环境变量（生产）

`web/ecosystem.config.cjs` 已写入默认值；**首次或修改 `NEXT_PUBLIC_*` 后必须重新 build**：

```bash
cd /home/admin/fx-link/web
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build
```

## 服务器稳定构建（不换本机，避免被 `Killed`）

思路：**加足 swap**（内核 OOM 杀手杀进程前可先换页）+ **不用 Turbopack**（用 Webpack）+ **临时目录放到磁盘** + **可选限制 V8 堆**，避免和系统/子进程抢光物理内存。

### 1）先加 Swap（强烈建议，约 1～2GB 内存的机器几乎必备）

**Ubuntu / Debian**（有 `fallocate` 时）：

```bash
sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Alibaba Cloud Linux / CentOS / RHEL**（无 `fallocate` 时用 `dd`）：

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

检查：

```bash
free -h
swapon --show
```

磁盘要留足空间（swap 文件约 **4G**；若盘紧可改为 `count=2048` 做 2G，但更容易仍被 Kill）。

### 1.5）`npm ci` 也被 `Killed` 时

`npm ci` 同样吃内存，**务必先做 swap** 再装依赖。可再略降峰值：

```bash
export TMPDIR=/home/admin/tmp
mkdir -p "$TMPDIR"
export NODE_OPTIONS="--max-old-space-size=512"
npm ci --omit=dev
```

仍不行就**加大 swap** 或换更大内存规格；不要指望在几乎无 swap 的 1G 机器上稳定跑 `npm ci` + `next build`。

### 2）构建前释放内存

```bash
pm2 stop crealink-web 2>/dev/null || true
```

### 3）一键构建（推荐）

在 **`web`** 目录，**已成功执行过 `npm ci`** 的前提下：

```bash
cd /home/admin/fx-link/web
export TMPDIR=/home/admin/tmp
mkdir -p "$TMPDIR"
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build:vps
```

`build:vps` 会执行 `scripts/build-on-vps.sh`：默认 **`next build --webpack`**、设置 **`TMPDIR`**、按机器内存自动加 **`NODE_OPTIONS=--max-old-space-size=768|1536`**（若你已在环境变量里设了 `NODE_OPTIONS` 则不会覆盖）。

仍失败时可**手动加大堆**（在物理内存 + swap 能承受的前提下，例如 2G 内存试 `1536` 或 `2048`）：

```bash
export NODE_OPTIONS="--max-old-space-size=1536"
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build:low-mem
```

### 4）构建完成后

```bash
pm2 start crealink-web
# 或 pm2 restart crealink-web
```

### 5）仍不稳定时

- 把 ECS **升到 2G 及以上内存**，通常比反复调参更省事。
- 或改用下文 **「本地构建 + 同步 `.next`」** / **GitHub Actions（Linux）构建**，服务器只 `npm ci` + `next start`。

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
cd ../server && SITE_URL=https://crealink.shop npm run generate-part-sitemaps
```

然后重新 `npm run build`（或把生成的 `public/sitemaps/*.xml` 放到构建环境）。




服务端
cd /home/admin/fx-link/server
npm ci
# 若没有 package-lock 或 ci 报错，改用：
# npm install

pm2 restart crealink-backend
pm2 status