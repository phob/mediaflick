# Integration Notes

## Overview
The Bun backend is organized as small modules around clear responsibilities:
- `src/app/*`: server bootstrapping, Hono app composition, and entrypoint registry
- `src/config/*`: environment + YAML runtime configuration
- `src/db/*`: Drizzle schema and SQLite initialization
- `src/modules/file-ingest/*`: poller and periodic runtime jobs
- `src/modules/detection/*`: movie and TV detection, including TV identity mapping
- `src/modules/media-lookup/*`: TMDb client and lookup endpoints
- `src/modules/scanned-files/*`: scanned file CRUD/stats/batch operations
- `src/modules/symlink/*`: symlink create/recreate/cleanup behavior
- `src/modules/realtime/*`: WebSocket hub and event broadcasting

## Boot Sequence
1. Load env variables (`src/config/env.ts`).
2. Initialize logger + log folder.
3. Ensure/read `config/config.yml` via `ConfigStore`.
4. Initialize SQLite + Drizzle schema (`src/db/client.ts`).
5. Create services (TMDb client, repo, WS hub, poller).
6. Start poller and runtime jobs.
7. Start HTTP + WS server (`Bun.serve`).

## Entrypoint Registry
- `src/app/entrypoints.ts` is the single source of truth for:
  - all HTTP endpoint paths
  - all path-pattern routes with params
  - WebSocket upgrade endpoint paths
- Route modules import entrypoint constants instead of hardcoding path strings.
- Server WS upgrade checks import the same constants to keep HTTP and WS entrypoints aligned.

### Entrypoint Consolidation Plan
1. Add any new endpoint path only in `src/app/entrypoints.ts` first.
2. Reference constants from route modules (`src/modules/**/**-routes.ts`) exclusively.
3. Keep route mounting centralized in `src/app/router.ts`.
4. Avoid direct string literals for endpoint paths elsewhere in `src/`.

## Configuration Integration
- Config file path defaults to `backend-bun/config/config.yml`.
- Missing config file is auto-created with defaults.
- `PUT /api/config` validates the payload with Zod.
- On config update:
  - TMDb client is recreated with the new API key.
  - poller restarts to apply new intervals/mappings.

## Database Integration
- Backend uses SQLite + Drizzle.
- Existing `ScannedFiles` schema is created if missing.
- New TV identity tables are also created if missing:
  - `series_identity_map`
  - `series_aliases`
- SQLite runtime pragmas used:
  - `journal_mode = WAL`
  - `busy_timeout = 5000`

## Ingestion Integration (Poll Only)
There is no file watcher. Ingestion runs only on interval polling.

Flow per poll cycle:
1. Load current config.
2. Abort if TMDb API key is missing/placeholder.
3. Abort if Zurg version file does not exist.
4. For each folder mapping, recursively collect media files.
5. Process files with bounded concurrency (currently 8 workers).
6. For each file:
   - create or reuse `ScannedFiles` row
   - detect media and metadata
   - resolve TMDb
   - create symlink
   - persist status and emit realtime events

### Supported media extensions
`.mkv`, `.mp4`, `.avi`, `.m4v`, `.ts`, `.mov`, `.wmv`

## TV Detection Integration
TV flow is hybrid and file-first:
1. Parse season/episode from filename patterns (`SxxEyy`, `NxM`, and episode ranges).
2. Build title candidates from:
   - filename title hint
   - parent folder
   - grandparent folder
3. Normalize candidates and optional year hint.
4. Resolve series identity with `SeriesIdentityService`:
   - alias lookup in `series_aliases`
   - canonical lookup in `series_identity_map`
   - TMDb search fallback if no local hit
5. Persist aliases for future fast matching.

This keeps episode parsing file-based while still using folder context to stabilize TMDb mapping across inconsistent release names.

## Realtime Integration
- Transport: native WebSocket endpoint `/ws/filetracking`.
- Event envelope:
  - `{ "type": "<event>", "payload": <data> }`
- Event types:
  - `file.added`
  - `file.updated`
  - `file.removed`
  - `heartbeat`
  - `zurg.version`

Runtime jobs emit heartbeat and zurg signals every 30 seconds.

## Logging Integration
- Structured JSON logs are written to `logs/log-YYYY-MM-DD.json`.
- Endpoint `/api/logs` reads those files in reverse order and applies filters.

## Current Limitations
- No auth/authz layer yet.
- No OpenAPI generation yet.
- Cache invalidation endpoints are coarse (`DELETE /api/medialookup/cache*` invalidates all TMDb cache).
- Poller currently skips work when TMDb key is placeholder, but manual media lookup requests can still fail with TMDb 401.
