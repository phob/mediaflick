import { eq } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { tvEpisodeSourceSelections } from "@/db/schema"
import type { TmdbClient } from "@/modules/media-lookup/tmdb-client"
import { TvdbClient } from "@/modules/media-lookup/tvdb-client"
import type {
  TvEpisodeSourceSelection,
  TvEpisodeSourceType,
  TvdbSearchResult,
  TvdbSeasonType,
} from "@/shared/types"

export const tvdbSeasonTypeLabels: Record<TvdbSeasonType, string> = {
  default: "Default",
  official: "Official",
  dvd: "DVD",
  absolute: "Absolute",
  alternate: "Alternate",
  regional: "Regional",
}

interface SetSelectionInput {
  source: TvEpisodeSourceType
  tvdbId?: number | null
  tvdbSeriesName?: string | null
  tvdbSeasonType?: TvdbSeasonType | null
}

export class TvEpisodeSourceService {
  constructor(
    private readonly db: AppDb,
    private readonly getTmdbClient: () => TmdbClient,
    private readonly getTvdbClient: () => TvdbClient,
  ) {}

  async getSelection(tmdbId: number): Promise<TvEpisodeSourceSelection> {
    const rows = await this.db
      .select()
      .from(tvEpisodeSourceSelections)
      .where(eq(tvEpisodeSourceSelections.tmdbId, tmdbId))
      .limit(1)

    const row = rows[0]
    if (!row || row.sourceType !== "tvdb") {
      return {
        tmdbId,
        source: "tmdb",
        tvdbId: null,
        tvdbSeriesName: null,
        tvdbSeasonType: null,
        updatedAt: row?.updatedAt ?? null,
      }
    }

    return {
      tmdbId,
      source: "tvdb",
      tvdbId: row.tvdbId ?? null,
      tvdbSeriesName: row.tvdbSeriesName ?? null,
      tvdbSeasonType: (row.tvdbSeasonType as TvdbSeasonType | null) ?? "default",
      updatedAt: row.updatedAt,
    }
  }

  async setSelection(tmdbId: number, input: SetSelectionInput): Promise<TvEpisodeSourceSelection> {
    if (input.source === "tmdb") {
      await this.db.delete(tvEpisodeSourceSelections).where(eq(tvEpisodeSourceSelections.tmdbId, tmdbId))
      return this.getSelection(tmdbId)
    }

    if (!input.tvdbId || input.tvdbId <= 0) {
      throw new Error("TVDB source selection requires a valid tvdbId")
    }

    const tvdb = this.getTvdbClient()
    const series = await tvdb.getSeriesExtended(input.tvdbId)
    const now = new Date().toISOString()

    await this.db
      .insert(tvEpisodeSourceSelections)
      .values({
        tmdbId,
        sourceType: "tvdb",
        tvdbId: series.id,
        tvdbSeriesName: input.tvdbSeriesName?.trim() || series.name,
        tvdbSeasonType: input.tvdbSeasonType ?? "default",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tvEpisodeSourceSelections.tmdbId,
        set: {
          sourceType: "tvdb",
          tvdbId: series.id,
          tvdbSeriesName: input.tvdbSeriesName?.trim() || series.name,
          tvdbSeasonType: input.tvdbSeasonType ?? "default",
          updatedAt: now,
        },
      })

    return this.getSelection(tmdbId)
  }

  async searchTvdbSeries(query: string): Promise<TvdbSearchResult[]> {
    const normalized = query.trim()
    if (normalized.length < 2) {
      return []
    }

    const tvdb = this.getTvdbClient()
    const results = await tvdb.searchSeries(normalized)
    return results
      .map(result => {
        const tvdbId = tvdb.searchResultId(result)
        if (!tvdbId) {
          return null
        }

        return {
          tvdbId,
          title: tvdb.searchResultTitle(result),
          year: tvdb.searchResultYear(result),
          posterPath: tvdb.searchResultPoster(result),
          overview: result.overview ?? null,
        }
      })
      .filter((result): result is TvdbSearchResult => result !== null)
  }

  async getTvdbSeries(tmdbId: number): Promise<{ tvdbId: number; seasonType: TvdbSeasonType } | null> {
    const selection = await this.getSelection(tmdbId)
    if (selection.source !== "tvdb" || !selection.tvdbId) {
      return null
    }

    return {
      tvdbId: selection.tvdbId,
      seasonType: selection.tvdbSeasonType ?? "default",
    }
  }

  seasonTypeLabel(value: TvdbSeasonType | null | undefined): string | null {
    if (!value) {
      return null
    }

    return tvdbSeasonTypeLabels[value] ?? value
  }

  async getDefaultTvdbSearchSeed(tmdbId: number): Promise<string> {
    const tmdb = this.getTmdbClient()
    const show = await tmdb.getTv(tmdbId)
    return show.name
  }
}
