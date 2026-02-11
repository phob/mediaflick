# Bun Backend Redesign Plan

## Scope
- Build a new backend in `backend-bun/` while keeping the current .NET backend untouched during migration.
- Use Bun + TypeScript + Drizzle + SQLite.
- Replace SignalR with plain WebSockets.
- Preserve current API behavior where practical, then evolve with the frontend rewrite.
- Implement hybrid TV detection:
  - file-first parsing for season/episode
  - title resolution from filename, then folder fallback
  - cached TMDb series identity mapping

## Goals
- Feature parity with the current backend for scanning, metadata enrichment, symlink operations, and API operations.
- Better maintainability and simpler deployment.
- Good throughput for large file batches without unbounded concurrency.

## Proposed Stack
- Runtime: Bun (`Bun.serve`) + Hono (HTTP routing/middleware)
- Language: TypeScript (strict)
- DB: SQLite (`bun:sqlite`) + Drizzle ORM + Drizzle migrations
- Validation: Zod
- Logging: JSON logs (pino-style output)
- Realtime: native WebSocket endpoint
- File scanning: periodic polling

## Directory Blueprint
```text
backend-bun/
  src/
    app/
      server.ts
      router.ts
      middleware.ts
    config/
      env.ts
      runtime-config.ts
      yaml-config.ts
    db/
      client.ts
      schema.ts
      migrations/
    modules/
      scanned-files/
      media-lookup/
      symlink/
      logs/
      file-ingest/
      realtime/
      detection/
    shared/
      types.ts
      errors.ts
      utils/
  drizzle.config.ts
  package.json
  tsconfig.json
```

## Data Model Plan
### Keep/port existing `ScannedFiles`
- Match current columns and enum values.
- Preserve index strategy:
  - `SourceFile`
  - `DestFile`
  - `TmdbId`
  - unique composite `(SourceFile, DestFile, EpisodeNumber)`

### Add TV identity tables
- `series_identity_map`
  - `id`
  - `normalized_title` (required)
  - `year` (nullable)
  - `tmdb_id` (required)
  - `imdb_id` (nullable)
  - `canonical_title` (required)
  - `created_at`, `updated_at`, `last_verified_at`
- `series_aliases`
  - `id`
  - `identity_id` (FK)
  - `alias_raw` (required)
  - `alias_normalized` (required, indexed)
  - unique `(identity_id, alias_normalized)`

## API Parity Plan (Phase 1)
- `GET/PUT /api/config`
- `GET /api/logs`
- `GET /api/medialookup/*`
- `GET/PATCH/DELETE /api/scannedfiles/*`
- `POST /api/scannedfiles/recreate-symlinks`
- `POST /api/symlink/cleanup`

## Realtime Plan
- WebSocket endpoint: `/ws/filetracking`
- Outbound events:
  - `file.added`
  - `file.updated`
  - `file.removed`
  - `heartbeat`
  - `zurg.version`

## Ingestion Pipeline Plan
1. Discover files (periodic poll).
2. Push into bounded queue (deduplicate by full path).
3. Compute file metadata (size/hash as needed).
4. Detect media type + parsed info.
5. Resolve TMDb metadata (cache + retry + backoff).
6. Upsert `ScannedFiles` with conflict handling.
7. Create/update symlink and cleanup stale links.
8. Emit WS event.

## TV Detection Strategy (Hybrid)
1. Parse episode info from filename (`SxxEyy`, multi-episode variants).
2. Build title candidates:
   - filename-derived series title
   - parent folder-derived title
3. Normalize candidates (punctuation/quality/release-token stripping).
4. Resolve identity:
   - alias cache lookup
   - `series_identity_map` lookup
   - TMDb search on miss
5. Persist/refresh alias mappings.
6. Use resolved TMDb ID + season/episode for episode metadata.

## Performance Guardrails
- Bounded worker pool (configurable, default conservative).
- Avoid unbounded `Promise.all`.
- Batch DB writes where safe.
- In-flight TMDb request coalescing for same key.
- Polling interval tuned for ingestion latency and stability.

## Milestones
1. Scaffold backend-bun project + basic server + health endpoint.
2. Drizzle schema + migrations for `ScannedFiles` parity.
3. Config + logs modules.
4. TMDb client + cache + media lookup endpoints.
5. Scanned files CRUD/stats/batch operations.
6. Symlink module + cleanup/recreate flows.
7. Ingestion pipeline (poll + workers).
8. TV hybrid detection + identity map.
9. WebSocket event broadcasting.
10. Parity testing and performance baseline.

## Definition of Done
- Core endpoints functional with expected payloads.
- End-to-end scan -> detect -> TMDb -> DB -> symlink -> WS flow working.
- TV detection behaves correctly for mixed naming patterns.
- No major regressions against current backend behavior for key workflows.
