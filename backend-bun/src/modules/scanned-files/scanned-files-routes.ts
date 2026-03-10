import { basename, dirname } from "node:path"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { seriesAliases, seriesIdentityMap, tvEpisodeGroupSelections, tvEpisodeSourceSelections } from "@/db/schema"
import { extractYear, normalizeTitle } from "@/modules/detection/normalization"
import { detectMovieFromFileName } from "@/modules/detection/movie-detection"
import type { JellyfinSyncBatch } from "@/modules/jellyfin/jellyfin-sync-coordinator"
import {
  buildDestinationPath,
  cleanupDeadSymlinks,
  createSymlinkAt,
  isDestinationConflictError,
  removeSymlinkIfExists,
  removeSymlinksForSource,
} from "@/modules/symlink/symlink-service"
import { HttpError } from "@/shared/errors"
import { parseJson } from "@/shared/http"
import { SeriesIdentityService } from "@/modules/detection/series-identity-service"
import { MediaMetadataResolver } from "@/modules/media-lookup/media-metadata-resolver"
import { TvEpisodeSourceService } from "@/modules/media-lookup/tv-episode-source-service"
import { parseSourceEpisodeMatch } from "@/modules/media-lookup/tv-season-remapper"
import type {
  BulkUpdateApplyResponse,
  BulkUpdateConflict,
  BulkUpdateDryRunResponse,
  BulkUpdateRequest,
  DashboardRecentItem,
  MediaStatus,
  MediaType,
  ScannedFile,
  ScannedFileDiagnostics,
  TriageInboxItem,
  TriageInboxResponse,
  UpdateScannedFileRequest,
} from "@/shared/types"

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function parseIds(value: string | null): number[] {
  if (!value) {
    return []
  }
  return value
    .split(",")
    .map(part => Number(part))
    .filter(n => Number.isInteger(n))
}

interface ResolvedSymlinkMeta {
  mediaType: MediaType
  tmdbId: number | null
  tvdbId: number | null
  imdbId: string | null
  title: string
  year: number | null
  genres: string[] | null
  posterPath: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  episodeTitle: string | null
}

async function resolveSymlinkMeta(
  id: number,
  context: AppContext,
  metadataResolver: MediaMetadataResolver,
): Promise<ResolvedSymlinkMeta> {
  const scannedFile = await context.scannedFilesRepo.findById(id)
  if (!scannedFile) {
    throw new HttpError(404, "Scanned file not found")
  }
  if (!scannedFile.mediaType || scannedFile.mediaType === "Extras" || scannedFile.mediaType === "Unknown") {
    throw new HttpError(400, "Scanned file does not support symlink recreation")
  }

  if (scannedFile.mediaType === "Movies") {
    if (!scannedFile.tmdbId || scannedFile.tmdbId <= 0) {
      if (!scannedFile.title || !scannedFile.year) {
        throw new HttpError(400, "Movie TMDb ID is required")
      }

      return {
        mediaType: scannedFile.mediaType,
        tmdbId: scannedFile.tmdbId,
        tvdbId: scannedFile.tvdbId,
        imdbId: scannedFile.imdbId,
        title: scannedFile.title,
        year: scannedFile.year,
        genres: scannedFile.genres,
        posterPath: scannedFile.posterPath,
        seasonNumber: null,
        episodeNumber: null,
        episodeNumber2: null,
        episodeTitle: null,
      }
    }

    const movie = await metadataResolver.resolveMovie(scannedFile.tmdbId)
    return {
      mediaType: scannedFile.mediaType,
      tmdbId: movie.tmdbId,
      tvdbId: null,
      imdbId: movie.imdbId,
      title: movie.title,
      year: movie.year,
      genres: movie.genres,
      posterPath: movie.posterPath,
      seasonNumber: null,
      episodeNumber: null,
      episodeNumber2: null,
      episodeTitle: null,
    }
  }

  if (!scannedFile.seasonNumber || !scannedFile.episodeNumber) {
    throw new HttpError(400, "Season and episode are required for TV files")
  }

  if (!scannedFile.tmdbId || scannedFile.tmdbId <= 0) {
    if (!scannedFile.title || !scannedFile.year) {
      throw new HttpError(400, "TV TMDb ID is required")
    }

    return {
      mediaType: scannedFile.mediaType,
      tmdbId: scannedFile.tmdbId,
      tvdbId: scannedFile.tvdbId,
      imdbId: scannedFile.imdbId,
      title: scannedFile.title,
      year: scannedFile.year,
      genres: scannedFile.genres,
      posterPath: scannedFile.posterPath,
      seasonNumber: scannedFile.seasonNumber,
      episodeNumber: scannedFile.episodeNumber,
      episodeNumber2: scannedFile.episodeNumber2,
      episodeTitle: null,
    }
  }

  const show = await metadataResolver.resolveTv({
    tmdbId: scannedFile.tmdbId,
    seasonNumber: scannedFile.seasonNumber,
    episodeNumber: scannedFile.episodeNumber,
    episodeNumber2: scannedFile.episodeNumber2,
    imdbIdFallback: scannedFile.imdbId,
    sourceFile: scannedFile.sourceFile,
  })

  return {
    mediaType: scannedFile.mediaType,
    tmdbId: show.tmdbId,
    tvdbId: show.tvdbId,
    imdbId: show.imdbId,
    title: show.title,
    year: show.year,
    genres: show.genres,
    posterPath: show.posterPath,
    seasonNumber: show.seasonNumber,
    episodeNumber: show.episodeNumber,
    episodeNumber2: show.episodeNumber2,
    episodeTitle: show.episodeTitle,
  }
}

function trackDeletedJellyfinState(
  context: AppContext,
  jellyfinBatch: JellyfinSyncBatch,
  file: ScannedFile,
): void {
  if (!file.destFile || !file.tmdbId || (file.mediaType !== "Movies" && file.mediaType !== "TvShows")) {
    return
  }

  context.jellyfinSyncCoordinator.recordChange(jellyfinBatch, {
    mediaType: file.mediaType,
    tmdbId: file.tmdbId,
    tvdbId: file.tvdbId,
    imdbId: file.imdbId,
    title: file.title,
    action: "deleted",
    oldDestFile: file.destFile,
    seasonNumber: file.seasonNumber,
    episodeNumber: file.episodeNumber,
    episodeNumber2: file.episodeNumber2,
    structural: true,
  })
}

