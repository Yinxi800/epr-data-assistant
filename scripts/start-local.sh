#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1 || ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"; then
  if [ -x /Users/yinxi/.local/share/cursor-agent/versions/2025.09.18-7ae6800/node ]; then
    PATH="/Users/yinxi/.local/share/cursor-agent/versions/2025.09.18-7ae6800:/Users/yinxi/.local/node/bin:$PATH"
    export PATH
  fi
fi
npm run dev
