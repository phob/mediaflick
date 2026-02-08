# API Reference

Base URL examples:
- local: `http://localhost:5000`

All endpoints return JSON (except `OPTIONS` preflight), and CORS is enabled for all origins.

## Health

### `GET /`
Returns a simple service message.

### `GET /health`
Returns liveness data:
```json
{ "ok": true, "ts": 1739030000000 }
```

## Configuration

### `GET /api/config`
Returns current runtime config.

### `PUT /api/config`
Replaces runtime config, validates payload, recreates TMDb client, and restarts poller.

Request body shape:
```json
{
  "plex": {
    "host": "localhost",
    "port": 32400,
    "plexToken": "",
    "pollingInterval": 60,
    "processNewFolderDelay": 30,
    "folderMappings": [
      {
        "sourceFolder": "/mnt/zurg/movies",
        "destinationFolder": "/mnt/organized/movies",
        "mediaType": "Movies"
      }
    ]
  },
  "tmDb": {
    "apiKey": "..."
  },
  "mediaDetection": {
    "cacheDuration": 3600,
    "autoExtrasThresholdBytes": 104857600
  },
  "zurg": {
    "versionLocation": "/mnt/zurg/version.txt"
  }
}
```

Validation notes:
- `folderMappings` must contain at least 1 mapping.
- `mediaDetection.autoExtrasThresholdBytes` max is `1073741824`.

## Logs

### `GET /api/logs`
Query params:
- `minLevel` (`Verbose|Debug|Information|Warning|Error|Fatal`)
- `searchTerm` (case-insensitive message filter)
- `from` (ISO timestamp)
- `to` (ISO timestamp)
- `limit` (1..1000, default 100)

Response:
```json
{
  "logs": [
    {
      "Timestamp": "2026-02-08T12:00:00.000Z",
      "Level": "Information",
      "RenderedMessage": "Bun backend started",
      "Properties": { "port": 5000 }
    }
  ]
}
```

## Media Lookup

### `GET /api/medialookup/movies/search?title=...`
Returns:
```json
[
  {
    "tmdbId": 603,
    "title": "The Matrix",
    "year": 1999,
    "posterPath": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
  }
]
```

### `GET /api/medialookup/tvshows/search?title=...`
Same shape as movie search, `title` mapped from TV `name`.

### `GET /api/medialookup/movies/:tmdbId`
Returns `MediaInfo` for a movie.

### `GET /api/medialookup/tvshows/:tmdbId`
Returns `MediaInfo` for a TV show, including `episodeCount`, `episodeCountScanned`, `seasonCount`.

### `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber`
Returns `SeasonInfo` with episode list and `isScanned` flags.

### `GET /api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber`
Returns episode details.

### `GET /api/medialookup/images/:path?size=w500`
Returns a string URL to TMDb image CDN.

### `DELETE /api/medialookup/cache*`
Current implementation invalidates all in-memory TMDb cache.

## Scanned Files

## Common Object: `ScannedFile`
```json
{
  "id": 1,
  "sourceFile": "/mnt/zurg/tv/Show.S01E01.mkv",
  "destFile": "/mnt/organized/tv/Show (2023)/Season 01/Show - S01E01 - Pilot.mkv",
  "fileSize": 123456789,
  "fileHash": null,
  "mediaType": "TvShows",
  "tmdbId": 123,
  "imdbId": "tt1234567",
  "title": "Show",
  "year": 2023,
  "genres": ["Drama"],
  "seasonNumber": 1,
  "episodeNumber": 1,
  "episodeNumber2": null,
  "status": "Success",
  "createdAt": "2026-02-08T12:00:00.000Z",
  "updatedAt": "2026-02-08T12:01:00.000Z",
  "versionUpdated": 0,
  "updateToVersion": 1
}
```

### `GET /api/scannedfiles`
Query params:
- `status`
- `mediaType`
- `searchTerm`
- `sortBy`
- `sortOrder` (`asc|desc`)
- `page` (default 1)
- `pageSize` (default 30)
- repeated `ids` query params (e.g. `?ids=1&ids=2`)

Response:
```json
{
  "items": ["...ScannedFile..."],
  "totalItems": 100,
  "page": 1,
  "pageSize": 30,
  "totalPages": 4
}
```

### `GET /api/scannedfiles/:id`
Returns a single `ScannedFile` or `404`.

### `PATCH /api/scannedfiles/:id`
Partial update body:
```json
{
  "tmdbId": 123,
  "seasonNumber": 1,
  "episodeNumber": 2,
  "episodeNumber2": 3,
  "mediaType": "TvShows"
}
```

### `DELETE /api/scannedfiles/:id`
Deletes row + removes symlink if present.

### `DELETE /api/scannedfiles/batch`
Body can be:
- array: `[1,2,3]`
- object: `{ "ids": [1,2,3] }`

Deletes rows, removes symlinks, broadcasts `file.removed`, runs destination cleanup.

### `DELETE /api/scannedfiles?ids=1,2,3`
Alternative delete path using comma-separated query ids.

### `GET /api/scannedfiles/stats`
Returns:
- `totalFiles`
- `totalSuccessfulFiles`
- `totalFileSize`
- `totalSuccessfulFileSize`
- grouped counts in `byStatus` and `byMediaType`

### `GET /api/scannedfiles/tmdb-ids-and-titles`
Query params:
- `mediaType`
- `searchTerm`

Returns distinct successful TMDb/title tuples.

### `PATCH /api/scannedfiles/:id/recreate-symlink`
Rebuilds destination symlink for one row.

### `POST /api/scannedfiles/recreate-symlinks`
Rebuilds symlinks for all successful rows with destination values.

## Symlink Management

### `POST /api/symlink/cleanup`
Runs dead symlink + empty directory cleanup for all configured destination folders.

Response:
```json
{ "message": "Symlink cleanup completed" }
```

## Realtime WebSocket

### Connect
- URL: `/ws/filetracking`

### Message envelope
```json
{
  "type": "file.updated",
  "payload": { "...": "..." }
}
```

### Event types
- `file.added` -> payload is `ScannedFile`
- `file.updated` -> payload is `ScannedFile`
- `file.removed` -> payload is `ScannedFile`
- `heartbeat` -> payload is unix milliseconds number
- `zurg.version` -> payload is unix milliseconds number

## Error Behavior
- Validation/body issues: `400` with `{ "error": "..." }`
- Not found: `404` with `{ "error": "Not found" }`
- Unsupported method on known config route: `405`
- Unhandled failures: `500` with `{ "error": "Internal server error" }`
