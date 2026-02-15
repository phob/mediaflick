import { and, count, desc, eq, inArray, isNull } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { seriesAliases, seriesIdentityMap } from "@/db/schema"
import { normalizeTitle, similarity } from "@/modules/detection/normalization"
import type { TmdbClient, TmdbTvResult } from "@/modules/media-lookup/tmdb-client"
import type { ResolvedSeriesIdentity } from "@/shared/types"

interface ResolveSeriesIdentityInput {
  candidates: string[]
  yearHint: number | null
}

const genericSeriesCandidates = new Set([
  "tv",
  "show",
  "shows",
  "series",
  "tv show",
  "tv shows",
  "tvshow",
  "tvshows",
  "tv series",
  "tvseries",
  "season",
  "seasons",
  "episode",
  "episodes",
  "complete",
])

const aliasMatchThreshold = 0.8

function isUsefulSeriesCandidate(candidate: string): boolean {
  const normalized = candidate.trim()
  if (!normalized) {
    return false
  }

  if (genericSeriesCandidates.has(normalized)) {
    return false
  }

  const tokens = normalized.split(" ").filter(Boolean)
  if (tokens.length === 0) {
    return false
  }

  if (tokens.every(token => genericSeriesCandidates.has(token))) {
    return false
  }

  return true
}

function pickAliasMatch(
  candidate: string,
  aliasRows: Array<{
    identityId: number
    tmdbId: number
    imdbId: string | null
    canonicalTitle: string
    year: number | null
  }>,
  yearHint: number | null,
): {
  tmdbId: number
  imdbId: string | null
  canonicalTitle: string
  year: number | null
} | null {
  if (aliasRows.length === 0) {
    return null
  }

  const plausibleRows = aliasRows.filter(
    row => similarity(candidate, normalizeTitle(row.canonicalTitle)) >= aliasMatchThreshold,
  )
  if (plausibleRows.length === 0) {
    return null
  }

  const deduped = new Map<number, (typeof aliasRows)[number]>()
  for (const row of plausibleRows) {
    if (!deduped.has(row.identityId)) {
      deduped.set(row.identityId, row)
    }
  }

  const uniqueRows = [...deduped.values()]
  if (uniqueRows.length === 1) {
    const row = uniqueRows[0]
    return {
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      canonicalTitle: row.canonicalTitle,
      year: row.year,
    }
  }

  if (!yearHint) {
    return null
  }

  const yearRows = uniqueRows.filter(row => row.year === yearHint)
  if (yearRows.length !== 1) {
    return null
  }

  return {
    tmdbId: yearRows[0].tmdbId,
    imdbId: yearRows[0].imdbId,
    canonicalTitle: yearRows[0].canonicalTitle,
    year: yearRows[0].year,
  }
}

