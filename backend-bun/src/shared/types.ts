export const mediaTypes = ["Movies", "TvShows", "Extras", "Unknown"] as const
export type MediaType = (typeof mediaTypes)[number]

export const mediaStatuses = ["Processing", "Success", "Failed", "Duplicate"] as const
export type MediaStatus = (typeof mediaStatuses)[number]

export interface FolderMappingConfig {
  sourceFolder: string
  destinationFolder: string
  mediaType: MediaType
}

export interface PlexConfig {
  host: string
  port: number
  plexToken: string
  folderMappings: FolderMappingConfig[]
  pollingInterval: number
  processNewFolderDelay: number
}

export interface TMDbConfig {
  apiKey: string
}

export interface MediaDetectionConfig {
  cacheDuration: number
  autoExtrasThresholdBytes: number
}

export interface ZurgConfig {
  versionLocation: string
}

export interface ConfigurationPayload {
  plex: PlexConfig
  tmDb: TMDbConfig
  mediaDetection: MediaDetectionConfig
  zurg: ZurgConfig
}

export interface ScannedFile {
  id: number
  sourceFile: string
  destFile: string | null
  fileSize: number | null
  fileHash: string | null
  mediaType: MediaType | null
  tmdbId: number | null
  imdbId: string | null
  title: string | null
  year: number | null
  genres: string[] | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  status: MediaStatus
  createdAt: string
  updatedAt: string | null
  versionUpdated: number
  updateToVersion: number
}

export interface PagedResult<T> {
  items: T[]
  totalItems: number
  page: number
  pageSize: number
  totalPages: number
}

export interface UpdateScannedFileRequest {
  tmdbId?: number
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  mediaType?: MediaType
}

export interface MediaSearchResult {
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
}

export interface MediaInfo {
  title: string
  year: number | null
  tmdbId: number
  imdbId: string | null
  mediaType: MediaType
  posterPath: string | null
  backdropPath: string | null
  overview: string | null
  status: string | null
  genres: string[]
  episodeCount?: number
  episodeCountScanned?: number
  seasonCount?: number
  seasonCountScanned?: number
}

export interface EpisodeInfo {
  episodeNumber: number
  name: string | null
  overview: string | null
  stillPath: string | null
  airDate: string | null
  tmdbId?: number
  isScanned?: boolean
}

export interface SeasonInfo {
  seasonNumber: number
  name: string | null
  overview: string | null
  posterPath: string | null
  airDate: string | null
  episodes: EpisodeInfo[]
  episodeCount: number
  episodeCountScanned: number
}

export interface StatusCount {
  status: MediaStatus
  count: number
}

export interface MediaTypeCount {
  mediaType: MediaType
  count: number
}

export interface ScannedFileStats {
  totalFiles: number
  totalSuccessfulFiles: number
  totalFileSize: number
  totalSuccessfulFileSize: number
  byStatus: StatusCount[]
  byMediaType: MediaTypeCount[]
}

export interface ResolvedSeriesIdentity {
  tmdbId: number
  imdbId: string | null
  canonicalTitle: string
  year: number | null
}

export function parseGenres(value: string | null): string[] | null {
  if (!value) {
    return null
  }
  return value
    .split("|")
    .map(v => v.trim())
    .filter(Boolean)
}

export function formatGenres(value: string[] | null): string | null {
  if (!value || value.length === 0) {
    return null
  }
  return value.join("|")
}
