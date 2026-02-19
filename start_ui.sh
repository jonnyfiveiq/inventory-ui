#!/usr/bin/env bash
set -euo pipefail

# Use Node 22 from Homebrew
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

echo "🔍 Using Node $(node --version)"
echo "🔍 Checking for existing inventory-ui processes on port ${PORT}..."

# Kill any process on the target port
if lsof -ti :${PORT} >/dev/null 2>&1; then
  echo "⚠️  Killing existing process(es) on port ${PORT}"
  lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Also kill any lingering vite/node processes for this project
pgrep -f "vite.*inventory-ui" | xargs kill -9 2>/dev/null || true

echo "📦 Starting inventory-ui dev server..."
cd "${SCRIPT_DIR}"
npm run dev