async function removeTrackedSymlink(
  context: AppContext,
  file: { destFile: string | null; mediaType?: MediaType | null },
): Promise<void> {
  if (!file.destFile) {
    return
  }

  const config = await context.configStore.get()
  const destinationRoot = config.plex.folderMappings.find(
    mapping => mapping.mediaType === file.mediaType,
  )?.destinationFolder

  await removeSymlinkIfExists(file.destFile, destinationRoot)
}

async function recreateSingleSymlink(
  id: number,
  context: AppContext,
  metadataResolver: MediaMetadataResolver,
  jellyfinBatch?: JellyfinSyncBatch,
) {
  const scannedFile = await context.scannedFilesRepo.findById(id)
  if (!scannedFile) {
    throw new HttpError(404, "Scanned file not found")
  }
  if (!scannedFile.mediaType || scannedFile.mediaType === "Extras" || scannedFile.mediaType === "Unknown") {
    throw new HttpError(400, "Scanned file does not support symlink recreation")
  }

  const meta = await resolveSymlinkMeta(id, context, metadataResolver)

  const config = await context.configStore.get()
  const mapping = config.plex.folderMappings.find(m => m.mediaType === scannedFile.mediaType)
  if (!mapping) {
    throw new HttpError(400, `No destination folder mapping for ${scannedFile.mediaType}`)
  }

  const destinationPath = buildDestinationPath(scannedFile.sourceFile, mapping.destinationFolder, meta.mediaType, {
    title: meta.title,
    year: meta.year,
    imdbId: meta.imdbId,
    tvdbId: meta.tvdbId,
    seasonNumber: meta.seasonNumber,
    episodeNumber: meta.episodeNumber,
    episodeNumber2: meta.episodeNumber2,
    episodeTitle: meta.episodeTitle,
  })

  if (scannedFile.destFile && scannedFile.destFile !== destinationPath) {
    await removeSymlinkIfExists(scannedFile.destFile, mapping.destinationFolder)
  }
  await removeSymlinksForSource(
    mapping.destinationFolder,
    scannedFile.sourceFile,
    destinationPath,
  )

  let updated = null
  try {
    await createSymlinkAt(scannedFile.sourceFile, destinationPath)

    updated = await context.scannedFilesRepo.updateProcessed({
      id: scannedFile.id,
      destFile: destinationPath,
      mediaType: meta.mediaType,
      tmdbId: meta.tmdbId,
      tvdbId: meta.tvdbId,
      imdbId: meta.imdbId,
      title: meta.title,
      year: meta.year,
      genres: meta.genres,
      posterPath: meta.posterPath,
      seasonNumber: meta.seasonNumber,
      episodeNumber: meta.episodeNumber,
      episodeNumber2: meta.episodeNumber2,
      status: "Success",
    })
  } catch (error) {
    if (!isDestinationConflictError(error)) {
      throw error
    }

    const conflictPath = (error as { destinationFile?: string }).destinationFile ?? destinationPath
    const existingOwner = await context.scannedFilesRepo.findByDestination(conflictPath)

    if (!existingOwner) {
      context.logger.warn("Removing orphaned conflicting symlink", {
        id: scannedFile.id,
        sourceFile: scannedFile.sourceFile,
        destinationFile: conflictPath,
      })

      await removeSymlinkIfExists(conflictPath, mapping.destinationFolder)

      try {
        await createSymlinkAt(scannedFile.sourceFile, destinationPath)
        updated = await context.scannedFilesRepo.updateProcessed({
          id: scannedFile.id,
          destFile: destinationPath,
          mediaType: meta.mediaType,
          tmdbId: meta.tmdbId,
          tvdbId: meta.tvdbId,
          imdbId: meta.imdbId,
          title: meta.title,
          year: meta.year,
          genres: meta.genres,
          posterPath: meta.posterPath,
          seasonNumber: meta.seasonNumber,
          episodeNumber: meta.episodeNumber,
          episodeNumber2: meta.episodeNumber2,
          status: "Success",
        })
      } catch (retryError) {
        if (!isDestinationConflictError(retryError)) {
          throw retryError
        }
      }
    } else {
      context.logger.warn("Symlink destination conflict during recreation", {
        id: scannedFile.id,
        sourceFile: scannedFile.sourceFile,
        destinationFile: conflictPath,
        existingOwnerId: existingOwner.id,
        existingOwnerSourceFile: existingOwner.sourceFile,
      })
    }

    if (updated) {
      context.logger.info("Recovered symlink from orphaned conflict", {
        id: scannedFile.id,
        destinationFile: destinationPath,
      })
    }

    if (!updated) {
      updated = await context.scannedFilesRepo.updateProcessed({
        id: scannedFile.id,
        destFile: null,
        mediaType: meta.mediaType,
        tmdbId: meta.tmdbId,
        tvdbId: meta.tvdbId,
        imdbId: meta.imdbId,
        title: meta.title,
        year: meta.year,
        genres: meta.genres,
        posterPath: meta.posterPath,
        seasonNumber: meta.seasonNumber,
        episodeNumber: meta.episodeNumber,
        episodeNumber2: meta.episodeNumber2,
        status: "Duplicate",
      })
    }
  }

  if (updated) {
    if (jellyfinBatch && updated.mediaType && (updated.mediaType === "Movies" || updated.mediaType === "TvShows")) {
      context.jellyfinSyncCoordinator.recordChange(jellyfinBatch, {
        mediaType: updated.mediaType,
        tmdbId: updated.tmdbId,
        tvdbId: updated.tvdbId,
        imdbId: updated.imdbId,
        title: updated.title,
        action: scannedFile.destFile ? "updated" : "added",
        oldDestFile: scannedFile.destFile,
        newDestFile: updated.destFile,
        seasonNumber: updated.seasonNumber,
        episodeNumber: updated.episodeNumber,
        episodeNumber2: updated.episodeNumber2,
        structural: scannedFile.destFile !== updated.destFile,
      })
    }
    context.wsHub.broadcast("file.updated", updated)
  }

  return updated
}

