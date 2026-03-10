import { and, eq, inArray } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { jellyfinSyncState } from "@/db/schema"
import type {
  JellyfinSeasonSync,
  JellyfinMatchSource,
  JellyfinSyncDetails,
  JellyfinSyncIssue,
  JellyfinSyncState,
  JellyfinSyncSummary,
  MediaType,
} from "@/shared/types"

interface JellyfinDetailsPayload {
  message?: string | null
  issue?: JellyfinSyncIssue | null
  jellyfinPath?: string | null
  localPaths?: string[]
  localDirectories?: string[]
  verifiedEpisodes?: number
  missingEpisodes?: number
  touchedSeasons?: number[]
  seasonDiagnostics?: JellyfinSeasonSync[]
}

export interface JellyfinSyncRecord extends JellyfinSyncDetails {
  mediaType: Extract<MediaType, "Movies" | "TvShows">
  tmdbId: number
}

interface UpsertInput {
  mediaType: Extract<MediaType, "Movies" | "TvShows">
  tmdbId: number
  jellyfinItemId?: string | null
  jellyfinLibraryId?: string | null
  state: JellyfinSyncState
  matchedBy?: JellyfinMatchSource | null
  lastCheckedAt?: string | null
  lastNotifiedAt?: string | null
  lastError?: string | null
  details?: JellyfinDetailsPayload | null
}

function parseDetails(raw: string | null): JellyfinDetailsPayload {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as JellyfinDetailsPayload
    return {
      message: parsed.message ?? null,
      issue: parsed.issue ?? null,
      jellyfinPath: parsed.jellyfinPath ?? null,
      localPaths: Array.isArray(parsed.localPaths) ? parsed.localPaths.filter(item => typeof item === "string") : undefined,
      localDirectories: Array.isArray(parsed.localDirectories) ? parsed.localDirectories.filter(item => typeof item === "string") : undefined,
      verifiedEpisodes: parsed.verifiedEpisodes,
      missingEpisodes: parsed.missingEpisodes,
      touchedSeasons: Array.isArray(parsed.touchedSeasons)
        ? parsed.touchedSeasons.filter(item => Number.isInteger(item))
        : undefined,
      seasonDiagnostics: Array.isArray(parsed.seasonDiagnostics)
        ? parsed.seasonDiagnostics.filter((item): item is JellyfinSeasonSync => (
          typeof item === "object"
          && item !== null
          && Number.isInteger(item.seasonNumber)
          && Number.isInteger(item.localEpisodeCount)
          && Number.isInteger(item.jellyfinEpisodeCount)
          && Number.isInteger(item.verifiedEpisodes)
          && Number.isInteger(item.missingEpisodes)
        ))
        : undefined,
    }
  } catch {
    return {}
  }
}

function toRecord(row: typeof jellyfinSyncState.$inferSelect): JellyfinSyncRecord {
  const details = parseDetails(row.detailsJson)
  return {
    mediaType: row.mediaType as Extract<MediaType, "Movies" | "TvShows">,
    tmdbId: row.tmdbId,
    jellyfinItemId: row.jellyfinItemId,
    jellyfinLibraryId: row.jellyfinLibraryId,
    state: row.state as JellyfinSyncState,
    matchedBy: (row.matchedBy as JellyfinMatchSource | null) ?? null,
    lastCheckedAt: row.lastCheckedAt,
    lastNotifiedAt: row.lastNotifiedAt,
    lastError: row.lastError,
    message: details.message ?? null,
    issue: details.issue ?? null,
    jellyfinPath: details.jellyfinPath ?? null,
    localPaths: details.localPaths,
    localDirectories: details.localDirectories,
    verifiedEpisodes: details.verifiedEpisodes,
    missingEpisodes: details.missingEpisodes,
    touchedSeasons: details.touchedSeasons,
    seasonDiagnostics: details.seasonDiagnostics,
  }
}

