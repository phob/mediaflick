// Types
export interface MediaSearchResult {
    title: string;
    year?: number;
    tmdbId: number;
    // ... other fields
    posterPath: string;
    backdropPath: string;
    overview: string;
    releaseDate: string;
    genres: string[];
    runtime: number;
    rating: number;
  }
  
  export interface MediaInfo {
    Title: string;
    Year?: number;
    TmdbId: number;
    ImdbId: string;
    MediaType: MediaType;
    SeasonNumber?: number;
    EpisodeNumber?: number;
    EpisodeTitle?: string;
    EpisodeTmdbId?: number;
    PosterPath: string;
    Summary: string;
    Status: MediaStatus;
    Seasons: SeasonInfo[];
  }
  
  export enum MediaType {
    Movies = 0,
    TvShows = 1,
    Unknown = 2
  }
  
  export enum MediaStatus {
    Processing = 0,
    Success = 1,
    Failed = 2
  }
  
  export interface SeasonInfo {
    SeasonNumber: number;
    Name: string;
    Overview: string;
    PosterPath: string;
    AirDate: string;
    Episodes: EpisodeInfo[];
  }
  
  export interface EpisodeInfo {
    EpisodeNumber: number;
    Name: string;
    Overview: string;
    StillPath: string;
    AirDate: string;
    TmdbId: number;
  }
  
  export interface ScannedFile {
    id: number;
    sourceFile: string;
    destFile: string;
    mediaType: MediaType;
    tmdbId?: number;
    imdbId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    status: MediaStatus;
    createdAt: string;
    updatedAt: string;
    versionUpdated: number;
    updateToVersion: number;
  }
  
  export interface PagedResult<T> {
    items: T[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }
  
  export interface UpdateScannedFileRequest {
    tmdbId?: number;
    seasonNumber?: number;
    episodeNumber?: number;
  }

  export interface ScannedFileStats {
    totalFiles: number;
    byStatus: StatusCount[];
    byMediaType: MediaTypeCount[];
  }

  export interface StatusCount {
    status: MediaStatus;
    count: number;
  }

  export interface MediaTypeCount {
    mediaType: MediaType;
    count: number;
  }
  