async function buildDashboardRecentItem(
  item: Awaited<ReturnType<AppContext["scannedFilesRepo"]["dashboardSummary"]>>["recentItems"][number],
  context: AppContext,
): Promise<DashboardRecentItem> {
  let imagePath = item.posterPath
  let imageKind: DashboardRecentItem["imageKind"] = "poster"
  let episodeTitle: string | null = null

  if (item.mediaType === "TvShows" && item.seasonNumber && item.episodeNumber) {
    try {
      const episode = await context.tmdb.getTvEpisode(item.tmdbId, item.seasonNumber, item.episodeNumber)
      if (episode.still_path) {
        imagePath = episode.still_path
        imageKind = "still"
      }
      episodeTitle = episode.name ?? null
    } catch {
    }
  }

  return {
    id: item.id,
    mediaType: item.mediaType,
    tmdbId: item.tmdbId,
    title: item.title,
    year: item.year,
    posterPath: item.posterPath,
    imagePath,
    imageKind,
    episodeTitle,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    episodeNumber2: item.episodeNumber2,
    sourceFile: item.sourceFile,
    destFile: item.destFile,
    fileSize: item.fileSize,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function timestampValue(value: string | null | undefined): number {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function inferredUnidentifiedKind(file: ScannedFile): "unidentified-tv" | "unidentified-movie" {
  return parseSourceEpisodeMatch(file.sourceFile) ? "unidentified-tv" : "unidentified-movie"
}

function triagePriorityForMissing(missingEpisodes: number): TriageInboxItem["priority"] {
  if (missingEpisodes >= 12) {
    return "critical"
  }
  if (missingEpisodes >= 5) {
    return "high"
  }
  if (missingEpisodes >= 2) {
    return "medium"
  }
  return "low"
}

function formatSourceFolder(path: string): string {
  const label = basename(path)
  return label.length > 0 ? label : path
}

function buildTrackedEpisodeMap(files: ScannedFile[]): Map<number, Set<number>> {
  const trackedBySeason = new Map<number, Set<number>>()

  for (const file of files) {
    if (file.status !== "Success" || !file.seasonNumber || !file.episodeNumber || file.seasonNumber <= 0 || file.episodeNumber <= 0) {
      continue
    }

    const seasonSet = trackedBySeason.get(file.seasonNumber) ?? new Set<number>()
    const endEpisode = file.episodeNumber2 !== null && file.episodeNumber2 > file.episodeNumber
      ? file.episodeNumber2
      : file.episodeNumber

    for (let episodeNumber = file.episodeNumber; episodeNumber <= endEpisode; episodeNumber += 1) {
      seasonSet.add(episodeNumber)
    }

    trackedBySeason.set(file.seasonNumber, seasonSet)
  }

  return trackedBySeason
}

function countTrackedEpisodes(trackedBySeason: Map<number, Set<number>>): number {
  let total = 0
  for (const episodes of trackedBySeason.values()) {
    total += episodes.size
  }
  return total
}

function formatSeasonLabel(seasonNumber: number): string {
  return `Season ${String(seasonNumber).padStart(2, "0")}`
}

function summarizeMissingSeasons(missingSeasons: number[]): string | null {
  if (missingSeasons.length === 0) {
    return null
  }
  if (missingSeasons.length === 1) {
    return `Missing in ${formatSeasonLabel(missingSeasons[0])}`
  }
  const labels = missingSeasons.slice(0, 3).map(formatSeasonLabel)
  return `Missing in ${labels.join(", ")}${missingSeasons.length > 3 ? ` +${missingSeasons.length - 3} more` : ""}`
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const results = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor
        cursor += 1
        if (index >= items.length) {
          return
        }
        results[index] = await mapper(items[index], index)
      }
    }),
  )

  return results
}

