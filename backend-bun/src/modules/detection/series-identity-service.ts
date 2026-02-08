import { and, desc, eq, isNull } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { seriesAliases, seriesIdentityMap } from "@/db/schema"
import { normalizeTitle, similarity } from "@/modules/detection/normalization"
import type { TmdbClient, TmdbTvResult } from "@/modules/media-lookup/tmdb-client"
import type { ResolvedSeriesIdentity } from "@/shared/types"

interface ResolveSeriesIdentityInput {
  candidates: string[]
  yearHint: number | null
}

function pickBestTmdb(candidates: string[], searchResults: TmdbTvResult[], tmdb: TmdbClient): TmdbTvResult | null {
  let best: TmdbTvResult | null = null
  let bestScore = -1

  for (const result of searchResults) {
    const normalizedResult = normalizeTitle(result.name)
    let score = 0
    for (const candidate of candidates) {
      score = Math.max(score, similarity(candidate, normalizedResult))
    }

    score += (result.popularity ?? 0) / 10_000
    if (score > bestScore) {
      best = result
      bestScore = score
    }
  }

  if (!best) {
    return null
  }

  return best
}

export class SeriesIdentityService {
  constructor(
    private readonly db: AppDb,
    private readonly tmdb: TmdbClient,
  ) {}

  async resolve(input: ResolveSeriesIdentityInput): Promise<ResolvedSeriesIdentity | null> {
    const normalizedCandidates = input.candidates.map(normalizeTitle).filter(Boolean)
    if (normalizedCandidates.length === 0) {
      return null
    }

    for (const candidate of normalizedCandidates) {
      const aliasRows = await this.db
        .select({
          tmdbId: seriesIdentityMap.tmdbId,
          imdbId: seriesIdentityMap.imdbId,
          canonicalTitle: seriesIdentityMap.canonicalTitle,
          year: seriesIdentityMap.year,
        })
        .from(seriesAliases)
        .innerJoin(seriesIdentityMap, eq(seriesAliases.identityId, seriesIdentityMap.id))
        .where(eq(seriesAliases.aliasNormalized, candidate))
        .limit(1)

      if (aliasRows[0]) {
        return {
          tmdbId: aliasRows[0].tmdbId,
          imdbId: aliasRows[0].imdbId,
          canonicalTitle: aliasRows[0].canonicalTitle,
          year: aliasRows[0].year,
        }
      }

      const identityRows = await this.db
        .select()
        .from(seriesIdentityMap)
        .where(
          input.yearHint
            ? and(eq(seriesIdentityMap.normalizedTitle, candidate), eq(seriesIdentityMap.year, input.yearHint))
            : and(eq(seriesIdentityMap.normalizedTitle, candidate), isNull(seriesIdentityMap.year)),
        )
        .limit(1)

      if (identityRows[0]) {
        await this.addAliases(identityRows[0].id, input.candidates)
        return {
          tmdbId: identityRows[0].tmdbId,
          imdbId: identityRows[0].imdbId,
          canonicalTitle: identityRows[0].canonicalTitle,
          year: identityRows[0].year,
        }
      }
    }

    const uniqueCandidates = [...new Set(normalizedCandidates)]
    let searchResults: TmdbTvResult[] = []
    for (const candidate of uniqueCandidates) {
      const results = await this.tmdb.searchTv(candidate)
      searchResults = searchResults.concat(results)
    }

    if (searchResults.length === 0) {
      return null
    }

    const bestMatch = pickBestTmdb(uniqueCandidates, searchResults, this.tmdb)
    if (!bestMatch) {
      return null
    }

    const externalIds = await this.tmdb.getTvExternalIds(bestMatch.id)
    const identity = await this.upsertIdentity({
      normalizedTitle: normalizeTitle(bestMatch.name),
      year: this.tmdb.tvYear(bestMatch),
      tmdbId: bestMatch.id,
      imdbId: externalIds.imdb_id,
      canonicalTitle: bestMatch.name,
    })
    await this.addAliases(identity.id, input.candidates.concat(bestMatch.name))

    return {
      tmdbId: identity.tmdbId,
      imdbId: identity.imdbId,
      canonicalTitle: identity.canonicalTitle,
      year: identity.year,
    }
  }

  private async upsertIdentity(input: {
    normalizedTitle: string
    year: number | null
    tmdbId: number
    imdbId: string | null
    canonicalTitle: string
  }) {
    const existing = await this.db
      .select()
      .from(seriesIdentityMap)
      .where(
        input.year
          ? and(eq(seriesIdentityMap.normalizedTitle, input.normalizedTitle), eq(seriesIdentityMap.year, input.year))
          : and(eq(seriesIdentityMap.normalizedTitle, input.normalizedTitle), isNull(seriesIdentityMap.year)),
      )
      .orderBy(desc(seriesIdentityMap.id))
      .limit(1)

    if (existing[0]) {
      await this.db
        .update(seriesIdentityMap)
        .set({
          tmdbId: input.tmdbId,
          imdbId: input.imdbId,
          canonicalTitle: input.canonicalTitle,
          updatedAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
        })
        .where(eq(seriesIdentityMap.id, existing[0].id))

      return {
        ...existing[0],
        tmdbId: input.tmdbId,
        imdbId: input.imdbId,
        canonicalTitle: input.canonicalTitle,
      }
    }

    const inserted = await this.db
      .insert(seriesIdentityMap)
      .values({
        normalizedTitle: input.normalizedTitle,
        year: input.year,
        tmdbId: input.tmdbId,
        imdbId: input.imdbId,
        canonicalTitle: input.canonicalTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
      })
      .returning()

    return inserted[0]
  }

  private async addAliases(identityId: number, aliases: string[]): Promise<void> {
    for (const aliasRaw of aliases) {
      const aliasNormalized = normalizeTitle(aliasRaw)
      if (!aliasNormalized) continue

      await this.db
        .insert(seriesAliases)
        .values({
          identityId,
          aliasRaw,
          aliasNormalized,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
    }
  }
}
