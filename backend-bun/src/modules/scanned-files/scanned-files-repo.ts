import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { scannedFiles } from "@/db/schema"
import {
  formatGenres,
  parseGenres,
  type MediaStatus,
  type MediaType,
  type MediaTypeStorage,
  type PagedResult,
  type ScannedFile,
  type ScannedFileStats,
  type UpdateScannedFileRequest,
} from "@/shared/types"

interface ListParams {
  status?: MediaStatus
  mediaType?: MediaType
  searchTerm?: string
  sortBy?: string
  sortOrder?: string
  page: number
  pageSize: number
  ids?: number[]
}

interface DashboardRecentCandidate {
  id: number
  mediaType: Extract<MediaType, "Movies" | "TvShows">
  tmdbId: number
  title: string | null
  year: number | null
  posterPath: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  sourceFile: string
  destFile: string | null
  fileSize: number | null
  createdAt: string
  updatedAt: string | null
}

interface DashboardSummary {
  totalFiles: number
  totalSuccessfulFiles: number
  totalFileSize: number
  totalSuccessfulFileSize: number
  distinctMovies: number
  distinctTvShows: number
  addedLast7Days: number
  addedLast30Days: number
  attentionCount: number
  lastIngestedAt: string | null
  lastLibraryItemAt: string | null
  byStatus: ScannedFileStats["byStatus"]
  byMediaType: ScannedFileStats["byMediaType"]
  storageByMediaType: MediaTypeStorage[]
  recentItems: DashboardRecentCandidate[]
}

const sortableTitleSql = sql<string>`
  lower(
    trim(
      case
        when lower(trim(${scannedFiles.title})) like 'the %' then substr(trim(${scannedFiles.title}), 5)
        when lower(trim(${scannedFiles.title})) like 'an %' then substr(trim(${scannedFiles.title}), 4)
        when lower(trim(${scannedFiles.title})) like 'a %' then substr(trim(${scannedFiles.title}), 3)
        else coalesce(trim(${scannedFiles.title}), '')
      end
    )
  )
`

function mapRow(row: typeof scannedFiles.$inferSelect): ScannedFile {
  return {
    id: row.id,
    sourceFile: row.sourceFile,
    destFile: row.destFile,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    mediaType: (row.mediaType as MediaType | null) ?? null,
    tmdbId: row.tmdbId,
    tvdbId: row.tvdbId,
    imdbId: row.imdbId,
    title: row.title,
    year: row.year,
    genres: parseGenres(row.genres),
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    episodeNumber2: row.episodeNumber2,
    posterPath: row.posterPath,
    status: row.status as MediaStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    versionUpdated: row.versionUpdated,
    updateToVersion: row.updateToVersion,
  }
}

function resolveSort(sortBy: string | undefined, sortOrder: string | undefined) {
  const dir = sortOrder?.toLowerCase() === "desc" ? "desc" : "asc"
  const fields = {
    createdat: scannedFiles.createdAt,
    updatedat: scannedFiles.updatedAt,
    sourcefile: scannedFiles.sourceFile,
    destfile: scannedFiles.destFile,
    filesize: scannedFiles.fileSize,
    filehash: scannedFiles.fileHash,
    status: scannedFiles.status,
    mediatype: scannedFiles.mediaType,
    seasonnumber: scannedFiles.seasonNumber,
    episodenumber: scannedFiles.episodeNumber,
    title: scannedFiles.title,
  }

  const key = (sortBy ?? "sourcefile").toLowerCase() as keyof typeof fields
  const field = fields[key] ?? scannedFiles.sourceFile
  return dir === "desc" ? desc(field) : asc(field)
}

export class ScannedFilesRepo {
  constructor(private readonly db: AppDb) {}

