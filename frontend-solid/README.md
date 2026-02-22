# Mediaflick Solid Frontend

Lightweight SolidJS frontend focused on media-first navigation for `backend-bun`.

## Run locally

```bash
bun install
bun run dev
```

Default URL: `http://localhost:5173`

## Environment

The app supports both build-time and runtime configuration.

- Build-time (Vite):
  - `VITE_API_BASE_URL` (default `http://localhost:5000/api`)
  - `VITE_WS_URL` (default `ws://localhost:5000/ws/filetracking`)
- Runtime (Docker/server):
  - `BACKEND_HTTP_ORIGIN` (default `http://127.0.0.1:5000`)
  - `BACKEND_WS_ORIGIN` (default `ws://127.0.0.1:5000`)
  - `API_BASE_URL` (optional public override)
  - `WS_URL` (optional public override)

## Production build

```bash
bun run build
bun run start
```

## Docker

Build and run:

```bash
docker build -t mediaflick-frontend-solid .
docker run --rm -p 3867:3867 \
  -e BACKEND_HTTP_ORIGIN=http://127.0.0.1:5000 \
  -e BACKEND_WS_ORIGIN=ws://127.0.0.1:5000 \
  mediaflick-frontend-solid
```

Default runtime URL: `http://localhost:3867`

The Bun server in this project serves static assets and can proxy:

- `/api/*` to `BACKEND_HTTP_ORIGIN`
- `/ws/*` to `BACKEND_WS_ORIGIN`

Public `api`/`ws` URLs are auto-detected using forwarded headers from your reverse proxy.
If that detection fails in your environment, set `API_BASE_URL` and `WS_URL` explicitly.

Or run with Compose:

```bash
docker compose up --build
```
