import { dirname } from "node:path"
import { normalizeTitle } from "@/modules/detection/normalization"
import type { JellyfinClient, JellyfinFolder, JellyfinItem } from "@/modules/jellyfin/jellyfin-client"
import { JellyfinSyncRepo, type JellyfinSyncRecord } from "@/modules/jellyfin/jellyfin-sync-repo"
import type { AppContext } from "@/app/context"
import type { MediaType } from "@/shared/types"

type SupportedMediaType = Extract<MediaType, "Movies" | "TvShows">
type ChangeAction = "added" | "updated" | "deleted"
type UpdateType = "Created" | "Modified" | "Deleted"
type VerificationMode = "afterNotify" | "detail"

export interface JellyfinChangeRecord {
  mediaType: SupportedMediaType
  tmdbId: number | null
  tvdbId: number | null
  imdbId: string | null
  title: string | null
  action: ChangeAction
  oldDestFile?: string | null
  newDestFile?: string | null
  seasonNumber?: number | null
  episodeNumber?: number | null
  episodeNumber2?: number | null
  structural?: boolean
}

interface JellyfinPathUpdate {
  path: string
  updateType: UpdateType
}

interface JellyfinBatchGroup {
  mediaType: SupportedMediaType
  tmdbId: number | null
  tvdbId: number | null
  imdbId: string | null
  title: string | null
  hasAdded: boolean
  hasUpdated: boolean
  structural: boolean
  touchedSeasons: Set<number>
}

export interface JellyfinSyncBatch {
  groups: Map<string, JellyfinBatchGroup>
  pathUpdates: Map<string, UpdateType>
}

interface RefreshInput {
  mediaType: SupportedMediaType
  tmdbId: number
  title: string
  imdbId?: string | null
  tvdbId?: number | null
  force?: boolean
}

function batchKey(mediaType: SupportedMediaType, tmdbId: number | null, fallback: string | null): string {
  return `${mediaType}:${tmdbId ?? fallback ?? "unknown"}`
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  return [...new Set(paths.filter((path): path is string => Boolean(path && path.trim().length > 0)))]
}

function pathMatches(itemPath: string | null, candidatePaths: string[]): boolean {
  if (!itemPath) {
    return false
  }

  const normalizedItemPath = normalizePath(itemPath)
  return candidatePaths.some(candidate => {
    const normalizedCandidate = normalizePath(candidate)
    return normalizedCandidate === normalizedItemPath
      || normalizedCandidate.startsWith(`${normalizedItemPath}/`)
      || normalizedItemPath.startsWith(`${normalizedCandidate}/`)
  })
}

function providerId(item: JellyfinItem, key: "tmdb" | "tvdb" | "imdb"): string | null {
  return item.providerIds[key] ?? null
}

function pickFirstPathMatch(items: JellyfinItem[], destinationPaths: string[]): JellyfinItem | null {
  for (const item of items) {
    if (pathMatches(item.path, destinationPaths)) {
      return item
    }
  }

  return null
}

