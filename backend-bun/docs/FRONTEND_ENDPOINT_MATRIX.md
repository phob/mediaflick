# Frontend Endpoint Matrix

This is the screen-by-screen backend contract for frontend redesign.

## Base URL Strategy
- Direct backend: `http://<host>:5000`
- Existing frontend proxy style (legacy): `/api/proxy/<endpoint-without-leading-api>`
- Backend endpoints below are listed as canonical backend paths (for direct calls).

## Realtime Strategy
- WebSocket endpoint: `/ws/filetracking`
- Envelope:
```json
{ "type": "file.updated", "payload": { "...": "..." } }
```
- Event types:
  - `file.added`
  - `file.updated`
  - `file.removed`
  - `heartbeat`
  - `zurg.version`

## Screen Matrix

| Screen | Purpose | Endpoint(s) | Notes |
|---|---|---|---|
| Dashboard | KPI cards + recent lists | `GET /api/scannedfiles/stats`, `GET /api/scannedfiles` | Recent lists use `sortBy=createdAt&sortOrder=desc`; TV card count currently derived client-side from list dedupe by `tmdbId`. |
| Media Library | Main file table + filters + actions | `GET /api/scannedfiles`, `GET /api/scannedfiles/:id`, `PATCH /api/scannedfiles/:id`, `DELETE /api/scannedfiles/:id`, `DELETE /api/scannedfiles/batch`, `POST /api/scannedfiles/recreate-symlinks`, `PATCH /api/scannedfiles/:id/recreate-symlink`, `GET /api/config` | Table updates should react to WS file events. |
| Media Info Grid | Browse unique media cards | `GET /api/scannedfiles/tmdb-ids-and-titles` | Query by `mediaType` + optional `searchTerm`. |
| Movie Details | Detail page for one movie | `GET /api/medialookup/movies/:tmdbId`, `GET /api/medialookup/movies/:tmdbId/files`, `PATCH /api/scannedfiles/:id` | `/files` includes same-folder related entries for extras UX; patching `mediaType=Extras` removes symlink + clears metadata. |
| TV Show Details | Detail page for show + season list | `GET /api/medialookup/tvshows/:tmdbId`, `GET /api/medialookup/tvshows/:tmdbId/files`, `GET /api/medialookup/tvshows/:tmdbId/episode-groups`, `PUT /api/medialookup/tvshows/:tmdbId/episode-group`, `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber`, `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber` | Group change triggers remove/re-add + symlink recreation; `/files` includes alias-linked uncategorized items. |
| Search Modal | Manual TMDb picking | `GET /api/medialookup/movies/search?title=...`, `GET /api/medialookup/tvshows/search?title=...` | Debounce input in UI (existing behavior uses 250ms). |
| Settings Modal | Edit Plex/TMDb/Zurg/media-detection config | `GET /api/config`, `PUT /api/config` | `PUT` restarts poller and swaps TMDb client immediately. |
| Logs | Log viewer + filters | `GET /api/logs` | Supports `minLevel`, `searchTerm`, `from`, `to`, `limit`. |
| Admin Cache | Cache invalidate/inspect | `DELETE /api/medialookup/cache*` | Current implementation clears all TMDb cache for any `/cache` delete path. |
| Connectivity Indicators | Backend and Zurg health chips | WS `heartbeat`, WS `zurg.version` | Both are emitted every 30s. |

## Endpoint Details by Screen

## 1) Dashboard

### `GET /api/scannedfiles/stats`
- Response fields used by UI:
  - `totalFiles`
  - `totalSuccessfulFiles`
  - `totalFileSize`
  - `totalSuccessfulFileSize`
  - `byStatus[]`
  - `byMediaType[]`

### `GET /api/scannedfiles`
- For recent content:
  - `mediaType=Movies|TvShows`
  - `page=1`
  - `pageSize=<N>`
  - `sortBy=createdAt`
  - `sortOrder=desc`