  async listByMediaType(mediaType: MediaType): Promise<ScannedFile[]> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(eq(scannedFiles.mediaType, mediaType))
    return rows.map(mapRow)
  }

  async listByTmdbId(tmdbId: number, mediaType?: MediaType): Promise<ScannedFile[]> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(mediaType ? and(eq(scannedFiles.tmdbId, tmdbId), eq(scannedFiles.mediaType, mediaType)) : eq(scannedFiles.tmdbId, tmdbId))
    return rows.map(mapRow)
  }

  async listBySourcePrefix(sourcePrefix: string): Promise<ScannedFile[]> {
    const normalizedPrefix = sourcePrefix.endsWith("/") ? sourcePrefix.slice(0, -1) : sourcePrefix
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(or(
        eq(scannedFiles.sourceFile, normalizedPrefix),
        like(scannedFiles.sourceFile, `${normalizedPrefix}/%`),
      ))
    return rows.map(mapRow)
  }

  async listAttentionCandidates(searchTerm?: string): Promise<ScannedFile[]> {
    const conditions = [
      or(
        ne(scannedFiles.status, "Success"),
        eq(scannedFiles.mediaType, "Unknown"),
      ),
    ]

    if (searchTerm) {
      const pattern = `%${searchTerm.toLowerCase()}%`
      conditions.push(or(
        like(sql`lower(${scannedFiles.sourceFile})`, pattern),
        like(sql`lower(${scannedFiles.destFile})`, pattern),
        like(sql`lower(coalesce(${scannedFiles.title}, ''))`, pattern),
      ))
    }

    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(and(...conditions))
      .orderBy(desc(sql`coalesce(${scannedFiles.updatedAt}, ${scannedFiles.createdAt})`), desc(scannedFiles.id))

    return rows.map(mapRow)
  }

  async list(params: ListParams): Promise<PagedResult<ScannedFile>> {
    const conditions = []

    if (params.status) {
      conditions.push(eq(scannedFiles.status, params.status))
    }
    if (params.mediaType) {
      conditions.push(eq(scannedFiles.mediaType, params.mediaType))
    }
    if (params.ids && params.ids.length > 0) {
      conditions.push(inArray(scannedFiles.id, params.ids))
    }
    if (params.searchTerm) {
      const pattern = `%${params.searchTerm.toLowerCase()}%`
      conditions.push(
        or(
          like(sql`lower(${scannedFiles.sourceFile})`, pattern),
          like(sql`lower(${scannedFiles.destFile})`, pattern),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const totalItemsRows = await this.db
      .select({ value: count() })
      .from(scannedFiles)
      .where(whereClause)
    const totalItems = totalItemsRows[0]?.value ?? 0

    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(whereClause)
      .orderBy(resolveSort(params.sortBy, params.sortOrder))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize)

    return {
      items: rows.map(mapRow),
      totalItems,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
    }
  }

  async findById(id: number): Promise<ScannedFile | null> {
    const rows = await this.db.select().from(scannedFiles).where(eq(scannedFiles.id, id)).limit(1)
    if (!rows[0]) {
      return null
    }
    return mapRow(rows[0])
  }

  async findBySource(sourceFile: string): Promise<ScannedFile | null> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(eq(scannedFiles.sourceFile, sourceFile))
      .orderBy(desc(scannedFiles.id))
      .limit(1)
    if (!rows[0]) {
      return null
    }
    return mapRow(rows[0])
  }

  async findByDestination(destFile: string): Promise<ScannedFile | null> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(eq(scannedFiles.destFile, destFile))
      .orderBy(desc(scannedFiles.id))
      .limit(1)
    if (!rows[0]) {
      return null
    }
    return mapRow(rows[0])
  }

  async createProcessingEntry(input: {
    sourceFile: string
    fileSize: number | null
    fileHash: string | null
    mediaType: MediaType
  }): Promise<ScannedFile> {
    const now = new Date().toISOString()
    const inserted = await this.db
      .insert(scannedFiles)
      .values({
        sourceFile: input.sourceFile,
        destFile: null,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        mediaType: input.mediaType,
        tmdbId: null,
        tvdbId: null,
        imdbId: null,
        title: null,
        year: null,
        genres: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeNumber2: null,
        status: "Processing",
        createdAt: now,
        updatedAt: now,
        versionUpdated: 0,
        updateToVersion: 0,
      })
      .returning()

    return mapRow(inserted[0])
  }

  async updateProcessed(input: {
    id: number
    destFile: string | null
    mediaType: MediaType
    tmdbId: number | null
    tvdbId: number | null
    imdbId: string | null
    title: string | null
    year: number | null
    genres: string[] | null
    seasonNumber: number | null
    episodeNumber: number | null
    episodeNumber2: number | null
    posterPath?: string | null
    status: MediaStatus
  }): Promise<ScannedFile | null> {
    await this.db
      .update(scannedFiles)
      .set({
        destFile: input.destFile,
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        tvdbId: input.tvdbId,
        imdbId: input.imdbId,
        title: input.title,
        year: input.year,
        genres: formatGenres(input.genres),
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeNumber2: input.episodeNumber2,
        posterPath: input.posterPath ?? null,
        status: input.status,
        updatedAt: new Date().toISOString(),
        updateToVersion: sql`${scannedFiles.updateToVersion} + 1`,
      })
      .where(eq(scannedFiles.id, input.id))

    return this.findById(input.id)
  }

  async updateById(id: number, request: UpdateScannedFileRequest): Promise<ScannedFile | null> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updateToVersion: sql`${scannedFiles.updateToVersion} + 1`,
    }

    if (request.tmdbId !== undefined) updates.tmdbId = request.tmdbId > 0 ? request.tmdbId : null
    if (request.tvdbId !== undefined) updates.tvdbId = request.tvdbId > 0 ? request.tvdbId : null
    if (request.mediaType !== undefined) updates.mediaType = request.mediaType
    if (request.seasonNumber !== undefined) updates.seasonNumber = request.seasonNumber > 0 ? request.seasonNumber : null
    if (request.episodeNumber !== undefined) updates.episodeNumber = request.episodeNumber > 0 ? request.episodeNumber : null
    if (request.episodeNumber2 !== undefined) updates.episodeNumber2 = request.episodeNumber2 > 0 ? request.episodeNumber2 : null

    await this.db.update(scannedFiles).set(updates).where(eq(scannedFiles.id, id))
    return this.findById(id)
  }

  async markAsExtra(id: number): Promise<ScannedFile | null> {
    await this.db
      .update(scannedFiles)
      .set({
        mediaType: "Extras",
        tmdbId: null,
        tvdbId: null,
        imdbId: null,
        title: null,
        year: null,
        genres: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeNumber2: null,
        destFile: null,
        status: "Success",
        updatedAt: new Date().toISOString(),
        updateToVersion: sql`${scannedFiles.updateToVersion} + 1`,
      })
      .where(eq(scannedFiles.id, id))

    return this.findById(id)
  }

  async deleteById(id: number): Promise<ScannedFile | null> {
    const existing = await this.findById(id)
    if (!existing) {
      return null
    }

    await this.db.delete(scannedFiles).where(eq(scannedFiles.id, id))
    return existing
  }

  async deleteByIds(ids: number[]): Promise<ScannedFile[]> {
    if (ids.length === 0) {
      return []
    }

    const existing = await this.db.select().from(scannedFiles).where(inArray(scannedFiles.id, ids))
    await this.db.delete(scannedFiles).where(inArray(scannedFiles.id, ids))
    return existing.map(mapRow)
  }

  async listForTmdbTitles(mediaType?: MediaType, searchTerm?: string): Promise<Array<{ tmdbId: number | null; title: string | null; posterPath: string | null }>> {
    const conditions = [eq(scannedFiles.status, "Success"), isNotNull(scannedFiles.tmdbId)]

    if (mediaType) {
      conditions.push(eq(scannedFiles.mediaType, mediaType))
    }

    if (searchTerm) {
      const pattern = `%${searchTerm.toLowerCase()}%`
      conditions.push(like(sql`lower(${scannedFiles.title})`, pattern))
    }

    const rows = await this.db
      .select({ tmdbId: scannedFiles.tmdbId, title: scannedFiles.title, posterPath: scannedFiles.posterPath })
      .from(scannedFiles)
      .where(and(...conditions))
      .orderBy(
        asc(sortableTitleSql),
        asc(sql`lower(coalesce(${scannedFiles.title}, ''))`),
        desc(sql<number>`case when ${scannedFiles.posterPath} is not null then 1 else 0 end`),
        desc(scannedFiles.updatedAt),
      )

    const byTmdbId = new Map<number, { tmdbId: number | null; title: string | null; posterPath: string | null }>()
    for (const row of rows) {
      if (row.tmdbId == null || byTmdbId.has(row.tmdbId)) {
        continue
      }
      byTmdbId.set(row.tmdbId, row)
    }

    return [...byTmdbId.values()]
  }

  /** Returns distinct tmdbId + mediaType pairs that have a tmdbId but no posterPath yet. */
  async listMissingPosters(): Promise<Array<{ tmdbId: number; mediaType: string }>> {
    const rows = await this.db
      .selectDistinct({ tmdbId: scannedFiles.tmdbId, mediaType: scannedFiles.mediaType })
      .from(scannedFiles)
      .where(and(
        isNotNull(scannedFiles.tmdbId),
        isNull(scannedFiles.posterPath),
        eq(scannedFiles.status, "Success"),
      ))

    return rows
      .filter((r): r is { tmdbId: number; mediaType: string } => r.tmdbId != null && r.mediaType != null)
  }

  /** Sets posterPath for every row with the given tmdbId. */
  async setPosterByTmdbId(tmdbId: number, posterPath: string): Promise<void> {
    await this.db
      .update(scannedFiles)
      .set({ posterPath })
      .where(and(eq(scannedFiles.tmdbId, tmdbId), isNull(scannedFiles.posterPath)))
  }

  async stats(): Promise<ScannedFileStats> {
    const totals = await this.db.select({
      totalFiles: sql<number>`count(*)`,
      totalSuccessfulFiles: sql<number>`sum(case when ${scannedFiles.status} = 'Success' then 1 else 0 end)`,
      totalFileSize: sql<number>`coalesce(sum(${scannedFiles.fileSize}), 0)`,
      totalSuccessfulFileSize: sql<number>`coalesce(sum(case when ${scannedFiles.status} = 'Success' then ${scannedFiles.fileSize} else 0 end), 0)`,
    }).from(scannedFiles)

    const byStatusRows = await this.db
      .select({ status: scannedFiles.status, count: sql<number>`count(*)` })
      .from(scannedFiles)
      .groupBy(scannedFiles.status)

    const byMediaTypeRows = await this.db
      .select({ mediaType: scannedFiles.mediaType, count: sql<number>`count(*)` })
      .from(scannedFiles)
      .where(isNotNull(scannedFiles.mediaType))
      .groupBy(scannedFiles.mediaType)

    return {
      totalFiles: totals[0]?.totalFiles ?? 0,
      totalSuccessfulFiles: totals[0]?.totalSuccessfulFiles ?? 0,
      totalFileSize: totals[0]?.totalFileSize ?? 0,
      totalSuccessfulFileSize: totals[0]?.totalSuccessfulFileSize ?? 0,
      byStatus: byStatusRows.map(row => ({ status: row.status as MediaStatus, count: row.count })),
      byMediaType: byMediaTypeRows.map(row => ({ mediaType: row.mediaType as MediaType, count: row.count })),
    }
  }

  async dashboardSummary(limit = 6): Promise<DashboardSummary> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const totals = await this.db.select({
      totalFiles: sql<number>`count(*)`,
      totalSuccessfulFiles: sql<number>`sum(case when ${scannedFiles.status} = 'Success' then 1 else 0 end)`,
      totalFileSize: sql<number>`coalesce(sum(${scannedFiles.fileSize}), 0)`,
      totalSuccessfulFileSize: sql<number>`coalesce(sum(case when ${scannedFiles.status} = 'Success' then ${scannedFiles.fileSize} else 0 end), 0)`,
      distinctMovies: sql<number>`count(distinct case when ${scannedFiles.status} = 'Success' and ${scannedFiles.mediaType} = 'Movies' and ${scannedFiles.tmdbId} is not null then ${scannedFiles.tmdbId} end)`,
      distinctTvShows: sql<number>`count(distinct case when ${scannedFiles.status} = 'Success' and ${scannedFiles.mediaType} = 'TvShows' and ${scannedFiles.tmdbId} is not null then ${scannedFiles.tmdbId} end)`,
      addedLast7Days: sql<number>`sum(case when ${scannedFiles.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`,
      addedLast30Days: sql<number>`sum(case when ${scannedFiles.createdAt} >= ${thirtyDaysAgo} then 1 else 0 end)`,
      attentionCount: sql<number>`sum(case when ${scannedFiles.status} != 'Success' or ${scannedFiles.mediaType} = 'Unknown' then 1 else 0 end)`,
      lastIngestedAt: sql<string | null>`max(${scannedFiles.createdAt})`,
      lastLibraryItemAt: sql<string | null>`max(case when ${scannedFiles.status} = 'Success' and ${scannedFiles.mediaType} in ('Movies', 'TvShows') and ${scannedFiles.tmdbId} is not null then ${scannedFiles.createdAt} else null end)`,
    }).from(scannedFiles)

    const byStatusRows = await this.db
      .select({ status: scannedFiles.status, count: sql<number>`count(*)` })
      .from(scannedFiles)
      .groupBy(scannedFiles.status)

    const byMediaTypeRows = await this.db
      .select({ mediaType: scannedFiles.mediaType, count: sql<number>`count(*)` })
      .from(scannedFiles)
      .where(isNotNull(scannedFiles.mediaType))
      .groupBy(scannedFiles.mediaType)

    const storageRows = await this.db
      .select({
        mediaType: scannedFiles.mediaType,
        count: sql<number>`count(*)`,
        totalFileSize: sql<number>`coalesce(sum(${scannedFiles.fileSize}), 0)`,
      })
      .from(scannedFiles)
      .where(isNotNull(scannedFiles.mediaType))
      .groupBy(scannedFiles.mediaType)

    const recentRows = await this.db
      .select({
        id: scannedFiles.id,
        mediaType: scannedFiles.mediaType,
        tmdbId: scannedFiles.tmdbId,
        title: scannedFiles.title,
        year: scannedFiles.year,
        posterPath: scannedFiles.posterPath,
        seasonNumber: scannedFiles.seasonNumber,
        episodeNumber: scannedFiles.episodeNumber,
        episodeNumber2: scannedFiles.episodeNumber2,
        sourceFile: scannedFiles.sourceFile,
        destFile: scannedFiles.destFile,
        fileSize: scannedFiles.fileSize,
        createdAt: scannedFiles.createdAt,
        updatedAt: scannedFiles.updatedAt,
      })
      .from(scannedFiles)
      .where(and(
        eq(scannedFiles.status, "Success"),
        isNotNull(scannedFiles.tmdbId),
        or(eq(scannedFiles.mediaType, "Movies"), eq(scannedFiles.mediaType, "TvShows")),
      ))
      .orderBy(desc(scannedFiles.createdAt), desc(scannedFiles.id))
      .limit(limit)

    return {
      totalFiles: totals[0]?.totalFiles ?? 0,
      totalSuccessfulFiles: totals[0]?.totalSuccessfulFiles ?? 0,
      totalFileSize: totals[0]?.totalFileSize ?? 0,
      totalSuccessfulFileSize: totals[0]?.totalSuccessfulFileSize ?? 0,
      distinctMovies: totals[0]?.distinctMovies ?? 0,
      distinctTvShows: totals[0]?.distinctTvShows ?? 0,
      addedLast7Days: totals[0]?.addedLast7Days ?? 0,
      addedLast30Days: totals[0]?.addedLast30Days ?? 0,
      attentionCount: totals[0]?.attentionCount ?? 0,
      lastIngestedAt: totals[0]?.lastIngestedAt ?? null,
      lastLibraryItemAt: totals[0]?.lastLibraryItemAt ?? null,
      byStatus: byStatusRows.map(row => ({ status: row.status as MediaStatus, count: row.count })),
      byMediaType: byMediaTypeRows.map(row => ({ mediaType: row.mediaType as MediaType, count: row.count })),
      storageByMediaType: storageRows.map(row => ({
        mediaType: row.mediaType as MediaType,
        count: row.count,
        totalFileSize: row.totalFileSize,
      })),
      recentItems: recentRows
        .filter((row): row is typeof row & { mediaType: DashboardRecentCandidate["mediaType"]; tmdbId: number } => (
          row.mediaType === "Movies" || row.mediaType === "TvShows"
        ) && row.tmdbId !== null)
        .map(row => ({
          id: row.id,
          mediaType: row.mediaType,
          tmdbId: row.tmdbId,
          title: row.title,
          year: row.year,
          posterPath: row.posterPath,
          seasonNumber: row.seasonNumber,
          episodeNumber: row.episodeNumber,
          episodeNumber2: row.episodeNumber2,
          sourceFile: row.sourceFile,
          destFile: row.destFile,
          fileSize: row.fileSize,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
    }
  }

  async listSuccessfulWithDestination(): Promise<ScannedFile[]> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(and(eq(scannedFiles.status, "Success"), isNotNull(scannedFiles.destFile)))
    return rows.map(mapRow)
  }
}