async function buildWantedTriageItems(
  context: AppContext,
  episodeSourceService: TvEpisodeSourceService,
  searchTerm?: string,
): Promise<TriageInboxItem[]> {
  const titles = await context.scannedFilesRepo.listForTmdbTitles("TvShows", searchTerm)
  const todayIso = new Date().toISOString().slice(0, 10)

  const items: Array<TriageInboxItem | null> = await mapWithConcurrency(
    titles.filter((title): title is typeof title & { tmdbId: number } => title.tmdbId !== null),
    6,
    async title => {
      const tmdbId = title.tmdbId
      try {
        const [show, sourceSelection, trackedFiles, episodeGroupSelection] = await Promise.all([
          context.tmdb.getTv(tmdbId),
          episodeSourceService.getSelection(tmdbId),
          context.scannedFilesRepo.listByTmdbId(tmdbId, "TvShows"),
          context.db
            .select({
              episodeGroupId: tvEpisodeGroupSelections.episodeGroupId,
              episodeGroupName: tvEpisodeGroupSelections.episodeGroupName,
            })
            .from(tvEpisodeGroupSelections)
            .where(eq(tvEpisodeGroupSelections.tmdbId, tmdbId))
            .limit(1),
        ])

        const trackedBySeason = buildTrackedEpisodeMap(trackedFiles)
        const scannedEpisodes = countTrackedEpisodes(trackedBySeason)
        let airedEpisodes = 0
        const expectedBySeason = new Map<number, number>()

        if (sourceSelection.source === "tvdb" && sourceSelection.tvdbId) {
          const tvdbEpisodes = await context.tvdb.getSeriesEpisodes(
            sourceSelection.tvdbId,
            sourceSelection.tvdbSeasonType ?? "default",
          )

          for (const episode of tvdbEpisodes) {
            if (episode.seasonNumber <= 0 || episode.number <= 0) {
              continue
            }
            if (episode.aired && episode.aired > todayIso) {
              continue
            }
            airedEpisodes += 1
            expectedBySeason.set(episode.seasonNumber, (expectedBySeason.get(episode.seasonNumber) ?? 0) + 1)
          }
        } else {
          const seasonNumbers = (show.seasons ?? [])
            .map(season => season.season_number)
            .filter((seasonNumber): seasonNumber is number => Number.isInteger(seasonNumber) && seasonNumber > 0)

          const seasonPayloads = await mapWithConcurrency(seasonNumbers, 4, async seasonNumber => {
            try {
              return await context.tmdb.getTvSeason(tmdbId, seasonNumber)
            } catch {
              return null
            }
          })

          for (const season of seasonPayloads) {
            if (!season) {
              continue
            }

            let airedCountForSeason = 0
            for (const episode of season.episodes ?? []) {
              if (!episode.episode_number || episode.episode_number <= 0) {
                continue
              }
              if (episode.air_date && episode.air_date > todayIso) {
                continue
              }
              airedCountForSeason += 1
            }

            if (airedCountForSeason <= 0) {
              continue
            }

            airedEpisodes += airedCountForSeason
            expectedBySeason.set(season.season_number, airedCountForSeason)
          }
        }

        const missingEpisodes = Math.max(0, airedEpisodes - scannedEpisodes)
        const lastAirDate = show.last_air_date ?? null
        if (missingEpisodes <= 0 || airedEpisodes <= 0) {
          return null
        }

        const missingSeasons = [...expectedBySeason.entries()]
          .filter(([seasonNumber, expectedCount]) => (trackedBySeason.get(seasonNumber)?.size ?? 0) < expectedCount)
          .map(([seasonNumber]) => seasonNumber)
          .sort((left, right) => left - right)
        const missingSeasonSummary = summarizeMissingSeasons(missingSeasons)
        const firstMissingSeason = missingSeasons[0] ?? null

        let diagnosticsSummary = "Aired episodes are missing from the tracked library files."
        if (sourceSelection.source === "tvdb") {
          diagnosticsSummary = "TVDB ordering is active, so gaps may be caused by an alternate season order."
        } else if (episodeGroupSelection[0]?.episodeGroupId) {
          diagnosticsSummary = "A TMDb episode group override is active, so gaps may be caused by a custom order."
        } else if (scannedEpisodes === 0) {
          diagnosticsSummary = "No successful TV files are currently tracked for this show."
        }
        if (missingSeasonSummary) {
          diagnosticsSummary = `${diagnosticsSummary} ${missingSeasonSummary}.`
        }

        const lastActivityAt = trackedFiles.reduce<string | null>((latest, file) => {
          const candidate = file.updatedAt ?? file.createdAt
          if (!latest) {
            return candidate
          }
          return timestampValue(candidate) > timestampValue(latest) ? candidate : latest
        }, lastAirDate)

        return {
          id: `wanted-show:${tmdbId}`,
          kind: "wanted-show",
          entityType: "show",
          entityId: String(tmdbId),
          title: show.name,
          subtitle: `${missingEpisodes} aired episode${missingEpisodes === 1 ? "" : "s"} missing from the library${missingSeasonSummary ? ` · ${missingSeasonSummary}` : ""}`,
          priority: triagePriorityForMissing(missingEpisodes),
          recommendedAction: firstMissingSeason ? `Inspect ${formatSeasonLabel(firstMissingSeason)} and search from the show view` : "Inspect missing seasons and search from the show view",
          counts: {
            files: trackedFiles.filter(file => file.status === "Success").length,
            missingEpisodes,
            scannedEpisodes,
            airedEpisodes,
            missingSeasons,
          },
          lastActivityAt,
          deepLink: firstMissingSeason ? `/shows/${tmdbId}?season=${firstMissingSeason}#season-${firstMissingSeason}` : `/shows/${tmdbId}`,
          tmdbId,
          imdbId: null,
          mediaType: "TvShows",
          sourceFolder: null,
          fileIds: trackedFiles.map(file => file.id),
          sampleFiles: [],
          diagnosticsSummary,
        } satisfies TriageInboxItem
      } catch {
        return null
      }
    },
  )

  return items
    .filter((item): item is TriageInboxItem => item !== null)
    .sort((left, right) => {
      const missingDiff = (right.counts.missingEpisodes ?? 0) - (left.counts.missingEpisodes ?? 0)
      if (missingDiff !== 0) {
        return missingDiff
      }
      return left.title.localeCompare(right.title)
    })
}

function buildAttentionTriageItems(files: ScannedFile[]): TriageInboxItem[] {
  const groups = new Map<string, {
    kind: TriageInboxItem["kind"]
    entityType: TriageInboxItem["entityType"]
    entityId: string
    title: string
    subtitle: string
    priority: TriageInboxItem["priority"]
    recommendedAction: string
    deepLink: string
    tmdbId?: number | null
    mediaType?: MediaType | null
    sourceFolder?: string | null
    diagnosticsSummary?: string | null
    files: ScannedFile[]
  }>()

  for (const file of files) {
    const sourceFolder = dirname(file.sourceFile)
    const kind = file.status === "Duplicate"
      ? "duplicate-file"
      : file.status === "Failed"
        ? "failed-file"
        : inferredUnidentifiedKind(file)
    const canRouteToEntity = file.tmdbId !== null && (file.mediaType === "TvShows" || file.mediaType === "Movies")
    const entityType: TriageInboxItem["entityType"] = canRouteToEntity
      ? (file.mediaType === "TvShows" ? "show" : "movie")
      : "folder"
    const entityId = canRouteToEntity ? String(file.tmdbId) : sourceFolder
    const key = `${kind}:${entityType}:${entityId}`
    const existing = groups.get(key)

    if (existing) {
      existing.files.push(file)
      continue
    }

    const title = entityType === "folder"
      ? formatSourceFolder(sourceFolder)
      : (file.title ?? `TMDb ${file.tmdbId}`)

    const subtitle = kind === "duplicate-file"
      ? "Duplicate or conflicting rows need cleanup"
      : kind === "failed-file"
        ? "One or more files failed processing"
        : kind === "unidentified-tv"
          ? "TV files still need a show identity"
          : "Movie files still need a movie identity"

    const recommendedAction = kind === "duplicate-file"
      ? "Retry symlink build or mark extras"
      : kind === "failed-file"
        ? "Inspect the files and reprocess the affected rows"
        : kind === "unidentified-tv"
          ? "Identify as TV show"
          : "Identify as movie"

    const priority: TriageInboxItem["priority"] = kind === "duplicate-file"
      ? "high"
      : kind === "failed-file"
        ? "high"
        : "medium"

    const deepLink = canRouteToEntity
      ? (file.mediaType === "TvShows" ? `/shows/${file.tmdbId}` : `/movies/${file.tmdbId}`)
      : "/unidentified"

    const diagnosticsSummary = kind === "duplicate-file"
      ? "A destination conflict prevented this file from owning its library path."
      : kind === "failed-file"
        ? "The ingest pipeline did not finish successfully for at least one file in this group."
        : "The file parser has not produced a confirmed media identity yet."

    groups.set(key, {
      kind,
      entityType,
      entityId,
      title,
      subtitle,
      priority,
      recommendedAction,
      deepLink,
      tmdbId: file.tmdbId,
      mediaType: file.mediaType,
      sourceFolder,
      diagnosticsSummary,
      files: [file],
    })
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const lastActivityAt = group.files.reduce<string | null>((latest, file) => {
        const candidate = file.updatedAt ?? file.createdAt
        if (!latest) {
          return candidate
        }
        return timestampValue(candidate) > timestampValue(latest) ? candidate : latest
      }, null)

      return {
        id: key,
        kind: group.kind,
        entityType: group.entityType,
        entityId: group.entityId,
        title: group.title,
        subtitle: `${group.subtitle} · ${group.files.length} file${group.files.length === 1 ? "" : "s"}`,
        priority: group.priority,
        recommendedAction: group.recommendedAction,
        counts: {
          files: group.files.length,
        },
        lastActivityAt,
        deepLink: group.deepLink,
        tmdbId: group.tmdbId ?? null,
        mediaType: group.mediaType ?? null,
        sourceFolder: group.sourceFolder ?? null,
        fileIds: group.files.map(file => file.id),
        sampleFiles: group.files.slice(0, 3),
        diagnosticsSummary: group.diagnosticsSummary ?? null,
      } satisfies TriageInboxItem
    })
    .sort((left, right) => timestampValue(right.lastActivityAt) - timestampValue(left.lastActivityAt))
}

