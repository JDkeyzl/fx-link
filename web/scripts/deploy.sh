#!/usr/bin/env bash
# 在阿里云服务器上执行：拉取/更新代码、安装依赖、构建、重启 PM2
# 用法：在项目根目录（tk-link）执行 ./web/scripts/deploy.sh，或在 web 目录执行 ./scripts/deploy.sh

set -e

# 判断脚本所在目录，保证在 web 目录执行 npm
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

echo "[deploy] Working directory: $WEB_DIR"

# 若在 git 仓库且存在远程，可拉取最新代码（按需取消注释）
# git pull origin main

echo "[deploy] Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "[deploy] Building Next.js..."
npm run build

echo "[deploy] Creating logs directory..."
mkdir -p logs

if command -v pm2 &>/dev/null; then
  echo "[deploy] Restarting PM2 process..."
  pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
  pm2 save
  echo "[deploy] Done. Check: pm2 status"
else
  echo "[deploy] PM2 not found. Build finished. Start manually: npm run start"
fi
