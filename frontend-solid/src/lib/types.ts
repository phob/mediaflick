export type MediaType = "Movies" | "TvShows" | "Extras" | "Unknown"
export type MediaStatus = "Processing" | "Success" | "Failed" | "Duplicate"

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

export interface MediaTitleItem {
  tmdbId: number
  title: string | null
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
}

export interface PagedResult<T> {
  items: T[]
  totalItems: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TvEpisodeGroup {
  id: string
  name: string
  description: string | null
  type: number
  episodeCount: number
  groupCount: number
  selected: boolean
}

export interface TvEpisodeGroupsResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  groups: TvEpisodeGroup[]
}

export interface TvFilesResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  categorizedFiles: ScannedFile[]
  uncategorizedFiles: ScannedFile[]
}

export interface MovieFilesResponse {
  tmdbId: number
  primaryFiles: ScannedFile[]
  extraFiles: ScannedFile[]
}

export interface EpisodeGroupChangeResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  removedCount: number
  reprocessedCount: number
}

export interface RealtimeEnvelope {
  type: "file.added" | "file.updated" | "file.removed" | "heartbeat" | "zurg.version"
  payload: unknown
}