async function buildEpisodeOrderTriageItems(
  context: AppContext,
  episodeSourceService: TvEpisodeSourceService,
  searchTerm?: string,
): Promise<TriageInboxItem[]> {
  const [sourceRows, groupRows] = await Promise.all([
    context.db
      .select({
        tmdbId: tvEpisodeSourceSelections.tmdbId,
      })
      .from(tvEpisodeSourceSelections),
    context.db
      .select({
        tmdbId: tvEpisodeGroupSelections.tmdbId,
        episodeGroupId: tvEpisodeGroupSelections.episodeGroupId,
        episodeGroupName: tvEpisodeGroupSelections.episodeGroupName,
      })
      .from(tvEpisodeGroupSelections),
  ])

  const tmdbIds = [...new Set([
    ...sourceRows.map(row => row.tmdbId),
    ...groupRows.map(row => row.tmdbId),
  ])]

  const items: Array<TriageInboxItem | null> = await mapWithConcurrency(tmdbIds, 6, async tmdbId => {
    const [sourceSelection, groupSelection, trackedFiles] = await Promise.all([
      episodeSourceService.getSelection(tmdbId),
      context.db
        .select({
          episodeGroupId: tvEpisodeGroupSelections.episodeGroupId,
          episodeGroupName: tvEpisodeGroupSelections.episodeGroupName,
        })
        .from(tvEpisodeGroupSelections)
        .where(eq(tvEpisodeGroupSelections.tmdbId, tmdbId))
        .limit(1),
      context.scannedFilesRepo.listByTmdbId(tmdbId, "TvShows"),
    ])

    const hasNonDefaultSource = sourceSelection.source === "tvdb"
    const group = groupSelection[0] ?? null
    if (!hasNonDefaultSource && !group?.episodeGroupId) {
      return null
    }

    const title = trackedFiles[0]?.title ?? `TMDb ${tmdbId}`
    if (searchTerm && !title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return null
    }

    const lastActivityAt = trackedFiles.reduce<string | null>((latest, file) => {
      const candidate = file.updatedAt ?? file.createdAt
      if (!latest) {
        return candidate
      }
      return timestampValue(candidate) > timestampValue(latest) ? candidate : latest
    }, null)

    const sourceLabel = hasNonDefaultSource
      ? `TVDB ${sourceSelection.tvdbSeriesName ?? `#${sourceSelection.tvdbId}`}`
      : null
    const groupLabel = group?.episodeGroupName ?? null
    const summary = sourceLabel && groupLabel
      ? `Using ${sourceLabel} and TMDb group ${groupLabel}.`
      : sourceLabel
        ? `Using ${sourceLabel} as the active episode order.`
        : `Using TMDb group ${groupLabel}.`

    return {
      id: `episode-order:${tmdbId}`,
      kind: "episode-order",
      entityType: "show",
      entityId: String(tmdbId),
      title,
      subtitle: summary,
      priority: "medium",
      recommendedAction: "Review episode ordering and missing seasons from the show view",
      counts: {
        files: trackedFiles.length,
      },
      lastActivityAt,
      deepLink: `/shows/${tmdbId}`,
      tmdbId,
      mediaType: "TvShows",
      sourceFolder: trackedFiles[0] ? dirname(trackedFiles[0].sourceFile) : null,
      fileIds: trackedFiles.map(file => file.id),
      sampleFiles: trackedFiles.slice(0, 3),
      diagnosticsSummary: summary,
    } satisfies TriageInboxItem
  })

  return items
    .filter((item): item is TriageInboxItem => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title))
}

