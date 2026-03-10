import type { JellyfinConfig } from "@/shared/types"
import type { Logger } from "@/shared/logger"

interface JellyfinQueryResult<T> {
  Items?: T[]
  items?: T[]
}

interface JellyfinMediaFolderDto {
  Id?: string
  id?: string
  Name?: string | null
  name?: string | null
  Path?: string | null
  path?: string | null
  CollectionType?: string | null
  collectionType?: string | null
}

interface JellyfinBaseItemDto {
  Id?: string
  id?: string
  Name?: string | null
  name?: string | null
  Path?: string | null
  path?: string | null
  ProviderIds?: Record<string, string | null> | null
  providerIds?: Record<string, string | null> | null
}

export interface JellyfinFolder {
  id: string
  name: string | null
  path: string | null
  collectionType: string | null
}

export interface JellyfinItem {
  id: string
  name: string | null
  path: string | null
  providerIds: Record<string, string | null>
}

export interface JellyfinEpisode extends JellyfinItem {
  seasonNumber: number | null
  episodeNumber: number | null
}

function normalizeProviderIds(
  value: Record<string, string | null> | null | undefined,
): Record<string, string | null> {
  const normalized: Record<string, string | null> = {}
  for (const [key, providerValue] of Object.entries(value ?? {})) {
    normalized[key.toLowerCase()] = providerValue
  }
  return normalized
}

function normalizeItem(input: JellyfinBaseItemDto): JellyfinItem {
  return {
    id: input.Id ?? input.id ?? "",
    name: input.Name ?? input.name ?? null,
    path: input.Path ?? input.path ?? null,
    providerIds: normalizeProviderIds(input.ProviderIds ?? input.providerIds),
  }
}

