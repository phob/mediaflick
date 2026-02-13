import { and, asc, count, desc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { scannedFiles } from "@/db/schema"
import { formatGenres, parseGenres, type MediaStatus, type MediaType, type PagedResult, type ScannedFile, type ScannedFileStats, type UpdateScannedFileRequest } from "@/shared/types"

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

function mapRow(row: typeof scannedFiles.$inferSelect): ScannedFile {
  return {
    id: row.id,
    sourceFile: row.sourceFile,
    destFile: row.destFile,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    mediaType: (row.mediaType as MediaType | null) ?? null,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    title: row.title,
    year: row.year,
    genres: parseGenres(row.genres),
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    episodeNumber2: row.episodeNumber2,
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
    imdbId: string | null
    title: string | null
    year: number | null
    genres: string[] | null
    seasonNumber: number | null
    episodeNumber: number | null
    episodeNumber2: number | null
    status: MediaStatus
  }): Promise<ScannedFile | null> {
    await this.db
      .update(scannedFiles)
      .set({
        destFile: input.destFile,
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        imdbId: input.imdbId,
        title: input.title,
        year: input.year,
        genres: formatGenres(input.genres),
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeNumber2: input.episodeNumber2,
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

  async listForTmdbTitles(mediaType?: MediaType, searchTerm?: string): Promise<Array<{ tmdbId: number | null; title: string | null }>> {
    const conditions = [eq(scannedFiles.status, "Success"), isNotNull(scannedFiles.tmdbId)]

    if (mediaType) {
      conditions.push(eq(scannedFiles.mediaType, mediaType))
    }

    if (searchTerm) {
      const pattern = `%${searchTerm.toLowerCase()}%`
      conditions.push(like(sql`lower(${scannedFiles.title})`, pattern))
    }

    return this.db
      .selectDistinct({ tmdbId: scannedFiles.tmdbId, title: scannedFiles.title })
      .from(scannedFiles)
      .where(and(...conditions))
      .orderBy(asc(scannedFiles.title))
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

  async listSuccessfulWithDestination(): Promise<ScannedFile[]> {
    const rows = await this.db
      .select()
      .from(scannedFiles)
      .where(and(eq(scannedFiles.status, "Success"), isNotNull(scannedFiles.destFile)))
    return rows.map(mapRow)
  }
}