async function buildScannedFileDiagnostics(
  file: ScannedFile,
  context: AppContext,
  metadataResolver: MediaMetadataResolver,
  episodeSourceService: TvEpisodeSourceService,
): Promise<ScannedFileDiagnostics> {
  const tvParse = parseSourceEpisodeMatch(file.sourceFile)
  const movieParse = detectMovieFromFileName(file.sourceFile)
  const inferredMediaKind = tvParse ? "tv" : movieParse ? "movie" : "unknown"

  const [identityRows, aliasRows, episodeGroupSelection] = file.tmdbId
    ? await Promise.all([
      context.db
        .select({
          normalizedTitle: seriesIdentityMap.normalizedTitle,
          canonicalTitle: seriesIdentityMap.canonicalTitle,
        })
        .from(seriesIdentityMap)
        .where(eq(seriesIdentityMap.tmdbId, file.tmdbId)),
      context.db
        .select({ aliasNormalized: seriesAliases.aliasNormalized })
        .from(seriesAliases)
        .innerJoin(seriesIdentityMap, eq(seriesAliases.identityId, seriesIdentityMap.id))
        .where(eq(seriesIdentityMap.tmdbId, file.tmdbId)),
      file.mediaType === "TvShows"
        ? context.db
          .select({
            episodeGroupId: tvEpisodeGroupSelections.episodeGroupId,
            episodeGroupName: tvEpisodeGroupSelections.episodeGroupName,
          })
          .from(tvEpisodeGroupSelections)
          .where(eq(tvEpisodeGroupSelections.tmdbId, file.tmdbId))
          .limit(1)
        : Promise.resolve([]),
    ])
    : [[], [], []]

  const sourceSelection = file.tmdbId && file.mediaType === "TvShows"
    ? await episodeSourceService.getSelection(file.tmdbId)
    : null

  const resolvedTv = file.tmdbId && file.mediaType === "TvShows" && file.seasonNumber && file.episodeNumber
    ? await metadataResolver.resolveTv({
      tmdbId: file.tmdbId,
      seasonNumber: file.seasonNumber,
      episodeNumber: file.episodeNumber,
      episodeNumber2: file.episodeNumber2,
      imdbIdFallback: file.imdbId,
      sourceFile: file.sourceFile,
    }).catch(() => null)
    : null

  const explanations: string[] = []
  if (file.status === "Duplicate") {
    explanations.push("This row was marked duplicate because another file already owned the destination path.")
  }
  if (file.status === "Failed") {
    explanations.push("This row failed during processing and did not complete library organization.")
  }
  if (file.mediaType === "Unknown" || file.tmdbId === null) {
    explanations.push("The file does not have a confirmed media identity yet.")
  }
  if (resolvedTv?.episodeRemap) {
    explanations.push("Episode compaction was detected, so the stored episode numbers were remapped to the active order.")
  }
  if (sourceSelection?.source === "tvdb") {
    explanations.push("TVDB ordering is active for this show, so season numbering may differ from TMDb.")
  }
  if (episodeGroupSelection[0]?.episodeGroupId) {
    explanations.push("A TMDb episode group override is active for this show.")
  }

  return {
    file,
    inferredMediaKind,
    parseSnapshot: {
      rawTitleHint: tvParse?.titleHint ?? movieParse?.title ?? null,
      normalizedTitleHint: tvParse ? normalizeTitle(tvParse.titleHint) : movieParse?.normalizedTitle ?? null,
      yearHint: movieParse?.year ?? extractYear(file.sourceFile),
      seasonNumber: tvParse?.seasonNumber ?? null,
      episodeNumber: tvParse?.episodeNumber ?? null,
      episodeNumber2: tvParse?.episodeNumber2 ?? null,
    },
    identitySnapshot: {
      mediaType: file.mediaType,
      tmdbId: file.tmdbId,
      tvdbId: file.tvdbId,
      imdbId: file.imdbId,
      storedTitle: file.title,
      storedYear: file.year,
      canonicalTitle: identityRows[0]?.canonicalTitle ?? null,
      normalizedTitle: identityRows[0]?.normalizedTitle ?? null,
      aliases: aliasRows.map(row => row.aliasNormalized),
    },
    orderingSnapshot: {
      episodeSource: sourceSelection?.source ?? null,
      tvdbSeriesName: sourceSelection?.tvdbSeriesName ?? null,
      tvdbSeasonType: sourceSelection?.tvdbSeasonType ?? null,
      episodeGroupId: episodeGroupSelection[0]?.episodeGroupId ?? null,
      episodeGroupName: episodeGroupSelection[0]?.episodeGroupName ?? null,
      storedSeasonNumber: file.seasonNumber,
      storedEpisodeNumber: file.episodeNumber,
      storedEpisodeNumber2: file.episodeNumber2,
      resolvedSeasonNumber: resolvedTv?.seasonNumber ?? null,
      resolvedEpisodeNumber: resolvedTv?.episodeNumber ?? null,
      resolvedEpisodeNumber2: resolvedTv?.episodeNumber2 ?? null,
      episodeRemap: resolvedTv?.episodeRemap ?? file.episodeRemap ?? null,
    },
    processingSnapshot: {
      status: file.status,
      destinationFile: file.destFile,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      versionUpdated: file.versionUpdated,
      updateToVersion: file.updateToVersion,
    },
    explanations,
  }
}

