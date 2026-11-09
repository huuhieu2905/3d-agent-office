#!/usr/bin/env bash
# Agent Office installer (US8, docs/INSTALL.md). macOS only — Linux is deferred (Constitution VI v2.0.0).
# Does not read any Antigravity App data (Constitution II): the App is checked by the adapter on `npm start`.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\033[1m%s\033[0m\n' "$*"; }

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Agent Office hiện chỉ hỗ trợ macOS (Linux sẽ được hỗ trợ sau)." >&2
  exit 1
fi

# Pick up fnm-managed Node if it is installed but not yet in this shell.
if ! command -v node >/dev/null 2>&1 && command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
fi

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]'); fi
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Cần Node.js ≥ 22. Cài nhanh bằng fnm:" >&2
  echo "  curl -fsSL https://fnm.vercel.app/install | bash" >&2
  echo "  # mở terminal mới, rồi:" >&2
  echo "  fnm install 22 && fnm default 22" >&2
  exit 1
fi

say "1/3 Cài thư viện (npm ci)…"
npm ci --no-fund --no-audit

say "2/3 Build giao diện…"
npm run build

say "3/3 Xong!"
echo
echo "Hãy mở Antigravity App (đã kiểm chứng 2.29.0, 2.24.0), rồi chạy:"
echo "  npm start"
