# Bulk Identify & Reassign — Progress

## Goal

Build a complete media identification and reassignment system for the MediaFlick app. Users need to be able to:

1. Mass-identify unidentified files as TV shows or movies (e.g., 400 unidentified episodes assigned to a show with minimal effort)
2. Reassign wrongly-recognized TV shows from the TV Show detail page
3. Reassign wrongly-recognized movies from the Movie detail page
4. Edit season/episode numbers with smart auto-fill from filename parsing
5. Update series identity/alias mappings so future scans pick the correct show

## Constraints

- All new frontend code in `frontend-solid/` (SolidJS), not the legacy `frontend/` (React/Next.js)
- All new backend code in `backend-bun/` (Bun + Hono + Drizzle + SQLite)
- Frontend-solid uses single-file architecture: everything in `src/app.tsx`
- Use `useQuery`/`useMutation` (NOT deprecated `createQuery`/`createMutation`) for TanStack Query v5
- No semicolons, double quotes in frontend-solid code style
- Package manager is Bun only
- Backend must use `ENTRYPOINTS` constants for route strings, never inline
- Bulk update endpoint uses dry-run + apply pattern
- Per-file updates (each file can have different season/episode numbers in one request)
- Filename parser must handle multi-episodes like `S01E01E02` (distinct from `S01E01-E02` range)
- Batch handler processes file updates in chunks of 50, symlink recreation in chunks of 10

## Discoveries

- The app had no existing bulk PATCH endpoint; individual `PATCH /api/scannedfiles/:id` was called N times in parallel by the legacy frontend
- `SeriesIdentityService` had `upsertIdentity()` and `addAliases()` as private methods; `addAliases()` has a 0.8 similarity threshold that would reject dissimilar manual aliases — we added `addAliasForced()` to bypass this for user-initiated reassignment
- `recreateSingleSymlink()` re-fetches full TMDb metadata and builds the symlink path fresh, so after changing tmdbId the symlinks get correct names automatically
- The `ScannedFile` type in frontend-solid omits `posterPath` and `versionUpdated`/`updateToVersion` fields that exist in backend-bun's type
- `AppContext` has `db` and `tmdb` fields needed to instantiate `SeriesIdentityService` in route handlers
- Unidentified page already groups files by source directory and media type — this grouping is leveraged for the "select all in group" UX

## Status: COMPLETE

All implementation is done and passing typecheck + build.

### Backend (all done)

- **`src/shared/types.ts`** — Added 7 bulk update types: `BulkUpdateItem`, `IdentityUpdatePayload`, `BulkUpdateRequest`, `BulkUpdateConflict`, `BulkUpdateDryRunResponse`, `BulkUpdateApplyResponse`
- **`src/app/entrypoints.ts`** — Added `batchUpdate` route constant
- **`src/modules/detection/series-identity-service.ts`** — Added public `countForTmdbId()`, `reassignIdentity()`, private `addAliasForced()`; added `count`, `inArray` imports from drizzle-orm
- **`src/modules/scanned-files/scanned-files-routes.ts`** — Added `PATCH /api/scannedfiles/batch-update` route handler (~100 lines) with dry-run + apply modes, chunked processing, identity update support

### Frontend (all done)

- **`src/lib/filename-parser.ts`** — Created: `parseEpisodeInfo()` with 10-tier regex cascade (S01E01E02 multi-ep, S01E01-E05 range, standard SxxExx, NxNN, verbose, spaced, bare digits, bare number) + `cleanForTitle()` for movie search
- **`src/lib/types.ts`** — Added `MediaSearchResult`, `BulkUpdateItem`, `IdentityUpdatePayload`, `BulkUpdateRequest`, `BulkUpdateConflict`, `BulkUpdateDryRunResponse`, `BulkUpdateApplyResponse`, `UpdateScannedFileRequest`
- **`src/lib/api.ts`** — Added 6 new API methods: `searchMovies`, `searchTvShows`, `updateScannedFile`, `batchUpdate`, `recreateSymlink`, `recreateAllSymlinks`
- **`src/app.tsx`** — Added `TmdbSearchInput` component (debounced search with poster dropdown), `IdentifyModal` component (TV mode with shared search + editable table with auto-increment; Movie mode with per-row search pre-populated from filename parser; Preview/Save buttons); modified `UnidentifiedPage` (selection + action bar + modal), `TvShowDetailsPage` (reassign button + modal), `MovieDetailsPage` (reassign button + modal)

### Validation

- `backend-bun`: `bun run typecheck` — clean
- `frontend-solid`: `bun run typecheck` — clean, `bun run build` — clean (145.99 kB JS bundle)

## Potential Future Work (not requested yet)

- End-to-end manual testing with a running backend
- Keyboard navigation in TmdbSearchInput dropdown (arrow keys + Enter)
- Progress indicator during batch save (showing N/total)
- Redirect to new show/movie detail page after reassignment

## Files Changed

### Backend (`backend-bun/`)

| File | Change |
|------|--------|
| `src/shared/types.ts` | Added bulk update types |
| `src/app/entrypoints.ts` | Added `batchUpdate` route constant |
| `src/modules/detection/series-identity-service.ts` | Added `countForTmdbId()`, `reassignIdentity()`, `addAliasForced()` |
| `src/modules/scanned-files/scanned-files-routes.ts` | Added batch-update route handler |

### Frontend (`frontend-solid/`)

| File | Change |
|------|--------|
| `src/lib/filename-parser.ts` | **New** — filename parsing with 10-tier regex cascade |
| `src/lib/types.ts` | Added bulk update + search result types |
| `src/lib/api.ts` | Added 6 new API methods |
| `src/app.tsx` | Added TmdbSearchInput, IdentifyModal; modified UnidentifiedPage, TvShowDetailsPage, MovieDetailsPage |
