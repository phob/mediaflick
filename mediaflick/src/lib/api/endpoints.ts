import { fetchApi } from "@/lib/api/client"
import {
  EpisodeInfo,
  MediaInfo,
  MediaSearchResult,
  MediaStatus,
  MediaType,
  PagedResult,
  ScannedFile,
  ScannedFileStats,
  UpdateScannedFileRequest,
  ConfigurationPayload,
} from "@/lib/api/types"

// API Methods
export const mediaApi = {
  // Configuration
  getAllConfigurations: () => fetchApi("/config"),

  setAllConfigurations: (config: ConfigurationPayload) =>
    fetchApi("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  getPlexConfig: () => fetchApi("/config/plex"),

  getTMDbConfig: () => fetchApi("/config/tmdb"),

  getMediaDetectionConfig: () => fetchApi("/config/media-detection"),

  // Media Lookup
  searchMovies: (title: string) =>
    fetchApi<MediaSearchResult[]>(`/medialookup/movies/search?title=${encodeURIComponent(title)}`),

  searchTvShows: (title: string) =>
    fetchApi<MediaSearchResult[]>(`/medialookup/tvshows/search?title=${encodeURIComponent(title)}`),

  getMovie: (tmdbId: number) => fetchApi<MediaInfo>(`/medialookup/movies/${tmdbId}`),

  getTvShow: (tmdbId: number) => fetchApi<MediaInfo>(`/medialookup/tvshows/${tmdbId}`),

  getTvSeason: (tmdbId: number, seasonNumber: number) =>
    fetchApi<MediaInfo>(`/medialookup/tvshows/${tmdbId}/seasons/${seasonNumber}`),

  getTvEpisode: (tmdbId: number, seasonNumber: number, episodeNumber: number) =>
    fetchApi<EpisodeInfo>(`/medialookup/tvshows/${tmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`),

  getImageUrl: (path: string, size: string = "w500") => fetchApi<string>(`/medialookup/images/${path}?size=${size}`),

  getTmdbIdsAndTitles: (params: {
    searchTerm?: string
    mediaType?: MediaType
  }) => fetchApi<{ tmdbId: number; title: string }>(`/scannedfiles/tmdb-ids-and-titles?${new URLSearchParams(params).toString()}`),

  // Scanned Files
  getScannedFiles: (params: {
    searchTerm?: string
    status?: MediaStatus
    mediaType?: MediaType
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: string
    ids?: number[]
  }) => {
    const searchParams = new URLSearchParams();
    if (params.searchTerm) searchParams.set("searchTerm", params.searchTerm);
    if (params.status) searchParams.set("status", params.status.toString());
    if (params.mediaType) searchParams.set("mediaType", params.mediaType.toString());
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params.ids?.length) {
      params.ids.forEach(id => searchParams.append("ids", id.toString()));
    }
    return fetchApi<PagedResult<ScannedFile>>(`/scannedfiles?${searchParams.toString()}`);
  },

  getScannedFile: (id: number) => fetchApi<ScannedFile>(`/scannedfiles/${id}`),

  getScannedFileStats: () => fetchApi<ScannedFileStats>("/scannedfiles/stats"),

  updateScannedFile: (id: number, data: UpdateScannedFileRequest) =>
    fetchApi<ScannedFile>(`/scannedfiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  recreateSymlink: (id: number) =>
    fetchApi<ScannedFile>(`/scannedfiles/${id}/recreate-symlink`, {
      method: "PATCH",
    }),

  deleteScannedFile: (id: number) =>
    fetchApi(`/scannedfiles/${id}`, {
      method: "DELETE",
    }),

  deleteScannedFiles: (ids: number[]) =>
    fetchApi("/scannedfiles/batch", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ids),
    }),

  recreateAllSymlinks: () =>
    fetchApi<{ successCount: number }>("/scannedfiles/recreate-symlinks", {
      method: "POST",
    }),

  updateImdbIds: (batchSize: number = 50) =>
    fetchApi<{ updated: number; failed: number }>(`/scannedfiles/update-imdb-ids?batchSize=${batchSize}`, {
      method: "POST",
    }),

  // Symlink Management
  cleanupDeadSymlinks: () =>
    fetchApi<{ message: string }>("/symlink/cleanup", {
      method: "POST",
    }),
}
