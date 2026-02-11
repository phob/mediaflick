# Mediaflick Bun Backend

This folder contains the Bun/TypeScript backend redesign, built as an alternative to the existing .NET backend.

## Architecture Context

**Why two backends?**
- The `backend/` folder contains the original .NET 9 implementation (PlexLocalScan.Api, SignalR hubs, EF Core)
- The `backend-bun/` folder is a **planned migration** to Bun/TypeScript for:
  - Simpler deployment (single static binary vs .NET runtime)
  - Shared TypeScript types with the frontend
  - Reduced memory footprint and faster startup
  - Easier maintenance for a TypeScript-heavy codebase

**Migration Status**: This is an experimental replacement, not yet production-ready. Both backends share the same SQLite schema and API contract for gradual transition.

## Current Status
- HTTP routing is implemented with Hono on top of `Bun.serve`.
- All HTTP and WebSocket path entrypoints are centralized in `src/app/entrypoints.ts`.
- Poll-based ingestion pipeline is implemented (no file watcher).
- REST API routes for config, logs, media lookup, scanned files, and symlink cleanup are implemented.
- WebSocket realtime channel is implemented at `/ws/filetracking`.
- Drizzle + SQLite integration is implemented, including TV series identity tables.

## Run
```bash
bun install
bun run start
```

For development with auto-reload:
```bash
bun run dev
```

Type-check:
```bash
bun run typecheck
```

## Environment Variables
- `PORT` (default: `5000`)
- `BACKEND_BUN_ROOT_DIR` (default: current directory)
- `BACKEND_BUN_CONFIG_PATH` (default: `<root>/config/config.yml`)
- `BACKEND_BUN_LOGS_DIR` (default: `<root>/logs`)
- `BACKEND_BUN_DB_PATH` (default: `<root>/config/plexscan.db`)

## Docs
- Integration flow and runtime behavior: `backend-bun/docs/INTEGRATION.md`
- API and realtime contract: `backend-bun/docs/API.md`
- Frontend endpoint matrix (screen-by-screen): `backend-bun/docs/FRONTEND_ENDPOINT_MATRIX.md`