export function createScannedFilesRouter(context: AppContext) {
  const router = new Hono()
  const metadataResolver = new MediaMetadataResolver(context.db, () => context.tmdb, () => context.tvdb)
  const episodeSourceService = new TvEpisodeSourceService(context.db, () => context.tmdb, () => context.tvdb)

  router.get(ENTRYPOINTS.api.scannedFiles.base, async c => {
    const result = await context.scannedFilesRepo.list({
      status: (c.req.query("status") as MediaStatus | undefined) ?? undefined,
      mediaType: (c.req.query("mediaType") as MediaType | undefined) ?? undefined,
      searchTerm: c.req.query("searchTerm") ?? undefined,
      sortBy: c.req.query("sortBy") ?? undefined,
      sortOrder: c.req.query("sortOrder") ?? undefined,
      page: parseNumber(c.req.query("page") ?? null, 1),
      pageSize: parseNumber(c.req.query("pageSize") ?? null, 30),
      ids: (c.req.queries("ids") ?? []).map(Number).filter(v => Number.isInteger(v)),
    })

    return c.json(result)
  })

  router.get(ENTRYPOINTS.api.scannedFiles.stats, async c => {
    const stats = await context.scannedFilesRepo.stats()
    return c.json(stats)
  })

  router.get(ENTRYPOINTS.api.scannedFiles.dashboard, async c => {
    const dashboard = await context.scannedFilesRepo.dashboardSummary(6)
    const recentItems = await Promise.all(dashboard.recentItems.map(item => buildDashboardRecentItem(item, context)))
    return c.json({
      ...dashboard,
      recentItems,
    })
  })

  router.get(ENTRYPOINTS.api.scannedFiles.inbox, async c => {
    const searchTerm = c.req.query("searchTerm")?.trim() ?? ""
    const attentionFiles = await context.scannedFilesRepo.listAttentionCandidates(searchTerm || undefined)
    const [wantedItems, episodeOrderItems] = await Promise.all([
      buildWantedTriageItems(context, episodeSourceService, searchTerm || undefined),
      buildEpisodeOrderTriageItems(context, episodeSourceService, searchTerm || undefined),
    ])

    const attentionItems = buildAttentionTriageItems(attentionFiles)
    const items = [...wantedItems, ...episodeOrderItems, ...attentionItems]
      .sort((left, right) => {
        const priorityOrder: Record<TriageInboxItem["priority"], number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        }
        const byPriority = priorityOrder[left.priority] - priorityOrder[right.priority]
        if (byPriority !== 0) {
          return byPriority
        }
        return timestampValue(right.lastActivityAt) - timestampValue(left.lastActivityAt)
      })

    const summary: TriageInboxResponse["summary"] = {
      totalItems: items.length,
      wantedShows: wantedItems.length,
      missingEpisodes: wantedItems.reduce((total, item) => total + (item.counts.missingEpisodes ?? 0), 0),
      unidentifiedTv: attentionItems.filter(item => item.kind === "unidentified-tv").reduce((total, item) => total + item.counts.files, 0),
      unidentifiedMovies: attentionItems.filter(item => item.kind === "unidentified-movie").reduce((total, item) => total + item.counts.files, 0),
      failedFiles: attentionItems.filter(item => item.kind === "failed-file").reduce((total, item) => total + item.counts.files, 0),
      duplicateFiles: attentionItems.filter(item => item.kind === "duplicate-file").reduce((total, item) => total + item.counts.files, 0),
      episodeOrderShows: episodeOrderItems.length,
    }

    return c.json({
      items,
      summary,
    } satisfies TriageInboxResponse)
  })

  router.get(ENTRYPOINTS.api.scannedFiles.tmdbIdsAndTitles, async c => {
    const mediaType = (c.req.query("mediaType") as MediaType | undefined) ?? undefined
    const result = await context.scannedFilesRepo.listForTmdbTitles(
      mediaType,
      c.req.query("searchTerm") ?? undefined,
    )
    if (mediaType !== "Movies" && mediaType !== "TvShows") {
      return c.json(result.map(item => ({ ...item, jellyfin: null })))
    }

    const summaries = await context.jellyfinSyncRepo.findSummariesByMediaTmdbIds(
      mediaType,
      result.map(item => item.tmdbId).filter((tmdbId): tmdbId is number => tmdbId !== null),
    )

    return c.json(result.map(item => ({
      ...item,
      jellyfin: item.tmdbId !== null ? summaries.get(item.tmdbId) ?? null : null,
    })))
  })

  router.delete(ENTRYPOINTS.api.scannedFiles.batchDelete, async c => {
    const body = await parseJson<number[] | { ids: number[] }>(c.req.raw)
    const ids = Array.isArray(body) ? body : body.ids
    if (!ids || ids.length === 0) {
      return c.json({ error: "No IDs provided" }, 400)
    }

    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()
    const deleted = await context.scannedFilesRepo.deleteByIds(ids)
    for (const item of deleted) {
      trackDeletedJellyfinState(context, jellyfinBatch, item)
      await removeTrackedSymlink(context, item)
      context.wsHub.broadcast("file.removed", item)
    }

    const config = await context.configStore.get()
    for (const mapping of config.plex.folderMappings) {
      await cleanupDeadSymlinks(mapping.destinationFolder)
    }
    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)

    return c.json({ deletedIds: deleted.map(item => item.id) })
  })

  /* ── Batch update (dry-run + apply) ── */

  router.patch(ENTRYPOINTS.api.scannedFiles.batchUpdate, async c => {
    const body = await parseJson<BulkUpdateRequest>(c.req.raw)
    if (!body.updates || body.updates.length === 0) {
      return c.json({ error: "No updates provided" }, 400)
    }

    context.logger.info("Batch identify request received", {
      totalUpdates: body.updates.length,
      dryRun: body.dryRun === true,
      hasIdentityUpdate: Boolean(body.identityUpdate),
    })

    const isDryRun = body.dryRun === true
    const identityService = new SeriesIdentityService(context.db, context.tmdb)

    /* ── Dry-run mode ── */
    if (isDryRun) {
      const conflicts: BulkUpdateConflict[] = []
      let willUpdate = 0

      for (const item of body.updates) {
        const existing = await context.scannedFilesRepo.findById(item.id)
        if (!existing) {
          conflicts.push({ id: item.id, sourceFile: "", reason: "File not found" })
          continue
        }
        willUpdate += 1
      }

      let identityUpdatePreview: BulkUpdateDryRunResponse["identityUpdate"] = null
      if (body.identityUpdate) {
        const counts = await identityService.countForTmdbId(body.identityUpdate.oldTmdbId)
        identityUpdatePreview = {
          identitiesWillUpdate: counts.identities,
          aliasesWillRedirect: counts.aliases,
        }
      }

      const result: BulkUpdateDryRunResponse = {
        totalFiles: body.updates.length,
        willUpdate,
        conflicts,
        identityUpdate: identityUpdatePreview,
      }
      context.logger.info("Batch identify dry-run completed", {
        totalFiles: result.totalFiles,
        willUpdate: result.willUpdate,
        conflicts: result.conflicts.length,
      })
      return c.json(result)
    }

    /* ── Apply mode ── */

    // Step 1: Identity update (if applicable)
    let identityUpdated = false
    if (body.identityUpdate) {
      await identityService.reassignIdentity(body.identityUpdate)
      identityUpdated = true
    }

    // Step 2: Chunked file updates
    const CHUNK_SIZE = 50
    let updatedCount = 0
    const failed: Array<{ id: number; error: string }> = []
    const updatedIds: number[] = []
    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()

    for (let i = 0; i < body.updates.length; i += CHUNK_SIZE) {
      const chunk = body.updates.slice(i, i + CHUNK_SIZE)

      for (const item of chunk) {
        try {
          const existing = await context.scannedFilesRepo.findById(item.id)
          if (!existing) {
            failed.push({ id: item.id, error: "Not found" })
            context.logger.warn("Batch identify skipped missing file", { id: item.id })
            continue
          }

          if (item.mediaType === "Extras") {
            if (existing.destFile) {
              trackDeletedJellyfinState(context, jellyfinBatch, existing)
              await removeTrackedSymlink(context, existing)
            }
            const updated = await context.scannedFilesRepo.markAsExtra(item.id)
            if (updated) {
              context.wsHub.broadcast("file.updated", updated)
              updatedCount += 1
            }
          } else {
            if (
              existing.destFile &&
              existing.tmdbId &&
              (existing.mediaType === "Movies" || existing.mediaType === "TvShows") &&
              (
                item.tmdbId !== undefined && item.tmdbId !== existing.tmdbId
                || item.mediaType !== undefined && item.mediaType !== existing.mediaType
                || item.seasonNumber !== undefined && item.seasonNumber !== existing.seasonNumber
                || item.episodeNumber !== undefined && item.episodeNumber !== existing.episodeNumber
                || item.episodeNumber2 !== undefined && item.episodeNumber2 !== existing.episodeNumber2
              )
            ) {
              trackDeletedJellyfinState(context, jellyfinBatch, existing)
            }
            const updated = await context.scannedFilesRepo.updateById(item.id, {
              tmdbId: item.tmdbId,
              seasonNumber: item.seasonNumber,
              episodeNumber: item.episodeNumber,
              episodeNumber2: item.episodeNumber2,
              mediaType: item.mediaType,
            })
            if (updated) {
              context.wsHub.broadcast("file.updated", updated)
              updatedCount += 1
              updatedIds.push(item.id)
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error"
          failed.push({ id: item.id, error: errorMessage })
          context.logger.warn("Batch identify update failed", {
            id: item.id,
            error: errorMessage,
          })
        }
      }
    }

    // Step 3: Chunked symlink recreation for non-Extras/Unknown updated files
    const SYMLINK_CHUNK_SIZE = 10
    let symlinksRecreated = 0
    let symlinksFailed = 0

    for (let i = 0; i < updatedIds.length; i += SYMLINK_CHUNK_SIZE) {
      const chunk = updatedIds.slice(i, i + SYMLINK_CHUNK_SIZE)

      for (const id of chunk) {
        try {
          await recreateSingleSymlink(id, context, metadataResolver, jellyfinBatch)
          symlinksRecreated += 1
        } catch (err) {
          symlinksFailed += 1
          context.logger.warn("Batch identify symlink recreation failed", {
            id,
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
    }

    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)

    const result: BulkUpdateApplyResponse = {
      updated: updatedCount,
      failed,
      symlinksRecreated,
      symlinksFailed,
      identityUpdated,
    }
    context.logger.info("Batch identify apply completed", {
      updated: result.updated,
      failed: result.failed.length,
      symlinksRecreated: result.symlinksRecreated,
      symlinksFailed: result.symlinksFailed,
      identityUpdated: result.identityUpdated,
    })
    context.wsHub.broadcast("library.changed", {
      source: "batch-update",
      updated: result.updated,
      failed: result.failed.length,
      symlinksRecreated: result.symlinksRecreated,
      symlinksFailed: result.symlinksFailed,
      identityUpdated: result.identityUpdated,
    })
    return c.json(result)
  })

  router.post(ENTRYPOINTS.api.scannedFiles.recreateSymlinks, async c => {
    const all = await context.scannedFilesRepo.listSuccessfulWithDestination()
    let successCount = 0
    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()

    for (const entry of all) {
      try {
        await recreateSingleSymlink(entry.id, context, metadataResolver, jellyfinBatch)
        successCount += 1
      } catch {
      }
    }

    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)

    context.wsHub.broadcast("library.changed", {
      source: "recreate-symlinks",
      successCount,
    })

    return c.json({ successCount })
  })

  router.patch(ENTRYPOINTS.api.scannedFiles.recreateSymlinkById, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()
    const updated = await recreateSingleSymlink(id, context, metadataResolver, jellyfinBatch)
    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)
    return c.json(updated)
  })

  router.get(ENTRYPOINTS.api.scannedFiles.byId, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const item = await context.scannedFilesRepo.findById(id)
    if (!item) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json(item)
  })

  router.get(ENTRYPOINTS.api.scannedFiles.diagnosticsById, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const item = await context.scannedFilesRepo.findById(id)
    if (!item) {
      return c.json({ error: "Not found" }, 404)
    }

    const diagnostics = await buildScannedFileDiagnostics(item, context, metadataResolver, episodeSourceService)
    return c.json(diagnostics)
  })

  router.patch(ENTRYPOINTS.api.scannedFiles.byId, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const body = await parseJson<UpdateScannedFileRequest>(c.req.raw)
    const existing = await context.scannedFilesRepo.findById(id)
    if (!existing) {
      return c.json({ error: "Not found" }, 404)
    }

    if (body.mediaType === "Extras" && existing.destFile) {
      const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()
      trackDeletedJellyfinState(context, jellyfinBatch, existing)
      await removeTrackedSymlink(context, existing)
      await context.jellyfinSyncCoordinator.flush(jellyfinBatch)
    }

    const updated = body.mediaType === "Extras"
      ? await context.scannedFilesRepo.markAsExtra(id)
      : await context.scannedFilesRepo.updateById(id, body)

    if (!updated) {
      return c.json({ error: "Not found" }, 404)
    }

    context.wsHub.broadcast("file.updated", updated)
    return c.json(updated)
  })

  router.delete(ENTRYPOINTS.api.scannedFiles.byId, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()
    const deleted = await context.scannedFilesRepo.deleteById(id)
    if (!deleted) {
      return c.json({ error: "Not found" }, 404)
    }
    trackDeletedJellyfinState(context, jellyfinBatch, deleted)
    await removeTrackedSymlink(context, deleted)
    context.wsHub.broadcast("file.removed", deleted)
    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)
    return c.json({ deletedId: id })
  })

  router.delete(ENTRYPOINTS.api.scannedFiles.base, async c => {
    const ids = parseIds(c.req.query("ids") ?? null)
    if (ids.length === 0) {
      return c.json({ error: "No ids provided" }, 400)
    }

    const jellyfinBatch = context.jellyfinSyncCoordinator.beginBatch()
    const deleted = await context.scannedFilesRepo.deleteByIds(ids)
    for (const item of deleted) {
      trackDeletedJellyfinState(context, jellyfinBatch, item)
      await removeTrackedSymlink(context, item)
      context.wsHub.broadcast("file.removed", item)
    }
    await context.jellyfinSyncCoordinator.flush(jellyfinBatch)
    return c.json({ deletedIds: deleted.map(item => item.id) })
  })

  return router
}
