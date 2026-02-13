export const ENTRYPOINTS = {
  root: "/",
  health: "/health",
  ws: {
    filetracking: "/ws/filetracking",
  },
  api: {
    config: "/api/config",
    logs: "/api/logs",
    mediaLookup: {
      base: "/api/medialookup",
      movieSearch: "/api/medialookup/movies/search",
      tvSearch: "/api/medialookup/tvshows/search",
      movieByTmdbId: "/api/medialookup/movies/:tmdbId",
      tvByTmdbId: "/api/medialookup/tvshows/:tmdbId",
      tvEpisodeGroupsByTmdbId: "/api/medialookup/tvshows/:tmdbId/episode-groups",
      tvEpisodeGroupSelectionByTmdbId: "/api/medialookup/tvshows/:tmdbId/episode-group",
      tvFilesByTmdbId: "/api/medialookup/tvshows/:tmdbId/files",
      tvSeasonByTmdbId: "/api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber",
      tvEpisodeByTmdbId: "/api/medialookup/tvshows/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber",
      movieFilesByTmdbId: "/api/medialookup/movies/:tmdbId/files",
      imagesPrefix: "/api/medialookup/images",
      cacheBase: "/api/medialookup/cache",
      cacheWildcard: "/api/medialookup/cache/*",
    },
    scannedFiles: {
      base: "/api/scannedfiles",
      byId: "/api/scannedfiles/:id",
      stats: "/api/scannedfiles/stats",
      tmdbIdsAndTitles: "/api/scannedfiles/tmdb-ids-and-titles",
      batchDelete: "/api/scannedfiles/batch",
      recreateSymlinks: "/api/scannedfiles/recreate-symlinks",
      recreateSymlinkById: "/api/scannedfiles/:id/recreate-symlink",
    },
    symlink: {
      cleanup: "/api/symlink/cleanup",
    },
  },
} as const
