#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKEND_BUN_PORT="${BACKEND_BUN_PORT:-5000}"
FRONTEND_BUN_PORT="${FRONTEND_BUN_PORT:-3001}"
API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:${BACKEND_BUN_PORT}/api}"
WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:${BACKEND_BUN_PORT}/ws/filetracking}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "${BACKEND_PID}" ] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID}" ] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend-bun on :${BACKEND_BUN_PORT}"
(cd "${ROOT_DIR}/backend-bun" && PORT="${BACKEND_BUN_PORT}" bun run dev) &
BACKEND_PID=$!

echo "Starting frontend-solid on :${FRONTEND_BUN_PORT}"
echo "Using NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}"
echo "Using NEXT_PUBLIC_WS_URL=${WS_URL}"
(cd "${ROOT_DIR}/frontend-solid" && PORT="${FRONTEND_BUN_PORT}" NEXT_PUBLIC_API_BASE_URL="${API_BASE_URL}" NEXT_PUBLIC_WS_URL="${WS_URL}" bun run dev) &
FRONTEND_PID=$!

echo "frontend-solid URL: http://localhost:${FRONTEND_BUN_PORT}"

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
