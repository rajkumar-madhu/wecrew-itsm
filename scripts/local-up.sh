#!/bin/zsh
set -e
export PATH=/opt/homebrew/bin:/usr/bin:/bin
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting postgres/redis..."
docker context use colima >/dev/null 2>&1 || true
docker compose -f docker-compose.local.yml up -d

echo "Starting backend on :5001..."
cd "$ROOT/backend"
export $(grep -v '^#' .env | xargs)
export PORT=5001
pkill -x nodemon 2>/dev/null || true
nohup npm run dev > /tmp/argus-backend.log 2>&1 &

echo "Starting frontend on :5174..."
cd "$ROOT/frontend-react"
nohup npm run dev -- --port 5174 --host 127.0.0.1 > /tmp/argus-frontend.log 2>&1 &

sleep 4
echo "UI:  http://127.0.0.1:5174/"
echo "API: http://127.0.0.1:5001/api/v1"
echo "Login: rajkumar@santhira.com / LinkedEye@2026"
