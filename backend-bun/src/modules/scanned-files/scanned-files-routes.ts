import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { buildDestinationPath, cleanupDeadSymlinks, createSymlinkAt, removeSymlinkIfExists } from "@/modules/symlink/symlink-service"
import { HttpError } from "@/shared/errors"
import { parseJson } from "@/shared/http"
import type { MediaStatus, MediaType, UpdateScannedFileRequest } from "@/shared/types"

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

async function recreateSingleSymlink(id: number, context: AppContext) {
  const scannedFile = await context.scannedFilesRepo.findById(id)
  if (!scannedFile) {
    throw new HttpError(404, "Scanned file not found")
  }
  if (!scannedFile.mediaType || scannedFile.mediaType === "Extras" || scannedFile.mediaType === "Unknown") {
    throw new HttpError(400, "Scanned file does not support symlink recreation")
  }
  if (!scannedFile.title) {
    throw new HttpError(400, "Scanned file title is missing")
  }

  const config = await context.configStore.get()
  const mapping = config.plex.folderMappings.find(m => m.mediaType === scannedFile.mediaType)
  if (!mapping) {
    throw new HttpError(400, `No destination folder mapping for ${scannedFile.mediaType}`)
  }

  const destinationPath = buildDestinationPath(scannedFile.sourceFile, mapping.destinationFolder, scannedFile.mediaType, {
    title: scannedFile.title,
    year: scannedFile.year,
    imdbId: scannedFile.imdbId,
    seasonNumber: scannedFile.seasonNumber,
    episodeNumber: scannedFile.episodeNumber,
    episodeNumber2: scannedFile.episodeNumber2,
  })

  await createSymlinkAt(scannedFile.sourceFile, destinationPath)

  const updated = await context.scannedFilesRepo.updateProcessed({
    id: scannedFile.id,
    destFile: destinationPath,
    mediaType: scannedFile.mediaType,
    tmdbId: scannedFile.tmdbId,
    imdbId: scannedFile.imdbId,
    title: scannedFile.title,
    year: scannedFile.year,
    genres: scannedFile.genres,
    seasonNumber: scannedFile.seasonNumber,
    episodeNumber: scannedFile.episodeNumber,
    episodeNumber2: scannedFile.episodeNumber2,
    status: scannedFile.status,
  })

  if (updated) {
    context.wsHub.broadcast("file.updated", updated)
  }

  return updated
}

export function createScannedFilesRouter(context: AppContext) {
  const router = new Hono()

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

  router.post(ENTRYPOINTS.api.scannedFiles.recreateSymlinks, async c => {
    const all = await context.scannedFilesRepo.listSuccessfulWithDestination()
    let successCount = 0

    for (const entry of all) {
      try {
        await recreateSingleSymlink(entry.id, context)
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

    const updated = await recreateSingleSymlink(id, context)
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
    const updated = await context.scannedFilesRepo.updateById(id, body)
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
