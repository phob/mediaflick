import { TtlCache } from "@/shared/ttl-cache"

interface TmdbSearchResponse<T> {
  results: T[]
}

export interface TmdbMovieResult {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string | null
  popularity?: number
}

export interface TmdbTvResult {
  id: number
  name: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string | null
  popularity?: number
}

export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbMovieDetails extends TmdbMovieResult {
  genres: TmdbGenre[]
  status?: string
}

export interface TmdbTvDetails extends TmdbTvResult {
  genres: TmdbGenre[]
  status?: string
  number_of_episodes: number
  number_of_seasons: number
}

export interface TmdbExternalIds {
  imdb_id: string | null
}

export interface TmdbEpisodeDetails {
  id: number
  episode_number: number
  name: string
  overview: string | null
  still_path: string | null
  air_date: string | null
}

export interface TmdbSeasonDetails {
  season_number: number
  name: string
  overview: string | null
  poster_path: string | null
  air_date: string | null
  episodes: TmdbEpisodeDetails[]
}

export interface TmdbTvEpisodeGroupSummary {
  id: string
  name: string
  description: string | null
  type: number
  episode_count: number
  group_count: number
}

interface TmdbTvEpisodeGroupSummaryResponse {
  results: TmdbTvEpisodeGroupSummary[]
}

export interface TmdbTvEpisodeGroupEpisode {
  id: number
  name: string
  season_number: number | null
  episode_number: number | null
  order: number | null
}

export interface TmdbTvEpisodeGroup {
  id: string
  name: string
  order: number | null
  episodes: TmdbTvEpisodeGroupEpisode[]
}

export interface TmdbTvEpisodeGroupDetails {
  id: string
  name: string
  description: string | null
  group_count: number
  episode_count: number
  groups: TmdbTvEpisodeGroup[]
}

function extractYear(value?: string): number | null {
  if (!value) return null
  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) && year > 1800 ? year : null
}

export class TmdbClient {
  private readonly cache = new TtlCache<unknown>()

  constructor(private readonly apiKey: string) {}

  invalidateAll(): void {
    this.cache.clear()
  }

  getImageUrl(path: string, size = "w500"): string {
    const normalized = path.startsWith("/") ? path : `/${path}`
    return `https://image.tmdb.org/t/p/${size}${normalized}`
  }

  async searchMovie(title: string): Promise<TmdbMovieResult[]> {
    const data = await this.get<TmdbSearchResponse<TmdbMovieResult>>("/search/movie", {
      query: title,
      include_adult: "false",
    }, 60 * 60 * 1000)

    return data.results ?? []
  }

  async searchTv(title: string): Promise<TmdbTvResult[]> {
    const data = await this.get<TmdbSearchResponse<TmdbTvResult>>("/search/tv", {
      query: title,
      include_adult: "false",
    }, 60 * 60 * 1000)

    return data.results ?? []
  }

  async getMovie(tmdbId: number): Promise<TmdbMovieDetails> {
    return this.get<TmdbMovieDetails>(`/movie/${tmdbId}`, undefined, 24 * 60 * 60 * 1000)
  }

  async getMovieExternalIds(tmdbId: number): Promise<TmdbExternalIds> {
    return this.get<TmdbExternalIds>(`/movie/${tmdbId}/external_ids`, undefined, 24 * 60 * 60 * 1000)
  }

  async getTv(tmdbId: number): Promise<TmdbTvDetails> {
    return this.get<TmdbTvDetails>(`/tv/${tmdbId}`, undefined, 6 * 60 * 60 * 1000)
  }

  async getTvExternalIds(tmdbId: number): Promise<TmdbExternalIds> {
    return this.get<TmdbExternalIds>(`/tv/${tmdbId}/external_ids`, undefined, 24 * 60 * 60 * 1000)
  }

  async getTvSeason(tmdbId: number, seasonNumber: number): Promise<TmdbSeasonDetails> {
    return this.get<TmdbSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}`, undefined, 2 * 60 * 60 * 1000)
  }

  async getTvEpisode(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<TmdbEpisodeDetails> {
    return this.get<TmdbEpisodeDetails>(`/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, undefined, 2 * 60 * 60 * 1000)
  }

  async getTvEpisodeGroups(tmdbId: number): Promise<TmdbTvEpisodeGroupSummary[]> {
    const data = await this.get<TmdbTvEpisodeGroupSummaryResponse>(`/tv/${tmdbId}/episode_groups`, undefined, 2 * 60 * 60 * 1000)
    return data.results ?? []
  }

  async getTvEpisodeGroup(groupId: string): Promise<TmdbTvEpisodeGroupDetails> {
    return this.get<TmdbTvEpisodeGroupDetails>(`/tv/episode_group/${groupId}`, undefined, 2 * 60 * 60 * 1000)
  }

  movieYear(movie: TmdbMovieResult): number | null {
    return extractYear(movie.release_date)
  }

  tvYear(tv: TmdbTvResult): number | null {
    return extractYear(tv.first_air_date)
  }

  private async get<T>(path: string, query?: Record<string, string>, ttlMs = 0): Promise<T> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      ...(query ?? {}),
    })

    const cacheKey = `${path}?${params.toString()}`
    if (ttlMs > 0) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        return cached as T
      }
    }

    const response = await fetch(`https://api.themoviedb.org/3${path}?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`TMDb request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as T
    if (ttlMs > 0) {
      this.cache.set(cacheKey, data, ttlMs)
    }
    return data
  }
}
