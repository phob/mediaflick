import { basename, dirname, extname } from "node:path"
import { Hono } from "hono"
import { and, eq, sql } from "drizzle-orm"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { normalizeTitle } from "@/modules/detection/normalization"
import {
  applySeasonRemap,
  buildSeasonRemapPlan,
  createEpisodeRemapInfo,
  parseSourceEpisodeTuple,
  type SourceEpisodeTuple,
} from "@/modules/media-lookup/tv-season-remapper"
import type { TmdbCastMember } from "@/modules/media-lookup/tmdb-client"
import { scannedFiles, seriesAliases, seriesIdentityMap, tvEpisodeGroupSelections } from "@/db/schema"
import { parseJson } from "@/shared/http"
import type { EpisodeInfo, MediaCastMember, MediaInfo, MediaSearchResult, ScannedFile, SeasonInfo } from "@/shared/types"

interface EpisodeGroupSelectionRequest {
  episodeGroupId: string | null
}

interface TvFilesResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  categorizedFiles: ScannedFile[]
  uncategorizedFiles: ScannedFile[]
}

interface MovieFilesResponse {
  tmdbId: number
  primaryFiles: ScannedFile[]
  extraFiles: ScannedFile[]
}

function toInt(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  return n
}

function validateTitle(title: string | undefined): string | null {
  if (!title || !title.trim()) {
    return null
  }
  return title.trim()
}

function compareScannedEpisodes(left: ScannedFile, right: ScannedFile): number {
  const leftSeason = left.seasonNumber ?? Number.MAX_SAFE_INTEGER
  const rightSeason = right.seasonNumber ?? Number.MAX_SAFE_INTEGER
  if (leftSeason !== rightSeason) {
    return leftSeason - rightSeason
  }

  const leftEpisode = left.episodeNumber ?? Number.MAX_SAFE_INTEGER
  const rightEpisode = right.episodeNumber ?? Number.MAX_SAFE_INTEGER
  if (leftEpisode !== rightEpisode) {
    return leftEpisode - rightEpisode
  }

  return left.sourceFile.localeCompare(right.sourceFile)
}

function extractTvAliasCandidates(sourceFile: string): string[] {
  const fileName = basename(sourceFile, extname(sourceFile))
  const parent = basename(dirname(sourceFile))
  const grandParent = basename(dirname(dirname(sourceFile)))
  const cleanedFileName = fileName
    .replace(/s\d{1,2}[ ._-]*(?:e|ep)\d{1,3}(?:[- ]?(?:e|ep)?\d{1,3})?/gi, " ")
    .replace(/\d{1,2}x\d{1,3}(?:-\d{1,3})?/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()

  return [cleanedFileName, parent, grandParent].map(normalizeTitle).filter(Boolean)
}

function sourceTupleFromScannedFile(file: ScannedFile): SourceEpisodeTuple | null {
  return parseSourceEpisodeTuple(file.sourceFile)
}

function toCastMembers(items: TmdbCastMember[], limit = 12): MediaCastMember[] {
  return [...items]
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, limit)
    .map(item => ({
      id: item.id,
      name: item.name,
      character: item.character?.trim() || null,
      profilePath: item.profile_path ?? null,
      order: item.order ?? null,
    }))
}

async function getEpisodeGroupSelection(context: AppContext, tmdbId: number): Promise<{ episodeGroupId: string | null; episodeGroupName: string | null }> {
  const rows = await context.db
    .select({
      episodeGroupId: tvEpisodeGroupSelections.episodeGroupId,
      episodeGroupName: tvEpisodeGroupSelections.episodeGroupName,
    })
    .from(tvEpisodeGroupSelections)
    .where(eq(tvEpisodeGroupSelections.tmdbId, tmdbId))
    .limit(1)

  return {
    episodeGroupId: rows[0]?.episodeGroupId ?? null,
    episodeGroupName: rows[0]?.episodeGroupName ?? null,
  }
}

