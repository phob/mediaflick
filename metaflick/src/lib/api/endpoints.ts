import { fetchApi } from '@/lib/api/client';

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

interface ScannedFile {
  id: number;
  sourceFile: string;
  destFile: string;
  mediaType: 'Movies' | 'TvShows' | 'Unknown';
  tmdbId?: number;
  imdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  status: 'Processing' | 'Success' | 'Failed';
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

// API Methods
export const mediaApi = {
  // Media Lookup
  searchMovies: (title: string) => 
    fetchApi<MediaSearchResult[]>(`/medialookup/movies/search?title=${encodeURIComponent(title)}`),
    
  getMovie: (tmdbId: number) => 
    fetchApi<MediaInfo>(`/medialookup/movies/${tmdbId}`),

  // Scanned Files
  getScannedFiles: (params: { page?: number, pageSize?: number }) =>
    fetchApi<PagedResult<ScannedFile>>('/scannedfiles', { 
      method: 'GET',
      body: JSON.stringify(params)
    }),

  updateScannedFile: (id: number, data: UpdateScannedFileRequest) =>
    fetchApi<ScannedFile>(`/scannedfiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
};