export function toJellyfinSummary(record: JellyfinSyncRecord | null): JellyfinSyncSummary | null {
  if (!record) {
    return null
  }

  return {
    state: record.state,
    lastCheckedAt: record.lastCheckedAt,
    jellyfinItemId: record.jellyfinItemId,
  }
}

export class JellyfinSyncRepo {
  constructor(private readonly db: AppDb) {}

  async findByMediaTmdbId(
    mediaType: Extract<MediaType, "Movies" | "TvShows">,
    tmdbId: number,
  ): Promise<JellyfinSyncRecord | null> {
    const rows = await this.db
      .select()
      .from(jellyfinSyncState)
      .where(and(eq(jellyfinSyncState.mediaType, mediaType), eq(jellyfinSyncState.tmdbId, tmdbId)))
      .limit(1)

    return rows[0] ? toRecord(rows[0]) : null
  }

  async findSummariesByMediaTmdbIds(
    mediaType: Extract<MediaType, "Movies" | "TvShows">,
    tmdbIds: number[],
  ): Promise<Map<number, JellyfinSyncSummary>> {
    if (tmdbIds.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select()
      .from(jellyfinSyncState)
      .where(and(eq(jellyfinSyncState.mediaType, mediaType), inArray(jellyfinSyncState.tmdbId, tmdbIds)))

    const map = new Map<number, JellyfinSyncSummary>()
    for (const row of rows) {
      map.set(row.tmdbId, {
        state: row.state as JellyfinSyncState,
        lastCheckedAt: row.lastCheckedAt,
        jellyfinItemId: row.jellyfinItemId,
      })
    }
    return map
  }

  async upsert(input: UpsertInput): Promise<JellyfinSyncRecord> {
    const existing = await this.findByMediaTmdbId(input.mediaType, input.tmdbId)
    const detailsJson = input.details === undefined
      ? existing
        ? JSON.stringify({
          message: existing.message,
          issue: existing.issue,
          jellyfinPath: existing.jellyfinPath,
          localPaths: existing.localPaths,
          localDirectories: existing.localDirectories,
          verifiedEpisodes: existing.verifiedEpisodes,
          missingEpisodes: existing.missingEpisodes,
          touchedSeasons: existing.touchedSeasons,
          seasonDiagnostics: existing.seasonDiagnostics,
        })
        : null
      : input.details === null
        ? null
        : JSON.stringify(input.details)

    await this.db
      .insert(jellyfinSyncState)
      .values({
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        jellyfinItemId: input.jellyfinItemId ?? existing?.jellyfinItemId ?? null,
        jellyfinLibraryId: input.jellyfinLibraryId ?? existing?.jellyfinLibraryId ?? null,
        state: input.state,
        matchedBy: input.matchedBy ?? existing?.matchedBy ?? null,
        lastCheckedAt: input.lastCheckedAt ?? existing?.lastCheckedAt ?? null,
        lastNotifiedAt: input.lastNotifiedAt ?? existing?.lastNotifiedAt ?? null,
        lastError: input.lastError ?? existing?.lastError ?? null,
        detailsJson: detailsJson ?? null,
      })
      .onConflictDoUpdate({
        target: [jellyfinSyncState.mediaType, jellyfinSyncState.tmdbId],
        set: {
          jellyfinItemId: input.jellyfinItemId ?? existing?.jellyfinItemId ?? null,
          jellyfinLibraryId: input.jellyfinLibraryId ?? existing?.jellyfinLibraryId ?? null,
          state: input.state,
          matchedBy: input.matchedBy ?? existing?.matchedBy ?? null,
          lastCheckedAt: input.lastCheckedAt ?? existing?.lastCheckedAt ?? null,
          lastNotifiedAt: input.lastNotifiedAt ?? existing?.lastNotifiedAt ?? null,
          lastError: input.lastError ?? existing?.lastError ?? null,
          detailsJson: detailsJson ?? null,
        },
      })

    return (await this.findByMediaTmdbId(input.mediaType, input.tmdbId))!
  }
}
