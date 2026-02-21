# Mediaflick Frontend (Bun Backend)

This app is a Next.js frontend wired directly to `backend-bun`.

## Run

1. Install dependencies:

```bash
bun install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
bun run dev
```

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default in example: `http://localhost:5000/api`)
- `NEXT_PUBLIC_WS_URL` (default in example: `ws://localhost:5000/ws/filetracking`)

## Notes

- REST calls go directly to the backend-bun API.
- Realtime updates use native WebSocket events from `/ws/filetracking`.
- Admin cache UI reflects current backend-bun v1 cache behavior (coarse invalidation).
