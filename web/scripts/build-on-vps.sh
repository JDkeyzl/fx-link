#!/usr/bin/env bash
# 在 Linux VPS 上降低 Next 构建被 OOM Kill 的概率：TMPDIR +（可选）NODE_OPTIONS。
# 使用前请先按 web/DEPLOY_HTTP.md 配置足够 swap；并先 pm2 stop crealink-web。
set -euo pipefail
cd "$(dirname "$0")/.."

export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export TMPDIR="${TMPDIR:-$HOME/tmp}"
mkdir -p "$TMPDIR"

if [ -z "${NODE_OPTIONS:-}" ] && command -v free >/dev/null; then
  MEM_MB="$(free -m | awk '/^Mem:/{print $2}')"
  MEM_MB="${MEM_MB:-1024}"
  if [ "$MEM_MB" -lt 1800 ]; then
    export NODE_OPTIONS="--max-old-space-size=768"
  else
    export NODE_OPTIONS="--max-old-space-size=1536"
  fi
fi

: "${NEXT_PUBLIC_SITE_URL:=http://crealink.shop}"
: "${PARTS_API_BASE_URL:=http://127.0.0.1:3001}"
export NEXT_PUBLIC_SITE_URL PARTS_API_BASE_URL

npm run copy-assets
exec npx next build --webpack
