#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "请安装 Node.js 22.12 或更新的 LTS 版本（包含 npm）：https://nodejs.org/"
  exit 1
fi
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"; then
  echo "Node.js 版本过旧，请升级到22.12或更新的LTS版本。"
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run dev
