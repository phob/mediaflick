import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import {
  buildDestinationPath,
  cleanupDeadSymlinks,
  createSymlinkAt,
  isDestinationConflictError,
  removeSymlinkIfExists,
} from "@/modules/symlink/symlink-service"
import { HttpError } from "@/shared/errors"
import { parseJson } from "@/shared/http"
import { SeriesIdentityService } from "@/modules/detection/series-identity-service"
import { MediaMetadataResolver } from "@/modules/media-lookup/media-metadata-resolver"
import type {
  BulkUpdateApplyResponse,
  BulkUpdateConflict,
  BulkUpdateDryRunResponse,
  BulkUpdateRequest,
  MediaStatus,
  MediaType,
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

async function recreateSingleSymlink(id: number, context: AppContext, metadataResolver: MediaMetadataResolver) {
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
    seasonNumber: meta.seasonNumber,
    episodeNumber: meta.episodeNumber,
    episodeNumber2: meta.episodeNumber2,
    episodeTitle: meta.episodeTitle,
  })

  if (scannedFile.destFile && scannedFile.destFile !== destinationPath) {
    await removeSymlinkIfExists(scannedFile.destFile)
  }

  let updated = null
  try {
    await createSymlinkAt(scannedFile.sourceFile, destinationPath)

    updated = await context.scannedFilesRepo.updateProcessed({
      id: scannedFile.id,
      destFile: destinationPath,
      mediaType: meta.mediaType,
      tmdbId: meta.tmdbId,
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

      await removeSymlinkIfExists(conflictPath)

      try {
        await createSymlinkAt(scannedFile.sourceFile, destinationPath)
        updated = await context.scannedFilesRepo.updateProcessed({
          id: scannedFile.id,
          destFile: destinationPath,
          mediaType: meta.mediaType,
          tmdbId: meta.tmdbId,
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
    context.wsHub.broadcast("file.updated", updated)
  }

  return updated
}

export function createScannedFilesRouter(context: AppContext) {
  const router = new Hono()
  const metadataResolver = new MediaMetadataResolver(context.db, () => context.tmdb)

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

  router.get(ENTRYPOINTS.api.scannedFiles.tmdbIdsAndTitles, async c => {
    const result = await context.scannedFilesRepo.listForTmdbTitles(
      (c.req.query("mediaType") as MediaType | undefined) ?? undefined,
      c.req.query("searchTerm") ?? undefined,
    )
    return c.json(result)
  })

  router.delete(ENTRYPOINTS.api.scannedFiles.batchDelete, async c => {
    const body = await parseJson<number[] | { ids: number[] }>(c.req.raw)
    const ids = Array.isArray(body) ? body : body.ids
    if (!ids || ids.length === 0) {
      return c.json({ error: "No IDs provided" }, 400)
    }

    const deleted = await context.scannedFilesRepo.deleteByIds(ids)
    for (const item of deleted) {
      if (item.destFile) {
        await removeSymlinkIfExists(item.destFile)
      }
      context.wsHub.broadcast("file.removed", item)
    }

    const config = await context.configStore.get()
    for (const mapping of config.plex.folderMappings) {
      await cleanupDeadSymlinks(mapping.destinationFolder)
    }

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
              await removeSymlinkIfExists(existing.destFile)
            }
            const updated = await context.scannedFilesRepo.markAsExtra(item.id)
            if (updated) {
              context.wsHub.broadcast("file.updated", updated)
              updatedCount += 1
            }
          } else {
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
          await recreateSingleSymlink(id, context, metadataResolver)
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
    return c.json(result)
  })

  router.post(ENTRYPOINTS.api.scannedFiles.recreateSymlinks, async c => {
    const all = await context.scannedFilesRepo.listSuccessfulWithDestination()
    let successCount = 0

    for (const entry of all) {
      try {
        await recreateSingleSymlink(entry.id, context, metadataResolver)
        successCount += 1
      } catch {
      }
    }

    return c.json({ successCount })
  })

  router.patch(ENTRYPOINTS.api.scannedFiles.recreateSymlinkById, async c => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid id" }, 400)
    }

    const updated = await recreateSingleSymlink(id, context, metadataResolver)
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
      await removeSymlinkIfExists(existing.destFile)
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

    const deleted = await context.scannedFilesRepo.deleteById(id)
    if (!deleted) {
      return c.json({ error: "Not found" }, 404)
    }
    if (deleted.destFile) {
      await removeSymlinkIfExists(deleted.destFile)
    }
    context.wsHub.broadcast("file.removed", deleted)
    return c.json({ deletedId: id })
  })

  router.delete(ENTRYPOINTS.api.scannedFiles.base, async c => {
    const ids = parseIds(c.req.query("ids") ?? null)
    if (ids.length === 0) {
      return c.json({ error: "No ids provided" }, 400)
    }

    const deleted = await context.scannedFilesRepo.deleteByIds(ids)
    for (const item of deleted) {
      if (item.destFile) {
        await removeSymlinkIfExists(item.destFile)
      }
      context.wsHub.broadcast("file.removed", item)
    }
    return c.json({ deletedIds: deleted.map(item => item.id) })
  })

  return router
}
