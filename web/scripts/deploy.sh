#!/usr/bin/env bash
# =============================================================================
# crealink 部署脚本 — 适用于阿里云 ECS（Alibaba Cloud Linux 3 / CentOS/RHEL 系）
# =============================================================================
# 用法：
#   在项目根目录（如 /home/admin/testback）：./web/scripts/deploy.sh
#   或在 web 目录下：./scripts/deploy.sh
#
# 服务器需已安装：Node.js 18+、npm、PM2（可选）
# 阿里云 Linux 3 安装示例：
#   dnf install -y nodejs  或从 NodeSource 安装 LTS
#   npm install -g pm2
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

echo "[deploy] 工作目录: $WEB_DIR"

# -----------------------------------------------------------------------------
# 1. 检查 Node / npm
# -----------------------------------------------------------------------------
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo "[deploy] 错误: 未检测到 node 或 npm。请先安装 Node.js 18+。"
  echo "  阿里云 Linux 3 示例: dnf install -y nodejs"
  echo "  或: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo dnf install -y nodejs"
  exit 1
fi
echo "[deploy] Node $(node -v) / npm $(npm -v)"

# -----------------------------------------------------------------------------
# 2. 拉取最新代码（按需取消下一行注释，或部署前在仓库根目录执行 git pull）
# -----------------------------------------------------------------------------
# git pull origin main

# -----------------------------------------------------------------------------
# 3. 安装依赖（不安装 devDependencies）
#    由于 build 依赖的 packages（typescript/tailwind 等）已移到 dependencies，
#    生产构建时无需安装 devDependencies。
# -----------------------------------------------------------------------------
echo "[deploy] 安装依赖（omit devDependencies）..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# -----------------------------------------------------------------------------
# 4. 构建 Next.js
# -----------------------------------------------------------------------------
echo "[deploy] 构建 Next.js..."
npm run build

# -----------------------------------------------------------------------------
# 5. 日志目录
# -----------------------------------------------------------------------------
mkdir -p logs

# -----------------------------------------------------------------------------
# 6. 使用 PM2 启动/重启（若未安装 PM2 则仅提示手动启动）
# -----------------------------------------------------------------------------
if command -v pm2 &>/dev/null; then
  echo "[deploy] 重启 PM2 进程..."
  pm2 reload ecosystem.config.cjs --update-env 2>/dev/null || pm2 start ecosystem.config.cjs
  pm2 save
  echo "[deploy] 完成。查看状态: pm2 status"
else
  echo "[deploy] 未检测到 PM2，请手动启动: cd $WEB_DIR && npm run start"
  echo "  安装 PM2: npm install -g pm2"
fi