function pickBestItem(
  items: JellyfinItem[],
  input: {
    tmdbId?: number | null
    tvdbId?: number | null
    imdbId?: string | null
    title: string
    destinationRoots: string[]
    destinationPaths: string[]
  },
): { item: JellyfinItem; matchedBy: "providerId" | "path" | "title" } | null {
  const tmdb = input.tmdbId ? String(input.tmdbId) : null
  const tvdb = input.tvdbId ? String(input.tvdbId) : null
  const imdb = input.imdbId?.toLowerCase() ?? null
  const preferredPaths = input.destinationRoots.length > 0 ? input.destinationRoots : input.destinationPaths
  const providerMatches = items.filter(item => (
    (tmdb && providerId(item, "tmdb") === tmdb)
    || (tvdb && providerId(item, "tvdb") === tvdb)
  ))

  const providerPathMatch = pickFirstPathMatch(providerMatches, preferredPaths)
  if (providerPathMatch) {
    return { item: providerPathMatch, matchedBy: "providerId" }
  }

  if (providerMatches[0]) {
    return { item: providerMatches[0], matchedBy: "providerId" }
  }

  const imdbMatches = items.filter(item => {
    const candidate = providerId(item, "imdb")
    return Boolean(imdb && candidate && candidate.toLowerCase() === imdb)
  })

  const imdbPathMatch = pickFirstPathMatch(imdbMatches, preferredPaths)
  if (imdbPathMatch) {
    return { item: imdbPathMatch, matchedBy: "providerId" }
  }

  if (imdbMatches[0]) {
    return { item: imdbMatches[0], matchedBy: "providerId" }
  }

  const pathMatch = pickFirstPathMatch(items, input.destinationPaths)
  if (pathMatch) {
    return { item: pathMatch, matchedBy: "path" }
  }

  const rootPathMatch = pickFirstPathMatch(items, preferredPaths)
  if (rootPathMatch) {
    return { item: rootPathMatch, matchedBy: "path" }
  }

  const normalizedTitle = normalizeTitle(input.title)
  for (const item of items) {
    if (normalizeTitle(item.name ?? "") === normalizedTitle) {
      return { item, matchedBy: "title" }
    }
  }

  return null
}

function isStale(record: JellyfinSyncRecord | null): boolean {
  if (!record?.lastCheckedAt) {
    return true
  }
  const timestamp = Date.parse(record.lastCheckedAt)
  if (Number.isNaN(timestamp)) {
    return true
  }
  return Date.now() - timestamp > 10 * 60 * 1000
}

function needsPostNotifyVerification(record: JellyfinSyncRecord | null): boolean {
  if (!record?.lastNotifiedAt) {
    return false
  }
  if (!record.lastCheckedAt) {
    return true
  }

  const notifiedAt = Date.parse(record.lastNotifiedAt)
  const checkedAt = Date.parse(record.lastCheckedAt)
  if (Number.isNaN(notifiedAt) || Number.isNaN(checkedAt)) {
    return true
  }

  return checkedAt < notifiedAt
}

export class JellyfinSyncCoordinator {
  private readonly repo: JellyfinSyncRepo

  constructor(private readonly context: Pick<
    AppContext,
    "configStore" | "jellyfin" | "logger" | "scannedFilesRepo" | "jellyfinSyncRepo"
  >) {
    this.repo = context.jellyfinSyncRepo
  }

  beginBatch(): JellyfinSyncBatch {
    this.context.logger.debug("Jellyfin sync batch opened")
    return {
      groups: new Map(),
      pathUpdates: new Map(),
    }
  }

  recordChange(batch: JellyfinSyncBatch, change: JellyfinChangeRecord): void {
    if (change.oldDestFile) {
      batch.pathUpdates.set(
        change.oldDestFile,
        !change.newDestFile || change.newDestFile !== change.oldDestFile ? "Deleted" : "Modified",
      )
    }
    if (change.newDestFile) {
      batch.pathUpdates.set(change.newDestFile, change.action === "added" ? "Created" : "Modified")
    }

    if (!change.tmdbId) {
      this.context.logger.debug("Jellyfin change recorded without TMDb id; only path update will be sent if available", {
        mediaType: change.mediaType,
        title: change.title,
        action: change.action,
        oldDestFile: change.oldDestFile ?? null,
        newDestFile: change.newDestFile ?? null,
      })
      return
    }

    const key = batchKey(change.mediaType, change.tmdbId, change.title)
    const group = batch.groups.get(key) ?? {
      mediaType: change.mediaType,
      tmdbId: change.tmdbId,
      tvdbId: change.tvdbId,
      imdbId: change.imdbId,
      title: change.title,
      hasAdded: false,
      hasUpdated: false,
      structural: false,
      touchedSeasons: new Set<number>(),
    }

    if (change.action === "added") {
      group.hasAdded = true
    } else {
      group.hasUpdated = true
    }

    if (change.structural || change.action !== "added" || change.oldDestFile) {
      group.structural = true
    }

    if (change.tvdbId) {
      group.tvdbId = change.tvdbId
    }
    if (change.imdbId) {
      group.imdbId = change.imdbId
    }
    if (change.title) {
      group.title = change.title
    }
    if (change.seasonNumber && change.seasonNumber > 0) {
      group.touchedSeasons.add(change.seasonNumber)
    }

    batch.groups.set(key, group)
    this.context.logger.debug("Jellyfin change recorded", {
      mediaType: change.mediaType,
      tmdbId: change.tmdbId,
      tvdbId: change.tvdbId,
      title: change.title,
      action: change.action,
      oldDestFile: change.oldDestFile ?? null,
      newDestFile: change.newDestFile ?? null,
      touchedSeason: change.seasonNumber ?? null,
      structural: change.structural ?? false,
    })
  }