function normalizeFolder(input: JellyfinMediaFolderDto): JellyfinFolder {
  return {
    id: input.Id ?? input.id ?? "",
    name: input.Name ?? input.name ?? null,
    path: input.Path ?? input.path ?? null,
    collectionType: input.CollectionType ?? input.collectionType ?? null,
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
}

export class JellyfinClient {
  private mediaFoldersCache: { fetchedAt: number; folders: JellyfinFolder[] } | null = null

  constructor(
    private readonly config: JellyfinConfig,
    private readonly logger?: Logger,
  ) {}

  isEnabled(): boolean {
    return this.config.enabled && this.config.baseUrl.trim().length > 0 && this.config.apiKey.trim().length > 0
  }

  async getMediaFolders(force = false): Promise<JellyfinFolder[]> {
    if (!this.isEnabled()) {
      this.logger?.debug("Jellyfin media folder fetch skipped because Jellyfin is disabled or incomplete", {
        enabled: this.config.enabled,
        baseUrlConfigured: this.config.baseUrl.trim().length > 0,
        apiKeyConfigured: this.config.apiKey.trim().length > 0,
      })
      return []
    }

    const now = Date.now()
    if (!force && this.mediaFoldersCache && now - this.mediaFoldersCache.fetchedAt < 5 * 60 * 1000) {
      this.logger?.debug("Jellyfin media folder fetch served from cache", {
        folderCount: this.mediaFoldersCache.folders.length,
      })
      return this.mediaFoldersCache.folders
    }

    const payload = await this.get<JellyfinQueryResult<JellyfinMediaFolderDto>>("/Library/MediaFolders")
    const folders = (payload.Items ?? payload.items ?? [])
      .map(normalizeFolder)
      .filter(folder => folder.id.length > 0)
    this.logger?.debug("Jellyfin media folders fetched", {
      folderCount: folders.length,
      folders: folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        collectionType: folder.collectionType,
      })),
    })
    this.mediaFoldersCache = { fetchedAt: now, folders }
    return folders
  }

  async reportMovieAdded(input: { tmdbId?: number | null; imdbId?: string | null }): Promise<void> {
    const query = new URLSearchParams()
    if (input.tmdbId) {
      query.set("tmdbId", String(input.tmdbId))
    }
    if (input.imdbId) {
      query.set("imdbId", input.imdbId)
    }
    await this.postNoContent(`/Library/Movies/Added${query.size > 0 ? `?${query.toString()}` : ""}`)
  }

  async reportMovieUpdated(input: { tmdbId?: number | null; imdbId?: string | null }): Promise<void> {
    const query = new URLSearchParams()
    if (input.tmdbId) {
      query.set("tmdbId", String(input.tmdbId))
    }
    if (input.imdbId) {
      query.set("imdbId", input.imdbId)
    }
    await this.postNoContent(`/Library/Movies/Updated${query.size > 0 ? `?${query.toString()}` : ""}`)
  }

  async reportSeriesAdded(input: { tvdbId?: number | null }): Promise<void> {
    const query = new URLSearchParams()
    if (input.tvdbId) {
      query.set("tvdbId", String(input.tvdbId))
    }
    await this.postNoContent(`/Library/Series/Added${query.size > 0 ? `?${query.toString()}` : ""}`)
  }

  async reportSeriesUpdated(input: { tvdbId?: number | null }): Promise<void> {
    const query = new URLSearchParams()
    if (input.tvdbId) {
      query.set("tvdbId", String(input.tvdbId))
    }
    await this.postNoContent(`/Library/Series/Updated${query.size > 0 ? `?${query.toString()}` : ""}`)
  }

  async reportMediaUpdated(updates: Array<{ path: string; updateType: "Created" | "Modified" | "Deleted" }>): Promise<void> {
    if (updates.length === 0) {
      return
    }

    await this.postNoContent("/Library/Media/Updated", {
      Updates: updates.map(update => ({
        Path: update.path,
        UpdateType: update.updateType,
      })),
    })
  }

  async refreshItem(itemId: string): Promise<void> {
    await this.postNoContent(`/Items/${itemId}/Refresh`)
  }

  async findItems(input: {
    includeItemTypes: "Movie" | "Series"
    parentId?: string | null
    searchTerm: string
    limit?: number
  }): Promise<JellyfinItem[]> {
    const query = new URLSearchParams({
      includeItemTypes: input.includeItemTypes,
      recursive: "true",
      searchTerm: input.searchTerm,
      limit: String(input.limit ?? 25),
      fields: "ProviderIds,Path",
    })

    if (input.parentId) {
      query.set("parentId", input.parentId)
    }

    const payload = await this.get<JellyfinQueryResult<JellyfinBaseItemDto>>(`/Items?${query.toString()}`)
    const items = (payload.Items ?? payload.items ?? [])
      .map(normalizeItem)
      .filter(item => item.id.length > 0)
    this.logger?.debug("Jellyfin item lookup completed", {
      includeItemTypes: input.includeItemTypes,
      parentId: input.parentId ?? null,
      searchTerm: input.searchTerm,
      resultCount: items.length,
      itemIds: items.map(item => item.id),
    })
    return items
  }

  async getSeriesEpisodes(seriesId: string, seasonNumber: number): Promise<JellyfinEpisode[]> {
    const query = new URLSearchParams({
      season: String(seasonNumber),
      fields: "ProviderIds,Path",
    })
    const payload = await this.get<JellyfinQueryResult<JellyfinBaseItemDto & {
      ParentIndexNumber?: number | null
      parentIndexNumber?: number | null
      IndexNumber?: number | null
      indexNumber?: number | null
    }>>(`/Shows/${seriesId}/Episodes?${query.toString()}`)

    const episodes = (payload.Items ?? payload.items ?? [])
      .map(item => ({
        ...normalizeItem(item),
        seasonNumber: item.ParentIndexNumber ?? item.parentIndexNumber ?? null,
        episodeNumber: item.IndexNumber ?? item.indexNumber ?? null,
      }))
      .filter(item => item.id.length > 0)
    this.logger?.debug("Jellyfin series episodes fetched", {
      seriesId,
      seasonNumber,
      episodeCount: episodes.length,
      episodeIds: episodes.map(item => item.id),
    })
    return episodes
  }

  foldersForDestination(
    folders: JellyfinFolder[],
    destinations: string[],
  ): JellyfinFolder[] {
    const destinationPaths = destinations.map(normalizePath)
    return folders.filter(folder => {
      if (!folder.path) {
        return false
      }
      const folderPath = normalizePath(folder.path)
      return destinationPaths.some(destination =>
        destination.startsWith(folderPath) || folderPath.startsWith(destination),
      )
    })
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: "GET" })
    return await response.json() as T
  }

  private async postNoContent(path: string, body?: unknown): Promise<void> {
    await this.request(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    if (!this.isEnabled()) {
      throw new Error("Jellyfin is not configured")
    }

    this.logger?.debug("Jellyfin request started", {
      method: init.method ?? "GET",
      path,
      baseUrl: this.config.baseUrl.replace(/\/+$/, ""),
      hasBody: init.body !== undefined,
      timeoutMs: this.config.requestTimeoutMs,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `MediaBrowser Token="${this.config.apiKey}"`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      })

      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText)
        this.logger?.warn("Jellyfin request failed", {
          method: init.method ?? "GET",
          path,
          status: response.status,
          responseText: message || response.statusText,
        })
        throw new Error(`Jellyfin request failed (${response.status}): ${message || response.statusText}`)
      }

      this.logger?.debug("Jellyfin request succeeded", {
        method: init.method ?? "GET",
        path,
        status: response.status,
      })
      return response
    } catch (error) {
      this.logger?.warn("Jellyfin request threw", {
        method: init.method ?? "GET",
        path,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}