function pickBestTmdb(candidates: string[], searchResults: TmdbTvResult[]): TmdbTvResult | null {
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
    const normalizedCandidates = [...new Set(input.candidates.map(normalizeTitle).filter(isUsefulSeriesCandidate))]
    if (normalizedCandidates.length === 0) {
      return null
    }

    for (const candidate of normalizedCandidates) {
      const aliasRows = await this.db
        .select({
          identityId: seriesAliases.identityId,
          tmdbId: seriesIdentityMap.tmdbId,
          imdbId: seriesIdentityMap.imdbId,
          canonicalTitle: seriesIdentityMap.canonicalTitle,
          year: seriesIdentityMap.year,
        })
        .from(seriesAliases)
        .innerJoin(seriesIdentityMap, eq(seriesAliases.identityId, seriesIdentityMap.id))
        .where(eq(seriesAliases.aliasNormalized, candidate))
        .limit(25)

      const aliasMatch = pickAliasMatch(candidate, aliasRows, input.yearHint)
      if (aliasMatch) {
        return aliasMatch
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
        await this.addAliases(identityRows[0].id, identityRows[0].canonicalTitle, input.candidates)
        return {
          tmdbId: identityRows[0].tmdbId,
          imdbId: identityRows[0].imdbId,
          canonicalTitle: identityRows[0].canonicalTitle,
          year: identityRows[0].year,
        }
      }
    }

    let searchResults: TmdbTvResult[] = []
    for (const candidate of normalizedCandidates) {
      const results = await this.tmdb.searchTv(candidate)
      searchResults = searchResults.concat(results)
    }

    if (searchResults.length === 0) {
      return null
    }

    const bestMatch = pickBestTmdb(normalizedCandidates, searchResults)
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
    await this.addAliases(identity.id, identity.canonicalTitle, input.candidates.concat(bestMatch.name))

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

  /** Count identities + aliases for a given tmdbId without modifying anything (for dry-run). */
  async countForTmdbId(tmdbId: number): Promise<{ identities: number; aliases: number }> {
    const identityRows = await this.db
      .select({ id: seriesIdentityMap.id })
      .from(seriesIdentityMap)
      .where(eq(seriesIdentityMap.tmdbId, tmdbId))

    if (identityRows.length === 0) {
      return { identities: 0, aliases: 0 }
    }

    const identityIds = identityRows.map(r => r.id)
    const aliasCountResult = await this.db
      .select({ total: count() })
      .from(seriesAliases)
      .where(inArray(seriesAliases.identityId, identityIds))

    return {
      identities: identityRows.length,
      aliases: aliasCountResult[0]?.total ?? 0,
    }
  }

  /**
   * Reassign all identity rows from oldTmdbId to newTmdbId.
   * Aliases follow automatically via FK. Also upserts a new identity
   * for the new canonical title and force-adds it as an alias.
   */
  async reassignIdentity(input: {
    oldTmdbId: number
    newTmdbId: number
    newCanonicalTitle: string
    newYear: number | null
    newImdbId: string | null
  }): Promise<{ identitiesUpdated: number; aliasesRedirected: number }> {
    const now = new Date().toISOString()

    // Find all identity rows pointing to the old tmdbId
    const oldIdentities = await this.db
      .select({ id: seriesIdentityMap.id })
      .from(seriesIdentityMap)
      .where(eq(seriesIdentityMap.tmdbId, input.oldTmdbId))

    if (oldIdentities.length === 0) {
      // No existing identity rows -- just ensure the new identity exists
      await this.upsertIdentity({
        normalizedTitle: normalizeTitle(input.newCanonicalTitle),
        year: input.newYear,
        tmdbId: input.newTmdbId,
        imdbId: input.newImdbId,
        canonicalTitle: input.newCanonicalTitle,
      })
      return { identitiesUpdated: 0, aliasesRedirected: 0 }
    }

    const identityIds = oldIdentities.map(r => r.id)

    // Count aliases that will be redirected (they follow the identity FK)
    const aliasCountResult = await this.db
      .select({ total: count() })
      .from(seriesAliases)
      .where(inArray(seriesAliases.identityId, identityIds))
    const aliasesRedirected = aliasCountResult[0]?.total ?? 0

    // Update all identity rows to point to the new tmdbId
    await this.db
      .update(seriesIdentityMap)
      .set({
        tmdbId: input.newTmdbId,
        imdbId: input.newImdbId,
        canonicalTitle: input.newCanonicalTitle,
        updatedAt: now,
        lastVerifiedAt: now,
      })
      .where(inArray(seriesIdentityMap.id, identityIds))

    // Ensure a canonical identity exists for the new title+year
    const newIdentity = await this.upsertIdentity({
      normalizedTitle: normalizeTitle(input.newCanonicalTitle),
      year: input.newYear,
      tmdbId: input.newTmdbId,
      imdbId: input.newImdbId,
      canonicalTitle: input.newCanonicalTitle,
    })

    // Force-add the canonical title as an alias (bypass similarity threshold)
    await this.addAliasForced(newIdentity.id, input.newCanonicalTitle)

    return {
      identitiesUpdated: oldIdentities.length,
      aliasesRedirected,
    }
  }

  /** Add an alias without similarity threshold check (for manual user reassignment). */
  private async addAliasForced(identityId: number, aliasRaw: string): Promise<void> {
    const aliasNormalized = normalizeTitle(aliasRaw)
    if (!isUsefulSeriesCandidate(aliasNormalized)) return

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

  private async addAliases(identityId: number, canonicalTitle: string, aliases: string[]): Promise<void> {
    const canonicalNormalized = normalizeTitle(canonicalTitle)

    for (const aliasRaw of aliases) {
      const aliasNormalized = normalizeTitle(aliasRaw)
      if (!isUsefulSeriesCandidate(aliasNormalized)) continue
      if (similarity(aliasNormalized, canonicalNormalized) < aliasMatchThreshold) continue

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
