import { lstat, mkdir, readdir, readlink, rm, symlink, unlink } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import type { MediaType } from "@/shared/types"

interface SymlinkMeta {
  title: string
  year: number | null
  imdbId: string | null
  seasonNumber?: number | null
  episodeNumber?: number | null
  episodeNumber2?: number | null
  episodeTitle?: string | null
}

export class DestinationConflictError extends Error {
  constructor(public readonly destinationFile: string) {
    super(`Destination already points to another source: ${destinationFile}`)
    this.name = "DestinationConflictError"
  }
}

export function isDestinationConflictError(error: unknown): error is DestinationConflictError {
  return (
    error instanceof DestinationConflictError
    || (error instanceof Error && error.message.startsWith("Destination already points to another source:"))
  )
}

function cleanFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, " -")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function formatMoviePath(meta: SymlinkMeta, extension: string): string {
  if (!meta.year) {
    throw new Error("Movie year is required")
  }
  const folder = `${cleanFileName(meta.title)} (${meta.year})`
  const imdbTag = meta.imdbId ? ` {imdb-${meta.imdbId}}` : ""
  const fileName = `${cleanFileName(meta.title)} (${meta.year})${imdbTag}${extension}`
  return join(folder, fileName)
}

function formatTvPath(meta: SymlinkMeta, extension: string): string {
  if (!meta.year || !meta.seasonNumber || !meta.episodeNumber) {
    throw new Error("TV metadata is incomplete")
  }

  const showFolder = `${cleanFileName(meta.title)} (${meta.year})`
  const seasonFolder = `Season ${String(meta.seasonNumber).padStart(2, "0")}`

  let fileBase = `${cleanFileName(meta.title)} - S${String(meta.seasonNumber).padStart(2, "0")}E${String(meta.episodeNumber).padStart(2, "0")}`
  if (meta.episodeNumber2) {
    fileBase += `E${String(meta.episodeNumber2).padStart(2, "0")}`
  }
  if (meta.episodeTitle) {
    fileBase += ` - ${cleanFileName(meta.episodeTitle)}`
  }

  return join(showFolder, seasonFolder, `${fileBase}${extension}`)
}

export function buildDestinationPath(sourceFile: string, destinationRoot: string, mediaType: MediaType, meta: SymlinkMeta): string {
  const extension = extname(sourceFile)

  let relative: string
  if (mediaType === "Movies") {
    relative = formatMoviePath(meta, extension)
  } else if (mediaType === "TvShows") {
    relative = formatTvPath(meta, extension)
  } else {
    throw new Error(`Cannot build destination for media type ${mediaType}`)
  }

  return join(destinationRoot, relative)
}

export async function createSymlinkAt(sourceFile: string, destinationFile: string): Promise<void> {
  await mkdir(dirname(destinationFile), { recursive: true })

  try {
    const existing = await lstat(destinationFile)
    if (existing.isSymbolicLink()) {
      const target = await readlink(destinationFile)
      if (target === sourceFile) {
        return
      }
      throw new DestinationConflictError(destinationFile)
    }
    throw new Error(`Destination already exists and is not a symlink: ${destinationFile}`)
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error
    }
  }

  await symlink(sourceFile, destinationFile)
}

export async function removeSymlinkIfExists(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) {
      await unlink(path)
    }
  } catch {
  }
}

export async function cleanupDeadSymlinks(root: string): Promise<void> {
  async function walk(path: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await readdir(path)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(path, entry)
      let stat
      try {
        stat = await lstat(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        await walk(fullPath)
        try {
          const after = await readdir(fullPath)
          if (after.length === 0) {
            await rm(fullPath, { recursive: false, force: true })
          }
        } catch {
        }
        continue
      }

      if (!stat.isSymbolicLink()) {
        continue
      }

      try {
        const target = await readlink(fullPath)
        await lstat(target)
      } catch {
        await unlink(fullPath)
      }
    }
  }

  await walk(root)
}