  async flush(batch: JellyfinSyncBatch): Promise<void> {
    if (!this.context.jellyfin.isEnabled()) {
      this.context.logger.info("Jellyfin sync batch skipped because Jellyfin is disabled or not fully configured", {
        groupCount: batch.groups.size,
        pathUpdateCount: batch.pathUpdates.size,
      })
      return
    }

    const now = new Date().toISOString()
    this.context.logger.info("Jellyfin sync batch started", {
      groupCount: batch.groups.size,
      pathUpdateCount: batch.pathUpdates.size,
      groups: [...batch.groups.values()].map(group => ({
        mediaType: group.mediaType,
        tmdbId: group.tmdbId,
        tvdbId: group.tvdbId,
        title: group.title,
        hasAdded: group.hasAdded,
        hasUpdated: group.hasUpdated,
        structural: group.structural,
        touchedSeasons: [...group.touchedSeasons],
      })),
    })

    try {
      const existingRecords = new Map<string, JellyfinSyncRecord | null>()
      for (const group of batch.groups.values()) {
        if (!group.tmdbId || !group.title) {
          continue
        }

        const existing = await this.repo.findByMediaTmdbId(group.mediaType, group.tmdbId)
        existingRecords.set(batchKey(group.mediaType, group.tmdbId, group.title), existing)

        this.context.logger.debug("Jellyfin notify starting", {
          mediaType: group.mediaType,
          tmdbId: group.tmdbId,
          tvdbId: group.tvdbId,
          imdbId: group.imdbId,
          title: group.title,
          mode: group.hasAdded && !group.hasUpdated ? "added" : "updated",
          structural: group.structural,
        })

        if (group.mediaType === "Movies") {
          if (group.hasAdded && !group.hasUpdated) {
            await this.context.jellyfin.reportMovieAdded({ tmdbId: group.tmdbId, imdbId: group.imdbId })
          } else {
            await this.context.jellyfin.reportMovieUpdated({ tmdbId: group.tmdbId, imdbId: group.imdbId })
          }
        } else if (group.hasAdded && !group.hasUpdated) {
          await this.context.jellyfin.reportSeriesAdded({ tvdbId: group.tvdbId })
        } else {
          await this.context.jellyfin.reportSeriesUpdated({ tvdbId: group.tvdbId })
        }

        await this.repo.upsert({
          mediaType: group.mediaType,
          tmdbId: group.tmdbId,
          state: "pending",
          lastNotifiedAt: now,
          details: {
            message: group.mediaType === "Movies"
              ? "Waiting for Jellyfin movie verification."
              : "Waiting for Jellyfin series verification.",
            touchedSeasons: [...group.touchedSeasons].sort((left, right) => left - right),
          },
        })
      }

      const pathUpdates = [...batch.pathUpdates.entries()].map(([path, updateType]) => ({ path, updateType }))
      if (pathUpdates.length > 0) {
        this.context.logger.debug("Jellyfin path updates sending", {
          updates: pathUpdates,
        })
        await this.context.jellyfin.reportMediaUpdated(pathUpdates)
      }

      for (const group of batch.groups.values()) {
        if (!group.tmdbId || !group.structural) {
          continue
        }

        const existing = existingRecords.get(batchKey(group.mediaType, group.tmdbId, group.title)) ?? null
        if (!existing?.jellyfinItemId) {
          continue
        }

        await this.context.jellyfin.refreshItem(existing.jellyfinItemId).catch(error => {
          this.context.logger.warn("Jellyfin item refresh before verification failed", {
            mediaType: group.mediaType,
            tmdbId: group.tmdbId,
            jellyfinItemId: existing.jellyfinItemId,
            error: error instanceof Error ? error.message : String(error),
          })
        })
      }

      for (const group of batch.groups.values()) {
        if (!group.tmdbId || !group.title) {
          continue
        }

        const record = await this.verifyMedia({
          mediaType: group.mediaType,
          tmdbId: group.tmdbId,
          title: group.title,
          imdbId: group.imdbId,
          tvdbId: group.tvdbId,
          touchedSeasons: [...group.touchedSeasons],
          mode: "afterNotify",
          refreshItem: group.structural,
        })

        if (group.structural && record?.jellyfinItemId) {
          await this.context.jellyfin.refreshItem(record.jellyfinItemId).catch(error => {
            this.context.logger.warn("Jellyfin item refresh failed", {
              mediaType: group.mediaType,
              tmdbId: group.tmdbId,
              error: error instanceof Error ? error.message : String(error),
            })
          })
        }
      }
      this.context.logger.info("Jellyfin sync batch finished", {
        groupCount: batch.groups.size,
        pathUpdateCount: batch.pathUpdates.size,
      })
    } catch (error) {
      this.context.logger.warn("Jellyfin sync batch failed", {
        error: error instanceof Error ? error.message : String(error),
        groupCount: batch.groups.size,
        pathUpdateCount: batch.pathUpdates.size,
      })
    }
  }