## 2) Media Library

### `GET /api/scannedfiles`
- Query params:
  - `status`, `mediaType`, `searchTerm`, `sortBy`, `sortOrder`, `page`, `pageSize`
  - repeated `ids` supported (`...&ids=1&ids=2`)

### `PATCH /api/scannedfiles/:id`
- Body (partial):
```json
{
  "tmdbId": 123,
  "seasonNumber": 1,
  "episodeNumber": 2,
  "episodeNumber2": 3,
  "mediaType": "TvShows"
}
```

### Delete/Recreate operations
- `DELETE /api/scannedfiles/:id`
- `DELETE /api/scannedfiles/batch` with `[1,2,3]` or `{ "ids": [1,2,3] }`
- `PATCH /api/scannedfiles/:id/recreate-symlink`
- `POST /api/scannedfiles/recreate-symlinks`

### Realtime invalidation
- Subscribe to:
  - `file.added`
  - `file.updated`
  - `file.removed`

## 3) Media Info (Grid and Detail)

### Grid source
- `GET /api/scannedfiles/tmdb-ids-and-titles`
- Query:
  - `mediaType`
  - `searchTerm` (optional)

### Detail source
- Movies: `GET /api/medialookup/movies/:tmdbId`
- Movie files: `GET /api/medialookup/movies/:tmdbId/files`
- TV show: `GET /api/medialookup/tvshows/:tmdbId`
- TV files: `GET /api/medialookup/tvshows/:tmdbId/files`
- TV episode groups: `GET /api/medialookup/tvshows/:tmdbId/episode-groups`
- TV episode group selection/rebuild: `PUT /api/medialookup/tvshows/:tmdbId/episode-group`
- Season: `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber`
- Episode: `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber`

## 4) Search Modal

### Movie search
- `GET /api/medialookup/movies/search?title=<query>`

### TV search
- `GET /api/medialookup/tvshows/search?title=<query>`

### Result item
```json
{
  "tmdbId": 123,
  "title": "Show Name",
  "year": 2023,
  "posterPath": "/path.jpg"
}
```

## 5) Settings

### `GET /api/config`
- Returns complete editable config payload.

### `PUT /api/config`
- Replaces config.
- Validation errors return `400` with issue details.

## 6) Logs

### `GET /api/logs`
- Query:
  - `minLevel`
  - `searchTerm`
  - `from`
  - `to`
  - `limit` (1..1000)

## 7) Admin Cache

### Current support
- `DELETE /api/medialookup/cache*` (wildcard path match)
  - currently invalidates entire TMDb cache regardless of subpath.

### Frontend planning note
- If you want strict per-action UX (movie-only, tv-only, search-only), define explicit endpoints in backend next phase:
  - `DELETE /api/medialookup/cache/movies/:tmdbId`
  - `DELETE /api/medialookup/cache/tvshows/:tmdbId`
  - `DELETE /api/medialookup/cache/search?title=...&mediaType=...`
  - `GET /api/medialookup/cache/stats`

## Realtime UI Mapping

| Event | Suggested UI behavior |
|---|---|
| `file.added` | Insert row/card optimistically if current filters match. |
| `file.updated` | Replace row/card in place and re-evaluate filters/sort. |
| `file.removed` | Remove row/card and decrement totals. |
| `heartbeat` | Mark backend online/offline based on timeout. |
| `zurg.version` | Mark Zurg source online/offline based on timeout. |

## Response/Error Conventions
- Success payloads are JSON objects/arrays.
- Typical error payload:
```json
{ "error": "message" }
```
- Status codes used now: `200`, `204` (OPTIONS), `400`, `404`, `405`, `500`.

## Contract Stability Notes
- Routes listed here are implemented now in `backend-bun`.
- For frontend rewrite, you can treat these as v1 contract.
- Known coarse behavior: cache invalidation path granularity is not yet strict (see Admin Cache note).
