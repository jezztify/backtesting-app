#!/usr/bin/env bash
# Start backend and frontend concurrently (simple launcher for dev)
# Requires bash (Windows: use Git Bash / WSL) and node/npm installed.

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend..."
(
  cd "$ROOT_DIR/Backend"
  npm install --no-audit --no-fund >/dev/null 2>&1 || true
  npm run watch
) &
BACKEND_PID=$!

echo "Starting frontend..."
(
  cd "$ROOT_DIR/Frontend"
  npm install --no-audit --no-fund >/dev/null 2>&1 || true
  npm run dev
) &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID
