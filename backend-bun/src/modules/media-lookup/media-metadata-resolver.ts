import { readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { and, eq } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { scannedFiles, tvEpisodeGroupSelections } from "@/db/schema"
import { normalizeTitle } from "@/modules/detection/normalization"
import type { TmdbClient, TmdbTvEpisodeGroupEpisode } from "@/modules/media-lookup/tmdb-client"
import {
  applySeasonRemap,
  buildSeasonRemapPlan,
  createEpisodeRemapInfo,
  parseSourceEpisodeMatch,
  parseSourceEpisodeTuple,
  type SourceEpisodeTuple,
} from "@/modules/media-lookup/tv-season-remapper"
import type { EpisodeRemapInfo } from "@/shared/types"

interface GroupEpisodePlacement {
  seasonNumber: number
  episodeNumber: number
  name: string | null
}

interface EpisodeGroupPlacementCache {
  byEpisodeId: Map<number, GroupEpisodePlacement>
  byDetectedOrder: Map<string, GroupEpisodePlacement>
}

interface ResolvedEpisodePlacement {
  seasonNumber: number
  episodeNumber: number
  episodeTitle: string | null
}

export interface ResolvedMovieMetadata {
  tmdbId: number
  imdbId: string | null
  title: string
  year: number | null
  genres: string[]
  posterPath: string | null
}

export interface ResolveTvMetadataInput {
  tmdbId: number
  seasonNumber: number
  episodeNumber: number
  episodeNumber2?: number | null
  imdbIdFallback?: string | null
  sourceFile?: string
}

export interface ResolvedTvMetadata {
  tmdbId: number
  imdbId: string | null
  title: string
  year: number | null
  genres: string[]
  posterPath: string | null
  seasonNumber: number
  episodeNumber: number
  episodeNumber2: number | null
  episodeTitle: string | null
  episodeRemap: EpisodeRemapInfo | null
}

export class MediaMetadataResolver {
  private readonly episodeGroupCache = new Map<string, EpisodeGroupPlacementCache>()

  constructor(
    private readonly db: AppDb,
    private readonly tmdb: TmdbClient,
  ) {}

  async resolveMovie(tmdbId: number): Promise<ResolvedMovieMetadata> {
    const [movie, externalIds] = await Promise.all([
      this.tmdb.getMovie(tmdbId),
      this.tmdb.getMovieExternalIds(tmdbId),
    ])

    return {
      tmdbId: movie.id,
      imdbId: externalIds.imdb_id,
      title: movie.title,
      year: this.tmdb.movieYear(movie),
      genres: movie.genres?.map(genre => genre.name) ?? [],
      posterPath: movie.poster_path ?? null,
    }
  }

  async resolveTv(input: ResolveTvMetadataInput): Promise<ResolvedTvMetadata> {
    const sourceTuple: SourceEpisodeTuple = {
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      episodeNumber2: input.episodeNumber2 ?? null,
    }
    const remappedSource = await this.resolveSeasonCompactionRemap(input.tmdbId, sourceTuple, input.sourceFile)
    const normalizedTuple = remappedSource.remapped

    const [show, externalIds, primaryPlacement] = await Promise.all([
      this.tmdb.getTv(input.tmdbId),
      this.tmdb.getTvExternalIds(input.tmdbId),
      this.resolveEpisodePlacement(input.tmdbId, normalizedTuple.seasonNumber, normalizedTuple.episodeNumber),
    ])

    let secondaryEpisodeNumber: number | null = null
    if (normalizedTuple.episodeNumber2) {
      try {
        const secondaryPlacement = await this.resolveEpisodePlacement(
          input.tmdbId,
          normalizedTuple.seasonNumber,
          normalizedTuple.episodeNumber2,
        )
        if (secondaryPlacement.seasonNumber === primaryPlacement.seasonNumber) {
          secondaryEpisodeNumber = secondaryPlacement.episodeNumber
        }
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("TMDb request failed: 404")) {
          throw error
        }
      }
    }

    return {
      tmdbId: show.id,
      imdbId: externalIds.imdb_id ?? input.imdbIdFallback ?? null,
      title: show.name,
      year: this.tmdb.tvYear(show),
      genres: show.genres?.map(genre => genre.name) ?? [],
      posterPath: show.poster_path ?? null,
      seasonNumber: primaryPlacement.seasonNumber,
      episodeNumber: primaryPlacement.episodeNumber,
      episodeNumber2: secondaryEpisodeNumber,
      episodeTitle: primaryPlacement.episodeTitle,
      episodeRemap: remappedSource.info,
    }
  }

  private async resolveSeasonCompactionRemap(
    tmdbId: number,
    sourceTuple: SourceEpisodeTuple,
    sourceFile?: string,
  ): Promise<{ remapped: SourceEpisodeTuple; info: EpisodeRemapInfo | null }> {
    const parsedFromSource = sourceFile ? parseSourceEpisodeMatch(sourceFile) : null
    const inputMatchesSource =
      parsedFromSource !== null
      && parsedFromSource.seasonNumber === sourceTuple.seasonNumber
      && parsedFromSource.episodeNumber === sourceTuple.episodeNumber
      && (parsedFromSource.episodeNumber2 ?? null) === (sourceTuple.episodeNumber2 ?? null)

    if (!inputMatchesSource) {
      return {
        remapped: sourceTuple,
        info: null,
      }
    }

    const normalizedSourceTitleHint = normalizeTitle(parsedFromSource.titleHint)

    const [season, rows, sourceDirectoryTuples] = await Promise.all([
      this.tmdb.getTvSeason(tmdbId, sourceTuple.seasonNumber),
      this.db
        .select({ sourceFile: scannedFiles.sourceFile })
        .from(scannedFiles)
        .where(and(eq(scannedFiles.tmdbId, tmdbId), eq(scannedFiles.mediaType, "TvShows"))),
      sourceFile
        ? this.listSourceEpisodeTuplesFromDirectory(sourceFile, normalizedSourceTitleHint)
        : Promise.resolve([]),
    ])

    const tuples: SourceEpisodeTuple[] = []
    for (const tuple of sourceDirectoryTuples) {
      if (tuple.seasonNumber !== sourceTuple.seasonNumber) {
        continue
      }
      tuples.push(tuple)
    }

    for (const row of rows) {
      const parsed = parseSourceEpisodeTuple(row.sourceFile)
      if (!parsed || parsed.seasonNumber !== sourceTuple.seasonNumber) {
        continue
      }
      tuples.push(parsed)
    }
    tuples.push(sourceTuple)

    const plan = buildSeasonRemapPlan({
      seasonNumber: sourceTuple.seasonNumber,
      tmdbEpisodeCount: season.episodes.length,
      tuples,
    })

    const remapped = applySeasonRemap(sourceTuple, plan)
    const info = createEpisodeRemapInfo(sourceTuple, remapped, plan)

    return {
      remapped,
      info,
    }
  }

  private isSameShowTitleHint(normalizedSourceTitleHint: string, candidateTitleHint: string): boolean {
    if (!normalizedSourceTitleHint) {
      return true
    }

    const normalizedCandidate = normalizeTitle(candidateTitleHint)
    if (!normalizedCandidate) {
      return false
    }

    return normalizedCandidate === normalizedSourceTitleHint
      || normalizedCandidate.includes(normalizedSourceTitleHint)
      || normalizedSourceTitleHint.includes(normalizedCandidate)
  }

  private async listSourceEpisodeTuplesFromDirectory(
    sourceFile: string,
    normalizedSourceTitleHint: string,
  ): Promise<SourceEpisodeTuple[]> {
    const directory = dirname(sourceFile)

    try {
      const entries = await readdir(directory, { withFileTypes: true })
      return entries
        .filter(entry => entry.isFile())
        .map(entry => parseSourceEpisodeMatch(join(directory, entry.name)))
        .filter(match => match !== null)
        .filter(match => this.isSameShowTitleHint(normalizedSourceTitleHint, match.titleHint))
        .map(match => ({
          seasonNumber: match.seasonNumber,
          episodeNumber: match.episodeNumber,
          episodeNumber2: match.episodeNumber2,
        }))
        .filter(tuple => tuple !== null)
    } catch {
      return []
    }
  }

  private episodePlacementFromGroupEpisode(
    entry: TmdbTvEpisodeGroupEpisode,
    groupSeasonNumber: number | null,
    groupIndex: number,
    episodeIndex: number,
  ): GroupEpisodePlacement {
    const seasonNumber = Number.isInteger(entry.season_number) && (entry.season_number ?? 0) > 0
      ? (entry.season_number as number)
      : groupSeasonNumber !== null
        ? groupSeasonNumber
        : groupIndex + 1

    const episodeNumber = Number.isInteger(entry.order) && (entry.order ?? -1) >= 0
      ? (entry.order as number) + 1
      : Number.isInteger(entry.episode_number) && (entry.episode_number ?? 0) > 0
        ? (entry.episode_number as number)
        : episodeIndex + 1

    return {
      seasonNumber,
      episodeNumber,
      name: entry.name ?? null,
    }
  }

  private detectGroupSeasonNumber(groupName: string, episodes: TmdbTvEpisodeGroupEpisode[]): number | null {
    const positiveSeasons = [
      ...new Set(
        episodes
          .map(episode => episode.season_number)
          .filter(season => Number.isInteger(season) && (season ?? 0) > 0),
      ),
    ] as number[]
    if (positiveSeasons.length === 1) {
      return positiveSeasons[0]
    }

    const seasonMatch = groupName.match(/season\s*(\d+)/i)
    if (!seasonMatch) {
      return null
    }

    const seasonNumber = Number(seasonMatch[1])
    return Number.isInteger(seasonNumber) && seasonNumber > 0
      ? seasonNumber
      : null
  }

  private async getSelectedEpisodeGroupId(tmdbId: number): Promise<string | null> {
    const rows = await this.db
      .select({ episodeGroupId: tvEpisodeGroupSelections.episodeGroupId })
      .from(tvEpisodeGroupSelections)
      .where(eq(tvEpisodeGroupSelections.tmdbId, tmdbId))
      .limit(1)

    return rows[0]?.episodeGroupId ?? null
  }

  private async getEpisodeGroupMap(episodeGroupId: string): Promise<EpisodeGroupPlacementCache> {
    const cached = this.episodeGroupCache.get(episodeGroupId)
    if (cached) {
      return cached
    }

    const episodeGroup = await this.tmdb.getTvEpisodeGroup(episodeGroupId)
    const byEpisodeId = new Map<number, GroupEpisodePlacement>()
    const byDetectedOrder = new Map<string, GroupEpisodePlacement>()
    const groups = [...(episodeGroup.groups ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    groups.forEach((group, groupIndex) => {
      const episodes = [...(group.episodes ?? [])].sort((a, b) => {
        const left = a.order ?? a.episode_number ?? 0
        const right = b.order ?? b.episode_number ?? 0
        return left - right
      })
      const detectedSeason = this.detectGroupSeasonNumber(group.name, episodes)

      episodes.forEach((entry, episodeIndex) => {
        const placement = this.episodePlacementFromGroupEpisode(
          entry,
          detectedSeason,
          groupIndex,
          episodeIndex,
        )
        byEpisodeId.set(entry.id, placement)

        if (detectedSeason !== null) {
          byDetectedOrder.set(
            `${detectedSeason}:${episodeIndex + 1}`,
            placement,
          )
        }
      })
    })

    const result: EpisodeGroupPlacementCache = {
      byEpisodeId,
      byDetectedOrder,
    }

    this.episodeGroupCache.set(episodeGroupId, result)
    return result
  }

  private async resolveEpisodePlacement(
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<ResolvedEpisodePlacement> {
    const selectedEpisodeGroupId = await this.getSelectedEpisodeGroupId(tmdbId)

    if (!selectedEpisodeGroupId) {
      const defaultEpisode = await this.tmdb.getTvEpisode(tmdbId, seasonNumber, episodeNumber)
      return {
        seasonNumber,
        episodeNumber,
        episodeTitle: defaultEpisode.name,
      }
    }

    const episodeGroupMap = await this.getEpisodeGroupMap(selectedEpisodeGroupId)
    const groupedByDetectedOrder = episodeGroupMap.byDetectedOrder.get(`${seasonNumber}:${episodeNumber}`)
    if (groupedByDetectedOrder) {
      return {
        seasonNumber: groupedByDetectedOrder.seasonNumber,
        episodeNumber: groupedByDetectedOrder.episodeNumber,
        episodeTitle: groupedByDetectedOrder.name,
      }
    }

    try {
      const defaultEpisode = await this.tmdb.getTvEpisode(tmdbId, seasonNumber, episodeNumber)
      const groupedByEpisodeId = episodeGroupMap.byEpisodeId.get(defaultEpisode.id)
      if (groupedByEpisodeId) {
        return {
          seasonNumber: groupedByEpisodeId.seasonNumber,
          episodeNumber: groupedByEpisodeId.episodeNumber,
          episodeTitle: groupedByEpisodeId.name ?? defaultEpisode.name,
        }
      }

      return {
        seasonNumber,
        episodeNumber,
        episodeTitle: defaultEpisode.name,
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("TMDb request failed: 404")) {
        return {
          seasonNumber,
          episodeNumber,
          episodeTitle: null,
        }
      }
      throw error
    }
  }
}
