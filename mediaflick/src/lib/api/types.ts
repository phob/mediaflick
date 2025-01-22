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
  Title: string
  Year: number
  Genres: string[]
  TmdbId: number
  ImdbId: string
  MediaType: MediaType
  SeasonNumber?: number
  EpisodeNumber?: number
  EpisodeTitle?: string
  EpisodeTmdbId?: number
  PosterPath?: string
  BackdropPath?: string
  Summary?: string
  Overview?: string
  Status?: string
  EpisodeCount?: number
  EpisodeCountScanned?: number
  SeasonCount?: number
  SeasonCountScanned?: number
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
  SeasonNumber: number
  Name: string
  Overview: string
  PosterPath: string
  AirDate: string
  Episodes: EpisodeInfo[]
}

export interface EpisodeInfo {
  EpisodeNumber: number
  Name: string
  Overview: string
  StillPath: string
  AirDate: string
  TmdbId: number
  IsScanned: boolean
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
