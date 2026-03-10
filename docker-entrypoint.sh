#!/bin/sh
set -e

run_mediaflick() {
  PORT="${BACKEND_PORT}" bun /app/backend-bun/src/app/server.ts &
  backend_pid=$!
  trap 'kill "${backend_pid}" >/dev/null 2>&1 || true' INT TERM EXIT

  PORT="${FRONTEND_PORT}" \
    BACKEND_HTTP_ORIGIN="http://127.0.0.1:${BACKEND_PORT}" \
    BACKEND_WS_ORIGIN="ws://127.0.0.1:${BACKEND_PORT}" \
    bun /app/frontend-solid/server.ts
}

if [ "$#" -eq 0 ]; then
  run_mediaflick
fi

if [ "$#" -eq 1 ] && [ "$1" = "start" ]; then
  run_mediaflick
fi

if [ "$#" -eq 2 ] && [ "$1" = "bun" ] && [ "$2" = "start" ]; then
  run_mediaflick
fi

if [ "$#" -eq 3 ] && [ "$1" = "bun" ] && [ "$2" = "run" ] && [ "$3" = "start" ]; then
  run_mediaflick
fi

exec "$@"
