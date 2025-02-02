export interface MediaSearchResult {
  Title: string
  Year?: number
  Genres: string[]
  TmdbId: number
  PosterPath: string
  BackdropPath: string
  Overview: string
  ReleaseDate: string
  Runtime: number
  Rating: number
}

export interface MediaInfo {
  title: string
  year: number
  genres: string[]
  tmdbId: number
  imdbId: string
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string
  episodeTmdbId?: number
  posterPath?: string
  backdropPath?: string
  summary?: string
  overview?: string
  status?: string
  episodeCount?: number
  episodeCountScanned?: number
  seasonCount?: number
  seasonCountScanned?: number
}

export enum MediaType {
  Movies = "Movies",
  TvShows = "TvShows",
  Extras = "Extras",
  Unknown = "Unknown",
}

export enum MediaStatus {
  Processing = "Processing",
  Success = "Success",
  Failed = "Failed",
  Duplicate = "Duplicate",
}

export interface SeasonInfo {
  seasonNumber: number
  name: string
  overview: string
  posterPath: string
  airDate: string
  episodes: EpisodeInfo[]
  episodeCount: number
  episodeCountScanned: number
}

export interface EpisodeInfo {
  episodeNumber: number
  name: string
  overview: string
  stillPath: string
  airDate: string
  tmdbId: number
  isScanned: boolean
}

export interface ScannedFile {
  id: number
  sourceFile: string
  destFile: string
  mediaType: MediaType
  tmdbId?: number
  imdbId?: string
  title?: string
  year?: number
  genres?: string[]
  seasonNumber?: number
  episodeNumber?: number
  status: MediaStatus
  createdAt: string
  updatedAt: string
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
}

export interface ScannedFileStats {
  totalFiles: number
  byStatus: StatusCount[]
  byMediaType: MediaTypeCount[]
}

export interface StatusCount {
  status: MediaStatus
  count: number
}

export interface MediaTypeCount {
  mediaType: MediaType
  count: number
}

// Configuration Types
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
}

export interface FolderMappingConfig {
  sourceFolder: string
  destinationFolder: string
  mediaType: MediaType
}

export interface ConfigurationPayload {
  plex: PlexConfig
  tmDb: TMDbConfig
  mediaDetection: MediaDetectionConfig
}

export type LogLevel = 'Verbose' | 'Debug' | 'Information' | 'Warning' | 'Error' | 'Fatal';

export interface LogEntry {
  Timestamp: string
  Level: LogLevel
  RenderedMessage: string
  Exception?: string
  Properties: Record<string, string>
}

export interface LogResponse {
    logs: LogEntry[];
}