export function createMediaLookupRouter(context: AppContext) {
  const router = new Hono()

  router.get(ENTRYPOINTS.api.mediaLookup.movieSearch, async c => {
    const title = validateTitle(c.req.query("title"))
    if (!title) {
      return c.json({ error: "Title is required" }, 400)
    }

    const results = await context.tmdb.searchMovie(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.title,
      year: context.tmdb.movieYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvSearch, async c => {
    const title = validateTitle(c.req.query("title"))
    if (!title) {
      return c.json({ error: "Title is required" }, 400)
    }

    const results = await context.tmdb.searchTv(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.name,
      year: context.tmdb.tvYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.movieByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [movie, external, cast] = await Promise.all([
      context.tmdb.getMovie(tmdbId),
      context.tmdb.getMovieExternalIds(tmdbId),
      context.tmdb.getMovieCredits(tmdbId),
    ])

    const payload: MediaInfo = {
      title: movie.title,
      year: context.tmdb.movieYear(movie),
      tmdbId: movie.id,
      imdbId: external.imdb_id,
      mediaType: "Movies",
      posterPath: movie.poster_path ?? null,
      backdropPath: movie.backdrop_path ?? null,
      overview: movie.overview ?? null,
      status: movie.status ?? null,
      genres: movie.genres?.map(g => g.name) ?? [],
      tagline: movie.tagline ?? null,
      releaseDate: movie.release_date ?? null,
      runtimeMinutes: movie.runtime ?? null,
      voteAverage: movie.vote_average ?? null,
      voteCount: movie.vote_count ?? null,
      originalLanguage: movie.original_language ?? null,
      cast: toCastMembers(cast),
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.movieFilesByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const primaryFiles = (await context.scannedFilesRepo.listByTmdbId(tmdbId, "Movies")).sort(compareScannedEpisodes)
    const sourceFolders = [...new Set(primaryFiles.map(file => dirname(file.sourceFile)))]
    const relatedMap = new Map<number, ScannedFile>()

    for (const folder of sourceFolders) {
      const related = await context.scannedFilesRepo.listBySourcePrefix(folder)
      for (const row of related) {
        if (dirname(row.sourceFile) !== folder) {
          continue
        }
        relatedMap.set(row.id, row)
      }
    }

    const primaryIds = new Set(primaryFiles.map(file => file.id))
    const extraFiles = [...relatedMap.values()]
      .filter(file => !primaryIds.has(file.id))
      .sort((left, right) => left.sourceFile.localeCompare(right.sourceFile))

    const payload: MovieFilesResponse = {
      tmdbId,
      primaryFiles,
      extraFiles,
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [show, external, counts, cast] = await Promise.all([
      context.tmdb.getTv(tmdbId),
      context.tmdb.getTvExternalIds(tmdbId),
      context.db
        .select({ count: sql<number>`count(*)` })
        .from(scannedFiles)
        .where(and(eq(scannedFiles.tmdbId, tmdbId), eq(scannedFiles.mediaType, "TvShows"), eq(scannedFiles.status, "Success"))),
      context.tmdb.getTvCredits(tmdbId),
    ])

    const payload: MediaInfo = {
      title: show.name,
      year: context.tmdb.tvYear(show),
      tmdbId: show.id,
      imdbId: external.imdb_id,
      mediaType: "TvShows",
      posterPath: show.poster_path ?? null,
      backdropPath: show.backdrop_path ?? null,
      overview: show.overview ?? null,
      status: show.status ?? null,
      genres: show.genres?.map(g => g.name) ?? [],
      tagline: show.tagline ?? null,
      firstAirDate: show.first_air_date ?? null,
      lastAirDate: show.last_air_date ?? null,
      voteAverage: show.vote_average ?? null,
      voteCount: show.vote_count ?? null,
      originalLanguage: show.original_language ?? null,
      originCountry: show.origin_country ?? [],
      networks: show.networks?.map(network => network.name) ?? [],
      cast: toCastMembers(cast),
      episodeCount: show.number_of_episodes,
      episodeCountScanned: counts[0]?.count ?? 0,
      seasonCount: show.number_of_seasons,
      seasonCountScanned: 0,
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvEpisodeGroupsByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [episodeGroups, selection] = await Promise.all([
      context.tmdb.getTvEpisodeGroups(tmdbId),
      getEpisodeGroupSelection(context, tmdbId),
    ])

    return c.json({
      tmdbId,
      selectedEpisodeGroupId: selection.episodeGroupId,
      selectedEpisodeGroupName: selection.episodeGroupName,
      groups: episodeGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        episodeCount: group.episode_count,
        groupCount: group.group_count,
        selected: group.id === selection.episodeGroupId,
      })),
    })
  })

  router.put(ENTRYPOINTS.api.mediaLookup.tvEpisodeGroupSelectionByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const body = await parseJson<EpisodeGroupSelectionRequest>(c.req.raw)
    const nextEpisodeGroupId = typeof body.episodeGroupId === "string" ? body.episodeGroupId.trim() : body.episodeGroupId
    if (nextEpisodeGroupId !== null && (!nextEpisodeGroupId || nextEpisodeGroupId.length < 4)) {
      return c.json({ error: "episodeGroupId must be a valid TMDb episode group id or null" }, 400)
    }

    if (nextEpisodeGroupId === null) {
      await context.db.delete(tvEpisodeGroupSelections).where(eq(tvEpisodeGroupSelections.tmdbId, tmdbId))
    } else {
      const episodeGroups = await context.tmdb.getTvEpisodeGroups(tmdbId)
      const matchedGroup = episodeGroups.find(group => group.id === nextEpisodeGroupId)
      if (!matchedGroup) {
        return c.json({ error: "Episode group not found for show" }, 404)
      }

      await context.db
        .insert(tvEpisodeGroupSelections)
        .values({
          tmdbId,
          episodeGroupId: matchedGroup.id,
          episodeGroupName: matchedGroup.name,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: tvEpisodeGroupSelections.tmdbId,
          set: {
            episodeGroupId: matchedGroup.id,
            episodeGroupName: matchedGroup.name,
            updatedAt: new Date().toISOString(),
          },
        })
    }

    const rebuildResult = await context.poller.rebuildTvShow(tmdbId)
    const selection = await getEpisodeGroupSelection(context, tmdbId)

    return c.json({
      tmdbId,
      selectedEpisodeGroupId: selection.episodeGroupId,
      selectedEpisodeGroupName: selection.episodeGroupName,
      removedCount: rebuildResult.removedCount,
      reprocessedCount: rebuildResult.reprocessedCount,
    })
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvFilesByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [selection, rawShowRows, allTvFiles, identityRows, aliasRows] = await Promise.all([
      getEpisodeGroupSelection(context, tmdbId),
      context.scannedFilesRepo.listByTmdbId(tmdbId, "TvShows"),
      context.scannedFilesRepo.listByMediaType("TvShows"),
      context.db
        .select({
          normalizedTitle: seriesIdentityMap.normalizedTitle,
          canonicalTitle: seriesIdentityMap.canonicalTitle,
        })
        .from(seriesIdentityMap)
        .where(eq(seriesIdentityMap.tmdbId, tmdbId)),
      context.db
        .select({ aliasNormalized: seriesAliases.aliasNormalized })
        .from(seriesAliases)
        .innerJoin(seriesIdentityMap, eq(seriesAliases.identityId, seriesIdentityMap.id))
        .where(eq(seriesIdentityMap.tmdbId, tmdbId)),
    ])

    const categorizedFiles = rawShowRows.filter(file => file.status === "Success" && file.seasonNumber !== null && file.episodeNumber !== null)
    const showSourceFolders = new Set(rawShowRows.map(file => dirname(file.sourceFile)))

    const aliasSet = new Set<string>()
    for (const row of identityRows) {
      aliasSet.add(row.normalizedTitle)
      aliasSet.add(normalizeTitle(row.canonicalTitle))
    }
    for (const row of aliasRows) {
      aliasSet.add(row.aliasNormalized)
    }

    const categorizedIds = new Set(categorizedFiles.map(file => file.id))
    const uncategorizedFiles = allTvFiles
      .filter(file => {
        if (categorizedIds.has(file.id)) {
          return false
        }

        if (file.tmdbId === tmdbId) {
          return true
        }

        if (showSourceFolders.has(dirname(file.sourceFile))) {
          return true
        }

        if (file.tmdbId !== null || aliasSet.size === 0) {
          return false
        }

        const candidates = extractTvAliasCandidates(file.sourceFile)
        return candidates.some(candidate => aliasSet.has(candidate))
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

    const relatedForRemap = [...categorizedFiles, ...uncategorizedFiles]
    const tuplesBySeason = new Map<number, SourceEpisodeTuple[]>()
    for (const file of relatedForRemap) {
      const sourceTuple = sourceTupleFromScannedFile(file)
      if (!sourceTuple) {
        continue
      }
      const existing = tuplesBySeason.get(sourceTuple.seasonNumber)
      if (existing) {
        existing.push(sourceTuple)
      } else {
        tuplesBySeason.set(sourceTuple.seasonNumber, [sourceTuple])
      }
    }

    const remapPlanBySeason = new Map<number, ReturnType<typeof buildSeasonRemapPlan>>()
    await Promise.all(
      [...tuplesBySeason.entries()].map(async ([seasonNumber, tuples]) => {
        try {
          const season = await context.tmdb.getTvSeason(tmdbId, seasonNumber)
          const plan = buildSeasonRemapPlan({
            seasonNumber,
            tmdbEpisodeCount: season.episodes.length,
            tuples,
          })
          remapPlanBySeason.set(seasonNumber, plan)
        } catch {
          remapPlanBySeason.set(seasonNumber, null)
        }
      }),
    )

    const annotateEpisodeRemap = (file: ScannedFile): ScannedFile => {
      const sourceTuple = sourceTupleFromScannedFile(file)
      if (!sourceTuple) {
        return file
      }

      const plan = remapPlanBySeason.get(sourceTuple.seasonNumber) ?? null
      if (!plan) {
        return file
      }

      const remappedTuple = applySeasonRemap(sourceTuple, plan)
      const episodeRemap = createEpisodeRemapInfo(sourceTuple, remappedTuple, plan)
      if (!episodeRemap) {
        return file
      }

      return {
        ...file,
        episodeRemap,
      }
    }

    const payload: TvFilesResponse = {
      tmdbId,
      selectedEpisodeGroupId: selection.episodeGroupId,
      selectedEpisodeGroupName: selection.episodeGroupName,
      categorizedFiles: [...categorizedFiles].sort(compareScannedEpisodes).map(annotateEpisodeRemap),
      uncategorizedFiles: uncategorizedFiles.map(annotateEpisodeRemap),
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvSeasonByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    const seasonNumber = toInt(c.req.param("seasonNumber"))
    if (!tmdbId || !seasonNumber) {
      return c.json({ error: "Invalid TMDb or season number" }, 400)
    }

    const [season, scannedEpisodes] = await Promise.all([
      context.tmdb.getTvSeason(tmdbId, seasonNumber),
      context.db
        .select({ episodeNumber: scannedFiles.episodeNumber, episodeNumber2: scannedFiles.episodeNumber2 })
        .from(scannedFiles)
        .where(and(
          eq(scannedFiles.tmdbId, tmdbId),
          eq(scannedFiles.seasonNumber, seasonNumber),
          eq(scannedFiles.status, "Success"),
        )),
    ])

    const scannedSet = new Set<number>()
    for (const row of scannedEpisodes) {
      if (row.episodeNumber === null) {
        continue
      }

      const endEpisode = row.episodeNumber2 !== null && row.episodeNumber2 > row.episodeNumber
        ? row.episodeNumber2
        : row.episodeNumber

      for (let episode = row.episodeNumber; episode <= endEpisode; episode += 1) {
        scannedSet.add(episode)
      }
    }

    const payload: SeasonInfo = {
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview,
      posterPath: season.poster_path,
      airDate: season.air_date,
      episodes: season.episodes.map(ep => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        stillPath: ep.still_path,
        airDate: ep.air_date,
        isScanned: scannedSet.has(ep.episode_number),
      })),
      episodeCount: season.episodes.length,
      episodeCountScanned: scannedSet.size,
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvEpisodeByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    const seasonNumber = toInt(c.req.param("seasonNumber"))
    const episodeNumber = toInt(c.req.param("episodeNumber"))
    if (!tmdbId || !seasonNumber || !episodeNumber) {
      return c.json({ error: "Invalid episode request" }, 400)
    }

    const episode = await context.tmdb.getTvEpisode(tmdbId, seasonNumber, episodeNumber)
    const payload: EpisodeInfo = {
      episodeNumber: episode.episode_number,
      name: episode.name,
      overview: episode.overview,
      stillPath: episode.still_path,
      airDate: episode.air_date,
      tmdbId: episode.id,
    }

    return c.json(payload)
  })

  router.get(`${ENTRYPOINTS.api.mediaLookup.imagesPrefix}/*`, c => {
    const rawPath = c.req.path.slice(`${ENTRYPOINTS.api.mediaLookup.imagesPrefix}/`.length)
    const size = c.req.query("size") ?? "w500"
    return c.json(context.tmdb.getImageUrl(rawPath, size))
  })

  router.delete(ENTRYPOINTS.api.mediaLookup.cacheBase, c => {
    context.tmdb.invalidateAll()
    return c.json({ ok: true })
  })

  router.delete(ENTRYPOINTS.api.mediaLookup.cacheWildcard, c => {
    context.tmdb.invalidateAll()
    return c.json({ ok: true })
  })

  return router
}
