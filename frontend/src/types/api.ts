export enum FileStatus {
  Processing = 0,
  Success = 1,
  Failed = 2
}

export enum MediaType {
  Movies = 0,
  TvShows = 1,
  Unknown = 2
}

export interface ScannedFile {
  id: number
  sourceFile: string
  destFile: string | null
  status: FileStatus
  mediaType: MediaType | null
  tmdbId?: number
  imdbId?: string
  seasonNumber?: number
  episodeNumber?: number
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

export interface ScannedFileFilter {
  status?: FileStatus
  mediaType?: MediaType
  searchTerm?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} 

export interface EpisodeInfo {
  episodeNumber: number
  name: string
  overview: string | null
  stillPath: string | null
  airDate: string | null
  tmdbId: number | null
}

export interface SeasonInfo {
  seasonNumber: number
  name: string | null
  overview: string | null
  posterPath: string | null
  airDate: string | null
  episodes: EpisodeInfo[]
}

export interface MediaInfo {
  title: string
  year: number | null
  tmdbId: number
  imdbId: string | null
  mediaType: MediaType
  posterPath: string | null
  summary: string | null
  status: string | null
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string
  seasons: SeasonInfo[]
}