  async refreshForDetail(input: RefreshInput): Promise<JellyfinSyncRecord | null> {
    const existing = await this.repo.findByMediaTmdbId(input.mediaType, input.tmdbId)
    if (!this.context.jellyfin.isEnabled()) {
      this.context.logger.debug("Jellyfin detail refresh skipped because Jellyfin is disabled or incomplete", {
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        title: input.title,
      })
      return existing
    }

    if (!input.force && existing && !isStale(existing) && !needsPostNotifyVerification(existing) && existing.state !== "pending" && existing.state !== "error") {
      this.context.logger.debug("Jellyfin detail refresh served from cached sync state", {
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        title: input.title,
        state: existing.state,
        lastCheckedAt: existing.lastCheckedAt,
      })
      return existing
    }

    this.context.logger.debug("Jellyfin detail refresh starting", {
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
      title: input.title,
      force: input.force ?? false,
      existingState: existing?.state ?? null,
    })

    return await this.verifyMedia({
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
      title: input.title,
      imdbId: input.imdbId ?? null,
      tvdbId: input.tvdbId ?? null,
      touchedSeasons: null,
      mode: "detail",
      refreshItem: false,
    })
  }

  private async verifyMedia(input: {
    mediaType: SupportedMediaType
    tmdbId: number
    title: string
    imdbId: string | null
    tvdbId: number | null
    touchedSeasons: number[] | null
    mode: VerificationMode
    refreshItem: boolean
  }): Promise<JellyfinSyncRecord | null> {
    try {
      this.context.logger.debug("Jellyfin verification started", {
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        title: input.title,
        mode: input.mode,
        touchedSeasons: input.touchedSeasons ?? [],
      })
      return input.mediaType === "Movies"
        ? await this.verifyMovie(input)
        : await this.verifyShow(input)
    } catch (error) {
      this.context.logger.warn("Jellyfin verification failed", {
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        title: input.title,
        mode: input.mode,
        error: error instanceof Error ? error.message : String(error),
      })
      return await this.repo.upsert({
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        state: "error",
        lastCheckedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
        details: {
          message: "Jellyfin verification failed.",
        },
      })
    }
  }

