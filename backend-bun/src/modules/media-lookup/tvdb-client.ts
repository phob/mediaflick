import { TtlCache } from "@/shared/ttl-cache"
import type { TvdbSeasonType } from "@/shared/types"

interface TvdbEnvelope<T> {
  data: T
  status: string
  links?: TvdbLinks
}

interface TvdbLoginResponse {
  token: string
}

interface TvdbLinks {
  prev?: string | null
  self?: string | null
  next?: string | null
  total_items?: number
  page_size?: number
}

export interface TvdbRemoteId {
  id: string
  sourceName: string
}

export interface TvdbSearchResult {
  tvdb_id?: string
  id?: string
  name?: string
  title?: string
  year?: string
  image_url?: string | null
  poster?: string | null
  thumbnail?: string | null
  overview?: string | null
  type?: string
}

export interface TvdbGenre {
  id: number
  name: string
}

export interface TvdbStatus {
  name: string
}

export interface TvdbSeriesExtended {
  id: number
  name: string
  image?: string | null
  overview?: string | null
  year?: string | null
  firstAired?: string | null
  lastAired?: string | null
  originalLanguage?: string | null
  originalCountry?: string | null
  defaultSeasonType?: number | null
  genres?: TvdbGenre[]
  status?: TvdbStatus | null
  remoteIds?: TvdbRemoteId[]
}

export interface TvdbEpisodeRecord {
  id: number
  seasonNumber: number
  number: number
  name?: string | null
  overview?: string | null
  aired?: string | null
  image?: string | null
}

interface TvdbSeriesEpisodesResponse {
  series: {
    id: number
    name: string
  }
  episodes: TvdbEpisodeRecord[]
}

function extractYear(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) && year > 1800 ? year : null
}

function toAbsoluteImageUrl(value?: string | null): string | null {
  if (!value) {
    return null
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  return `https://artworks.thetvdb.com${value.startsWith("/") ? value : `/${value}`}`
}

export class TvdbClient {
  private readonly cache = new TtlCache<unknown>()
  private token: string | null = null
  private tokenExpiresAt = 0

  constructor(private readonly apiKey: string) {}

  invalidateAll(): void {
    this.cache.clear()
    this.token = null
    this.tokenExpiresAt = 0
  }

  async searchSeries(query: string): Promise<TvdbSearchResult[]> {
    const data = await this.get<TvdbSearchResult[]>("/search", {
      query,
      type: "series",
      limit: "10",
    }, 60 * 60 * 1000)

    return (data ?? []).filter(result => (result.type ?? "series") === "series")
  }

  async getSeriesExtended(tvdbId: number): Promise<TvdbSeriesExtended> {
    return this.get<TvdbSeriesExtended>(`/series/${tvdbId}/extended`, {
      short: "true",
    }, 6 * 60 * 60 * 1000)
  }

  async getSeriesEpisodes(
    tvdbId: number,
    seasonType: TvdbSeasonType,
    filters?: { season?: number; episodeNumber?: number },
  ): Promise<TvdbEpisodeRecord[]> {
    const allEpisodes: TvdbEpisodeRecord[] = []
    let page = 0

    while (true) {
      const params: Record<string, string> = {
        page: String(page),
      }
      if (filters?.season) {
        params.season = String(filters.season)
      }
      if (filters?.episodeNumber) {
        params.episodeNumber = String(filters.episodeNumber)
      }

      const response = await this.getWithLinks<TvdbSeriesEpisodesResponse>(
        `/series/${tvdbId}/episodes/${seasonType}`,
        params,
        2 * 60 * 60 * 1000,
      )

      allEpisodes.push(...(response.data.episodes ?? []))
      if (!response.links?.next) {
        break
      }
      page += 1
    }

    return allEpisodes
  }

  searchResultTitle(result: TvdbSearchResult): string {
    return result.name?.trim() || result.title?.trim() || "Untitled series"
  }

  searchResultYear(result: TvdbSearchResult): number | null {
    return extractYear(result.year)
  }

  searchResultId(result: TvdbSearchResult): number | null {
    const raw = result.tvdb_id ?? result.id ?? null
    if (!raw) {
      return null
    }

    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  searchResultPoster(result: TvdbSearchResult): string | null {
    return toAbsoluteImageUrl(result.image_url ?? result.poster ?? result.thumbnail ?? null)
  }

  seriesYear(series: Pick<TvdbSeriesExtended, "year">): number | null {
    return extractYear(series.year)
  }

  seriesPoster(series: Pick<TvdbSeriesExtended, "image">): string | null {
    return toAbsoluteImageUrl(series.image ?? null)
  }

  episodeImage(episode: Pick<TvdbEpisodeRecord, "image">): string | null {
    return toAbsoluteImageUrl(episode.image ?? null)
  }

  private async get<T>(path: string, query?: Record<string, string>, ttlMs = 0): Promise<T> {
    const response = await this.getWithLinks<T>(path, query, ttlMs)
    return response.data
  }

  private async getWithLinks<T>(
    path: string,
    query?: Record<string, string>,
    ttlMs = 0,
  ): Promise<{ data: T; links: TvdbLinks | null }> {
    const params = new URLSearchParams(query ?? {})
    const cacheKey = `${path}?${params.toString()}`

    if (ttlMs > 0) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        return cached as { data: T; links: TvdbLinks | null }
      }
    }

    const token = await this.ensureToken()
    const response = await fetch(`https://api4.thetvdb.com/v4${path}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`TVDB request failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as TvdbEnvelope<T>
    const normalized = {
      data: payload.data,
      links: payload.links ?? null,
    }

    if (ttlMs > 0) {
      this.cache.set(cacheKey, normalized, ttlMs)
    }

    return normalized
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token
    }

    const response = await fetch("https://api4.thetvdb.com/v4/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ apikey: this.apiKey }),
    })

    if (!response.ok) {
      throw new Error(`TVDB login failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as TvdbEnvelope<TvdbLoginResponse>
    const token = payload.data?.token?.trim()
    if (!token) {
      throw new Error("TVDB login failed: empty token")
    }

    this.token = token
    this.tokenExpiresAt = Date.now() + 27 * 24 * 60 * 60 * 1000
    return token
  }
}
