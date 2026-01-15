# Changelog

All notable changes to MediaFlick will be documented in this file.

## [v0.1.7] - 2025-01-14

### Added
- **Extras Categorization**: Automatic classification of small undetected media files as "Extras" based on configurable file size threshold
- **Settings UI**: Admin controls for configuring auto-extras threshold (MediaDetectionOptions.AutoExtrasThresholdBytes)
- **Media Type Conversion**: UI actions to convert files between Movies, TvShows, and Extras in file listing
- **AlertDialog Component**: Added @radix-ui/react-alert-dialog for confirmation dialogs

### Changed
- **Docker Runtime**: Migrated from Node.js to Bun runtime for improved performance
- **Logging Verbosity**: Reduced production noise by changing frequent operations to Debug level (media lookup, scanned files retrieval, CORS, heartbeat)
- **UpdateScannedFileRequest**: Extended API to support MediaType field changes
- **Symlink Behavior**: Extras files now skip symlink creation to avoid cluttering organized directories
- **Documentation**: Updated CLAUDE.md with correct directory paths (frontend/, backend/)

### Fixed
- **SignalR Memory Leak**: Resolved proxy middleware memory leak by creating middleware instance once
- **Next.js Cache Permissions**: Fixed Docker cache permission errors by adding volume mount for .next/cache
- **EditModal MediaType Switching**: Fixed bugs when converting files between media types, properly clearing TMDb fields when converting to Extras
- **File Re-processing**: Files converted from Extras to Movies/TvShows now trigger re-detection pipeline

## [v0.1.6-0] - 2025-01-13

### Added
- **Dashboard**: New unified dashboard with stats cards and recent items display
- **AGENTS.md**: Comprehensive development guide for AI coding agents with commands, code style guidelines, and conventions
- **Infinite Scroll**: Auto-pagination with Intersection Observer for media grids (loads 30 items initially)
- **Article-Aware Sorting**: Intelligent title sorting that ignores leading articles ("The", "A", "An")
- **Custom Server**: Node.js server with http-proxy-middleware for proper SignalR WebSocket support

### Changed
- **Directory Structure**: Restructured project from `src/` → `backend/` and `mediaflick/` → `frontend/` for clarity
- **Package Manager**: Migrated from pnpm to Bun for faster builds and installs
- **Dockerfile**: Updated to use `oven/bun:1-alpine` for frontend build stage
- **Docker Compose**: Backend now binds to `0.0.0.0` for container networking, added cache volume
- **Next.js Config**: Enabled standalone output mode with unoptimized images and aggressive cache headers
- **Movie Regex**: Improved BasicMovieRegexPattern for better filename parsing with flexible title matching and stricter year validation (19xx or 20xx)

### Fixed
- **React Hooks**: Eliminated setState-in-useEffect violations by using lazy state initialization and useMemo patterns
- **HeadButtonLink**: Updated to use useEffect for dynamic href handling
- **ESLint**: Updated configuration and improved package.json formatting
- **GitHub Workflows**: Updated publish and test workflows for new directory structure
- **Dependabot**: Updated configuration to use Bun and new directory paths
- **Logging**: Removed info-level console logging (console.log, console.info, console.warn), kept console.error

### Removed
- **EpisodeCard Component**: Removed 114-line duplicate implementation in favor of unified MediaCard
- **card-utils**: Deleted helper module replaced by MediaCard episode properties
- **SignalR API Route**: Removed Next.js API route handler in favor of custom server
- **Pagination Component**: Replaced with infinite scroll for seamless browsing

## [v0.1.5] - 2025-01-13

### Fixed
- Version bump and badge URLs in README.md
- Frontend artifact path in publish workflow

## [v0.1.4] - 2025-01-13

### Added
- NormalizeTitle method to clean movie titles
- Timezone environment variable for mediaflick service

### Changed
- Docker compose configuration for mediaflick and zurg services
- Enhanced CSS comments and normalized search query in MediaSearch component

## [v0.1.3] - Previous Release

_(Earlier changes not documented)_
