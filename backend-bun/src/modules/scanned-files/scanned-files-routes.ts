import type { AppContext } from "@/app/context"
import { buildDestinationPath, cleanupDeadSymlinks, createSymlinkAt, removeSymlinkIfExists } from "@/modules/symlink/symlink-service"
import { HttpError } from "@/shared/errors"
import { json, parseJson } from "@/shared/http"
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

export async function handleScannedFilesRoute(request: Request, pathname: string, context: AppContext): Promise<Response | null> {
  if (!pathname.startsWith("/api/scannedfiles")) {
    return null
  }

  const url = new URL(request.url)

  if (request.method === "GET" && pathname === "/api/scannedfiles") {
    const result = await context.scannedFilesRepo.list({
      status: (url.searchParams.get("status") as MediaStatus | null) ?? undefined,
      mediaType: (url.searchParams.get("mediaType") as MediaType | null) ?? undefined,
      searchTerm: url.searchParams.get("searchTerm") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortOrder: url.searchParams.get("sortOrder") ?? undefined,
      page: parseNumber(url.searchParams.get("page"), 1),
      pageSize: parseNumber(url.searchParams.get("pageSize"), 30),
      ids: url.searchParams.getAll("ids").map(Number).filter(v => Number.isInteger(v)),
    })

    return json(result)
  }

  if (request.method === "GET" && pathname === "/api/scannedfiles/stats") {
    const stats = await context.scannedFilesRepo.stats()
    return json(stats)
  }

  if (request.method === "GET" && pathname === "/api/scannedfiles/tmdb-ids-and-titles") {
    const result = await context.scannedFilesRepo.listForTmdbTitles(
      (url.searchParams.get("mediaType") as MediaType | null) ?? undefined,
      url.searchParams.get("searchTerm") ?? undefined,
    )
    return json(result)
  }

  if (request.method === "DELETE" && pathname === "/api/scannedfiles/batch") {
    const body = await parseJson<number[] | { ids: number[] }>(request)
    const ids = Array.isArray(body) ? body : body.ids
    if (!ids || ids.length === 0) {
      return json({ error: "No IDs provided" }, { status: 400 })
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

    return json({ deletedIds: deleted.map(item => item.id) })
  }

  if (request.method === "POST" && pathname === "/api/scannedfiles/recreate-symlinks") {
    const all = await context.scannedFilesRepo.listSuccessfulWithDestination()
    let successCount = 0

    for (const entry of all) {
      try {
        await recreateSingleSymlink(entry.id, context)
        successCount += 1
      } catch {
      }
    }

    return json({ successCount })
  }

  const recreateMatch = pathname.match(/^\/api\/scannedfiles\/(\d+)\/recreate-symlink$/)
  if (request.method === "PATCH" && recreateMatch) {
    const id = Number(recreateMatch[1])
    if (!Number.isInteger(id)) {
      return json({ error: "Invalid id" }, { status: 400 })
    }

    const updated = await recreateSingleSymlink(id, context)
    return json(updated)
  }

  const idMatch = pathname.match(/^\/api\/scannedfiles\/(\d+)$/)
  if (idMatch) {
    const id = Number(idMatch[1])
    if (!Number.isInteger(id)) {
      return json({ error: "Invalid id" }, { status: 400 })
    }

    if (request.method === "GET") {
      const item = await context.scannedFilesRepo.findById(id)
      if (!item) {
        return json({ error: "Not found" }, { status: 404 })
      }
      return json(item)
    }

    if (request.method === "PATCH") {
      const body = await parseJson<UpdateScannedFileRequest>(request)
      const updated = await context.scannedFilesRepo.updateById(id, body)
      if (!updated) {
        return json({ error: "Not found" }, { status: 404 })
      }

      context.wsHub.broadcast("file.updated", updated)
      return json(updated)
    }

    if (request.method === "DELETE") {
      const deleted = await context.scannedFilesRepo.deleteById(id)
      if (!deleted) {
        return json({ error: "Not found" }, { status: 404 })
      }
      if (deleted.destFile) {
        await removeSymlinkIfExists(deleted.destFile)
      }
      context.wsHub.broadcast("file.removed", deleted)
      return json({ deletedId: id })
    }
  }

  if (pathname === "/api/scannedfiles" && request.method === "DELETE") {
    const ids = parseIds(url.searchParams.get("ids"))
    if (ids.length === 0) {
      return json({ error: "No ids provided" }, { status: 400 })
    }
    const deleted = await context.scannedFilesRepo.deleteByIds(ids)
    for (const item of deleted) {
      if (item.destFile) {
        await removeSymlinkIfExists(item.destFile)
      }
      context.wsHub.broadcast("file.removed", item)
    }
    return json({ deletedIds: deleted.map(item => item.id) })
  }

  return null
}
