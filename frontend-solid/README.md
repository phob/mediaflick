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
  - `NEXT_PUBLIC_API_BASE_URL` or `API_BASE_URL`
  - `NEXT_PUBLIC_WS_URL` or `WS_URL`

## Production build

```bash
bun run build
bun run start
```

## Docker

Build and run:

```bash
docker build -t mediaflick-frontend-solid .
docker run --rm -p 3002:3002 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api \
  -e NEXT_PUBLIC_WS_URL=ws://localhost:5000/ws/filetracking \
  mediaflick-frontend-solid
```

Or run with Compose:

```bash
docker compose up --build
```
