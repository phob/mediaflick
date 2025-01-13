# PlexLocalScan.Api Technical Documentation

## Overview

PlexLocalScan.Api is a RESTful API service that manages media file scanning and organization for Plex media servers. It provides endpoints for media detection, file tracking, and symlink management.

## Core Components

### Media Models

#### MediaInfo

The central model for media information containing:

- `Title`: Media title
- `Year`: Release year
- `TmdbId`: TMDb identifier
- `ImdbId`: IMDb identifier
- `MediaType`: Type of media (Movies/TvShows)
- `SeasonNumber`: Season number for TV shows
- `EpisodeNumber`: Episode number for TV shows
- `EpisodeTitle`: Episode title for TV shows
- `EpisodeTmdbId`: TMDb ID for specific episodes
- `PosterPath`: Path to media poster
- `Summary`: Media description
- `Status`: Current status
- `Seasons`: List of seasons (for TV shows)

#### SeasonInfo

Contains TV show season information:

- `SeasonNumber`: Season number
- `Name`: Season name
- `Overview`: Season description
- `PosterPath`: Path to season poster
- `AirDate`: Season air date
- `Episodes`: List of episodes in the season

#### EpisodeInfo

Contains TV episode information:

- `EpisodeNumber`: Episode number
- `Name`: Episode title
- `Overview`: Episode description
- `StillPath`: Path to episode still image
- `AirDate`: Episode air date
- `TmdbId`: TMDb ID for the episode

## API Endpoints

### Media Lookup Controller

#### Search Endpoints

- `GET /api/medialookup/movies/search?title={title}`

  - Searches for movies by title
  - Returns: List of `MediaSearchResult`

- `GET /api/medialookup/tvshows/search?title={title}`
  - Searches for TV shows by title
  - Returns: List of `MediaSearchResult`

#### Movie Endpoints

- `GET /api/medialookup/movies/{tmdbId}`
  - Gets detailed movie information by TMDb ID
  - Returns: `MediaInfo`

#### TV Show Endpoints

- `GET /api/medialookup/tvshows/{tmdbId}`

  - Gets detailed TV show information
  - Returns: `MediaInfo`

- `GET /api/medialookup/tvshows/{tmdbId}/seasons/{seasonNumber}`

  - Gets specific season information
  - Returns: `SeasonInfo`

- `GET /api/medialookup/tvshows/{tmdbId}/seasons/{seasonNumber}/episodes/{episodeNumber}`
  - Gets specific episode information
  - Returns: `EpisodeInfo`

### Scanned Files Controller

#### Models

##### ScannedFile

```json
{
  "id": 1,
  "sourceFile": "string",
  "destFile": "string",
  "mediaType": "Movies|TvShows|Unknown",
  "tmdbId": 123,
  "imdbId": "tt1234567",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "status": "Processing|Success|Failed",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "versionUpdated": 0,
  "updateToVersion": 0
}
```

##### PagedResult<ScannedFile>

```json
{
    "items": [ScannedFile],
    "totalItems": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
}
```

##### UpdateScannedFileRequest

```json
{
  "tmdbId": 123,
  "seasonNumber": 1,
  "episodeNumber": 1
}
```

#### Endpoints

##### List Scanned Files

- `GET /api/scannedfiles`
  - Parameters:
    - `filter.status`: FileStatus (Processing|Success|Failed)
    - `filter.mediaType`: MediaType (Movies|TvShows|Unknown)
    - `filter.searchTerm`: String to search in source/dest files
    - `filter.sortBy`: Field to sort by
    - `filter.sortOrder`: asc|desc
    - `page`: Page number (default: 1)
    - `pageSize`: Items per page (default: 10)
  - Returns: `PagedResult<ScannedFile>`
  - Response codes:
    - 200: Success

##### Get Single Scanned File

- `GET /api/scannedfiles/{id}`
  - Parameters:
    - `id`: Scanned file ID
  - Returns: `ScannedFile`
  - Response codes:
    - 200: Success
    - 404: File not found

##### Update Scanned File

- `PATCH /api/scannedfiles/{id}`
  - Parameters:
    - `id`: Scanned file ID
    - Body: `UpdateScannedFileRequest`
  - Returns: Updated `ScannedFile`
  - Response codes:
    - 200: Success
    - 400: Invalid request
    - 404: File not found
  - Notes:
    - Only updates provided fields
    - Automatically updates `updatedAt` and `updateToVersion`

##### Recreate Symlink

- `PATCH /api/scannedfiles/{id}/recreate-symlink`
  - Parameters:
    - `id`: Scanned file ID
  - Returns: Updated `ScannedFile`
  - Response codes:
    - 200: Success
    - 400: Symlink creation failed
    - 404: File not found

##### Delete Single Scanned File

- `DELETE /api/scannedfiles/{id}`
  - Parameters:
    - `id`: Scanned file ID
  - Response codes:
    - 204: Success
    - 404: File not found
  - Notes:
    - Deletes both database entry and destination symlink
    - Cleans up empty directories

##### Batch Delete Scanned Files

- `DELETE /api/scannedfiles/batch`
  - Body: Array of file IDs `[1, 2, 3]`
  - Response codes:
    - 204: Success
    - 400: Invalid request
  - Notes:
    - Deletes multiple files and symlinks in one operation
    - Groups operations by media type for efficient cleanup
    - Cleans up empty directories after deletion

### Symlink Controller

#### Symlink Management

- `POST /api/symlink/cleanup`
  - Cleans up dead symlinks and empty folders
  - Returns: Cleanup status message

## Configuration

### Required Settings

```json
{
  "Plex": {
    "Host": "localhost",
    "Port": 32400,
    "PlexToken": "your-plex-token",
    "FolderMappings": [
      {
        "SourceFolder": "/path/to/source",
        "DestinationFolder": "/path/to/destination",
        "MediaType": "Movies|TvShows"
      }
    ],
    "PollingInterval": 30,
    "ProcessNewFolderDelay": 5
  },
  "TMDb": {
    "ApiKey": "your-tmdb-api-key"
  },
  "MediaDetection": {
    "MoviePattern": "^(?<title>.+?)[\\. \\[]?(?<year>\\d{4}).*\\.(mkv|mp4|avi)$",
    "TvShowPattern": "^(?<title>.+?)[\\. \\[]?[Ss](?<season>\\d{1,2})[\\. \\[]?[eE](?<episode>\\d{1,2})?[-]?(?:[-eE](?<episode2>\\d{1,2}))?.*\\.(mkv|mp4|avi)$",
    "TitleCleanupPattern": "^(?<title>.+?)(?:\\s\\(?(?<year>\\d{4})\\)?)?s?[-\\s]*$",
    "CacheDuration": "24:00:00"
  },
  "Database": {
    "ConnectionString": "Data Source=plexlocalscan.db"
  }
}
```

## Dependencies

- .NET 8.0
- Entity Framework Core 9.0.0
- SQLite Database
- TMDb API
- Serilog for logging
- Scalar for API documentation

## Error Handling

The API implements global exception handling middleware that returns:

- 500 Internal Server Error for unhandled exceptions
- Detailed error messages in development environment
- Generic error messages in production

## Development Setup

1. Install .NET 8.0 SDK
2. Configure appsettings.json with required settings
3. Run database migrations
4. Start the API using `dotnet run`

The API will be available at `http://localhost:5000` by default.

## API Documentation

When running in development mode, API documentation is available at:

- OpenAPI JSON: `/openapi/v1.json`
- Scalar UI: `/scalar/v1`