  private async verifyMovie(input: {
    tmdbId: number
    title: string
    imdbId: string | null
    mode: VerificationMode
    refreshItem: boolean
  }): Promise<JellyfinSyncRecord> {
    const destinationRoots = await this.destinationRootsFor("Movies")
    const localFiles = (await this.context.scannedFilesRepo.listByTmdbId(input.tmdbId, "Movies"))
      .filter(file => file.status === "Success" && file.destFile)
    const destinationPaths = localFiles.map(file => file.destFile!).filter(Boolean)
    const localDirectories = uniquePaths(destinationPaths.map(path => dirname(path)))
    this.context.logger.debug("Jellyfin movie verification lookup", {
      tmdbId: input.tmdbId,
      title: input.title,
      imdbId: input.imdbId,
      localFileCount: localFiles.length,
      destinationPaths,
    })
    const items = await this.lookupItems("Movies", input.title)
    const match = pickBestItem(items, {
      tmdbId: input.tmdbId,
      imdbId: input.imdbId,
      title: input.title,
      destinationRoots,
      destinationPaths,
    })
    const now = new Date().toISOString()

    if (destinationPaths.length === 0) {
      this.context.logger.info("Jellyfin movie verification completed without local files", {
        tmdbId: input.tmdbId,
        title: input.title,
        state: match ? "outOfSync" : "missing",
        matchedBy: match?.matchedBy ?? null,
        jellyfinItemId: match?.item.id ?? null,
        jellyfinPath: match?.item.path ?? null,
      })

      return await this.repo.upsert({
        mediaType: "Movies",
        tmdbId: input.tmdbId,
        jellyfinItemId: match?.item.id ?? null,
        state: match ? "outOfSync" : "missing",
        matchedBy: match?.matchedBy ?? null,
        lastCheckedAt: now,
        lastError: null,
        details: {
          issue: match ? "localMissing" : "missingInJellyfin",
          message: match
            ? "Movie still exists in Jellyfin but no local Mediaflick files remain."
            : "Movie no longer exists locally or in Jellyfin.",
          jellyfinPath: match?.item.path ?? null,
          localPaths: destinationPaths,
          localDirectories,
        },
      })
    }

    if (!match) {
      this.context.logger.debug("Jellyfin movie verification found no match", {
        tmdbId: input.tmdbId,
        title: input.title,
        itemCount: items.length,
      })
      return await this.repo.upsert({
        mediaType: "Movies",
        tmdbId: input.tmdbId,
        state: input.mode === "afterNotify" ? "pending" : "missing",
        lastCheckedAt: now,
        lastError: null,
        details: {
          issue: input.mode === "afterNotify" ? "pendingJellyfin" : "missingInJellyfin",
          message: input.mode === "afterNotify"
            ? "Jellyfin has not surfaced the movie yet."
            : "Movie not found in Jellyfin.",
          localPaths: destinationPaths,
          localDirectories,
        },
      })
    }

    const inSync = destinationPaths.length === 0 || pathMatches(match.item.path, destinationPaths)
    this.context.logger.info("Jellyfin movie verification completed", {
      tmdbId: input.tmdbId,
      title: input.title,
      state: inSync ? "inSync" : "outOfSync",
      matchedBy: match.matchedBy,
      jellyfinItemId: match.item.id,
      jellyfinPath: match.item.path,
    })
    return await this.repo.upsert({
      mediaType: "Movies",
      tmdbId: input.tmdbId,
      jellyfinItemId: match.item.id,
      state: inSync ? "inSync" : "outOfSync",
      matchedBy: match.matchedBy,
      lastCheckedAt: now,
      lastError: null,
      details: {
        issue: inSync ? "none" : "pathMismatch",
        message: inSync ? "Movie is in sync with Jellyfin." : "Movie exists in Jellyfin but the path does not match Mediaflick.",
        jellyfinPath: match.item.path,
        localPaths: destinationPaths,
        localDirectories,
      },
    })
  }

