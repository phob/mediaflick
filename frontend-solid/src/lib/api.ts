import { getApiBaseUrl } from "@/lib/runtime-config"
import type {
  BulkUpdateApplyResponse,
  BulkUpdateDryRunResponse,
  BulkUpdateRequest,
  ConfigurationPayload,
  EpisodeGroupChangeResponse,
  LogLevel,
  LogsResponse,
  MediaInfo,
  MediaSearchResult,
  MediaStatus,
  MediaType,
  MediaTitleItem,
  MovieFilesResponse,
  PagedResult,
  ScannedFile,
  SeasonInfo,
  TvEpisodeGroupsResponse,
  TvFilesResponse,
  UpdateScannedFileRequest,
} from "@/lib/types"

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const endpoint = path.startsWith("/") ? path : `/${path}`
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const data = (await response.json()) as { error?: string }
      message = data.error ?? message
    } catch {
    }

    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

export const mediaApi = {
  listTitles(mediaType: "Movies" | "TvShows", searchTerm = ""): Promise<MediaTitleItem[]> {
    const query = new URLSearchParams({ mediaType })
    if (searchTerm.trim()) {
      query.set("searchTerm", searchTerm.trim())
    }
    return request(`/scannedfiles/tmdb-ids-and-titles?${query.toString()}`)
  },

  listScannedFiles(params: {
    status?: MediaStatus
    mediaType?: MediaType
    searchTerm?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
    page?: number
    pageSize?: number
  }): Promise<PagedResult<ScannedFile>> {
    const query = new URLSearchParams()
    if (params.status) {
      query.set("status", params.status)
    }
    if (params.mediaType) {
      query.set("mediaType", params.mediaType)
    }
    if (params.searchTerm?.trim()) {
      query.set("searchTerm", params.searchTerm.trim())
    }
    if (params.sortBy) {
      query.set("sortBy", params.sortBy)
    }
    if (params.sortOrder) {
      query.set("sortOrder", params.sortOrder)
    }
    if (params.page) {
      query.set("page", String(params.page))
    }
    if (params.pageSize) {
      query.set("pageSize", String(params.pageSize))
    }
    return request(`/scannedfiles?${query.toString()}`)
  },

  getMovie(tmdbId: number): Promise<MediaInfo> {
    return request(`/medialookup/movies/${tmdbId}`)
  },

  getMovieFiles(tmdbId: number): Promise<MovieFilesResponse> {
    return request(`/medialookup/movies/${tmdbId}/files`)
  },

  getShow(tmdbId: number): Promise<MediaInfo> {
    return request(`/medialookup/tvshows/${tmdbId}`)
  },

  getShowEpisodeGroups(tmdbId: number): Promise<TvEpisodeGroupsResponse> {
    return request(`/medialookup/tvshows/${tmdbId}/episode-groups`)
  },

  getShowFiles(tmdbId: number): Promise<TvFilesResponse> {
    return request(`/medialookup/tvshows/${tmdbId}/files`)
  },

  getShowSeason(tmdbId: number, seasonNumber: number): Promise<SeasonInfo> {
    return request(`/medialookup/tvshows/${tmdbId}/seasons/${seasonNumber}`)
  },

  setShowEpisodeGroup(tmdbId: number, episodeGroupId: string | null): Promise<EpisodeGroupChangeResponse> {
    return request(`/medialookup/tvshows/${tmdbId}/episode-group`, {
      method: "PUT",
      body: JSON.stringify({ episodeGroupId }),
    })
  },

  getConfig(): Promise<ConfigurationPayload> {
    return request("/config")
  },

  updateConfig(payload: ConfigurationPayload): Promise<ConfigurationPayload> {
    return request("/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  getLogs(params: {
    minLevel?: LogLevel
    searchTerm?: string
    limit?: number
    from?: string
    to?: string
  }): Promise<LogsResponse> {
    const query = new URLSearchParams()
    if (params.minLevel) {
      query.set("minLevel", params.minLevel)
    }
    if (params.searchTerm?.trim()) {
      query.set("searchTerm", params.searchTerm.trim())
    }
    if (params.limit && params.limit > 0) {
      query.set("limit", String(params.limit))
    }
    if (params.from) {
      query.set("from", params.from)
    }
    if (params.to) {
      query.set("to", params.to)
    }

    const suffix = query.toString()
    return request(`/logs${suffix ? `?${suffix}` : ""}`)
  },

  markAsExtra(fileId: number): Promise<{ id: number }> {
    return request(`/scannedfiles/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ mediaType: "Extras" }),
    })
  },

  searchMovies(title: string): Promise<MediaSearchResult[]> {
    const query = new URLSearchParams({ title: title.trim() })
    return request(`/medialookup/movies/search?${query.toString()}`)
  },

  searchTvShows(title: string): Promise<MediaSearchResult[]> {
    const query = new URLSearchParams({ title: title.trim() })
    return request(`/medialookup/tvshows/search?${query.toString()}`)
  },

  updateScannedFile(id: number, body: UpdateScannedFileRequest): Promise<ScannedFile> {
    return request(`/scannedfiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  },

  batchUpdate(body: BulkUpdateRequest): Promise<BulkUpdateDryRunResponse | BulkUpdateApplyResponse> {
    return request("/scannedfiles/batch-update", {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  },

  recreateSymlink(id: number): Promise<ScannedFile> {
    return request(`/scannedfiles/${id}/recreate-symlink`, {
      method: "PATCH",
    })
  },

  recreateAllSymlinks(): Promise<{ successCount: number }> {
    return request("/scannedfiles/recreate-symlinks", {
      method: "POST",
    })
  },
}
