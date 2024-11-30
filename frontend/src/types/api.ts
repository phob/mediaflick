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