  private async verifyShow(input: {
    tmdbId: number
    title: string
    imdbId: string | null
    tvdbId: number | null
    touchedSeasons: number[] | null
    mode: VerificationMode
    refreshItem: boolean
  }): Promise<JellyfinSyncRecord> {
    const destinationRoots = await this.destinationRootsFor("TvShows")
    const localFiles = (await this.context.scannedFilesRepo.listByTmdbId(input.tmdbId, "TvShows"))
      .filter(file => file.status === "Success" && file.destFile)
    const destinationPaths = localFiles.map(file => file.destFile!).filter(Boolean)
    const localDirectories = uniquePaths(destinationPaths.map(path => dirname(path)))
    this.context.logger.debug("Jellyfin show verification lookup", {
      tmdbId: input.tmdbId,
      title: input.title,
      tvdbId: input.tvdbId,
      imdbId: input.imdbId,
      localFileCount: localFiles.length,
      destinationPaths,
      touchedSeasons: input.touchedSeasons ?? [],
    })
    const items = await this.lookupItems("TvShows", input.title)
    const match = pickBestItem(items, {
      tmdbId: input.tmdbId,
      tvdbId: input.tvdbId,
      imdbId: input.imdbId,
      title: input.title,
      destinationRoots,
      destinationPaths,
    })
    const now = new Date().toISOString()

    if (destinationPaths.length === 0) {
      this.context.logger.info("Jellyfin show verification completed without local files", {
        tmdbId: input.tmdbId,
        title: input.title,
        state: match ? "outOfSync" : "missing",
        matchedBy: match?.matchedBy ?? null,
        jellyfinItemId: match?.item.id ?? null,
        jellyfinPath: match?.item.path ?? null,
      })

      return await this.repo.upsert({
        mediaType: "TvShows",
        tmdbId: input.tmdbId,
        jellyfinItemId: match?.item.id ?? null,
        state: match ? "outOfSync" : "missing",
        matchedBy: match?.matchedBy ?? null,
        lastCheckedAt: now,
        lastError: null,
        details: {
          issue: match ? "localMissing" : "missingInJellyfin",
          message: match
            ? "Series still exists in Jellyfin but no local Mediaflick files remain."
            : "Series no longer exists locally or in Jellyfin.",
          jellyfinPath: match?.item.path ?? null,
          localPaths: destinationPaths,
          localDirectories,
          touchedSeasons: input.touchedSeasons ?? undefined,
        },
      })
    }

    if (!match) {
      this.context.logger.debug("Jellyfin show verification found no match", {
        tmdbId: input.tmdbId,
        title: input.title,
        itemCount: items.length,
      })
      return await this.repo.upsert({
        mediaType: "TvShows",
        tmdbId: input.tmdbId,
        state: input.mode === "afterNotify" ? "pending" : "missing",
        lastCheckedAt: now,
        lastError: null,
        details: {
          issue: input.mode === "afterNotify" ? "pendingJellyfin" : "missingInJellyfin",
          message: input.mode === "afterNotify"
            ? "Jellyfin has not surfaced the series yet."
            : "Series not found in Jellyfin.",
          localPaths: destinationPaths,
          localDirectories,
          touchedSeasons: input.touchedSeasons ?? undefined,
        },
      })
    }

    const touchedSeasons = input.touchedSeasons && input.touchedSeasons.length > 0
      ? [...new Set(input.touchedSeasons.filter(season => season > 0))].sort((left, right) => left - right)
      : [...new Set(localFiles.map(file => file.seasonNumber).filter((season): season is number => Boolean(season && season > 0)))].sort((left, right) => left - right)

    let verifiedEpisodes = 0
    let missingEpisodes = 0
    const seasonDiagnostics: Array<{
      seasonNumber: number
      localEpisodeCount: number
      jellyfinEpisodeCount: number
      verifiedEpisodes: number
      missingEpisodes: number
    }> = []

    if (touchedSeasons.length > 0) {
      for (const seasonNumber of touchedSeasons) {
        const seasonFiles = localFiles.filter(file => file.seasonNumber === seasonNumber && file.destFile)
        const episodes = await this.context.jellyfin.getSeriesEpisodes(match.item.id, seasonNumber)
        const matchedPaths = new Set<string>()

        for (const episode of episodes) {
          const hit = seasonFiles.find(file => file.destFile && pathMatches(episode.path, [file.destFile]))
          if (hit?.destFile) {
            matchedPaths.add(hit.destFile)
          }
        }

        verifiedEpisodes += matchedPaths.size
        missingEpisodes += Math.max(0, seasonFiles.length - matchedPaths.size)
        seasonDiagnostics.push({
          seasonNumber,
          localEpisodeCount: seasonFiles.length,
          jellyfinEpisodeCount: episodes.length,
          verifiedEpisodes: matchedPaths.size,
          missingEpisodes: Math.max(0, seasonFiles.length - matchedPaths.size),
        })
        this.context.logger.debug("Jellyfin season verification completed", {
          tmdbId: input.tmdbId,
          title: input.title,
          jellyfinItemId: match.item.id,
          seasonNumber,
          localEpisodeCount: seasonFiles.length,
          verifiedEpisodes: matchedPaths.size,
          missingEpisodes: Math.max(0, seasonFiles.length - matchedPaths.size),
        })
      }
    }

    const pathInSync = destinationPaths.length === 0 || pathMatches(match.item.path, destinationPaths.map(path => dirname(path)))
    const fullyInSync = pathInSync && missingEpisodes === 0
    const issue = fullyInSync
      ? "none"
      : !pathInSync && missingEpisodes > 0
        ? "pathAndEpisodeMismatch"
        : !pathInSync
          ? "pathMismatch"
          : "episodeMismatch"
    this.context.logger.info("Jellyfin show verification completed", {
      tmdbId: input.tmdbId,
      title: input.title,
      state: fullyInSync ? "inSync" : "outOfSync",
      matchedBy: match.matchedBy,
      jellyfinItemId: match.item.id,
      jellyfinPath: match.item.path,
      verifiedEpisodes,
      missingEpisodes,
      touchedSeasons,
    })
    return await this.repo.upsert({
      mediaType: "TvShows",
      tmdbId: input.tmdbId,
      jellyfinItemId: match.item.id,
      state: fullyInSync ? "inSync" : "outOfSync",
      matchedBy: match.matchedBy,
      lastCheckedAt: now,
      lastError: null,
      details: {
        issue,
        message: fullyInSync
          ? "Series is in sync with Jellyfin."
          : "Series exists in Jellyfin but changed episodes or paths are not fully aligned.",
        jellyfinPath: match.item.path,
        localPaths: destinationPaths,
        localDirectories,
        verifiedEpisodes,
        missingEpisodes,
        touchedSeasons,
        seasonDiagnostics,
      },
    })
  }

