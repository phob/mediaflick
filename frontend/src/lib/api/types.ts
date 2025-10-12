import type { ReactNode } from "react"

export interface MediaSearchResult {
  title: string
  year?: number
  genres: string[]
  tmdbId: number
  posterPath: string
  backdropPath: string
  overview: string
  releaseDate: string
  runtime: number
  rating: number
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
  fileSize?: number
  fileHash?: string
  mediaType: MediaType
  tmdbId?: number
  imdbId?: string
  title?: string
  year?: number
  genres?: string[]
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
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
  episodeNumber2?: number
}

export interface ScannedFileStats {
  totalFiles: number
  totalSuccessfulFiles: number
  totalFileSize: number
  totalSuccessfulFileSize: number
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

export interface ZurgConfig {
  versionLocation: string
}

export interface ConfigurationPayload {
  plex: PlexConfig
  tmDb: TMDbConfig
  mediaDetection: MediaDetectionConfig
  zurg: ZurgConfig
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

export type Row = {
  key: number
  sourceFile: string | ReactNode
  destFile: string | ReactNode
  fileSize?: string | ReactNode
  fileHash?: string | ReactNode
  tmdbId: number
  imdbId: string
  genres?: string | ReactNode
  title?: string
  year?: number
  mediaType: string
  episode?: string
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  ignoreEpisodeIncrement?: boolean
  status: string | ReactNode
  createdAt: string | ReactNode
  updatedAt: string | ReactNode
}

export type ColumnKey =
  | 'sourceFile'
  | 'destFile'
  | 'fileSize'
  | 'fileHash'
  | 'genres'
  | 'mediaType'
  | 'tmdbId'
  | 'imdbId'
  | 'episode'
  | 'status'
  | 'createdAt'
  | 'updatedAt'

export const statusOptions = [
  { uid: "Processing", name: "Processing" },
  { uid: "Success", name: "Success" },
  { uid: "Failed", name: "Failed" },
  { uid: "Duplicate", name: "Duplicate" },
] as const

export const mediaTypeOptions = [
  { uid: MediaType.TvShows, name: "TV Shows" },
  { uid: MediaType.Movies, name: "Movies" },
  { uid: MediaType.Extras, name: "Extras" },
  { uid: MediaType.Unknown, name: "Unknown" },
] as const