  private async lookupItems(mediaType: SupportedMediaType, title: string): Promise<JellyfinItem[]> {
    const config = await this.context.configStore.get()
    const mediaFolders = await this.context.jellyfin.getMediaFolders()
    const destinations = config.plex.folderMappings
      .filter(mapping => mapping.mediaType === mediaType)
      .map(mapping => mapping.destinationFolder)
    const matchingFolders = this.context.jellyfin.foldersForDestination(mediaFolders, destinations)
    this.context.logger.debug("Jellyfin lookup folders resolved", {
      mediaType,
      title,
      destinationFolders: destinations,
      matchingFolderIds: matchingFolders.map(folder => folder.id),
      matchingFolderPaths: matchingFolders.map(folder => folder.path),
    })
    const parentIds = matchingFolders.length > 0 ? matchingFolders.map(folder => folder.id) : [null]
    const items: JellyfinItem[] = []
    const seen = new Set<string>()

    for (const parentId of parentIds) {
      const results = await this.context.jellyfin.findItems({
        includeItemTypes: mediaType === "Movies" ? "Movie" : "Series",
        parentId,
        searchTerm: title,
      })

      for (const item of results) {
        if (seen.has(item.id)) {
          continue
        }
        seen.add(item.id)
        items.push(item)
      }
    }

    this.context.logger.debug("Jellyfin lookup aggregated items", {
      mediaType,
      title,
      resultCount: items.length,
      itemIds: items.map(item => item.id),
    })
    return items
  }

  private async destinationRootsFor(mediaType: SupportedMediaType): Promise<string[]> {
    const config = await this.context.configStore.get()
    return config.plex.folderMappings
      .filter(mapping => mapping.mediaType === mediaType)
      .map(mapping => mapping.destinationFolder)
  }
}
