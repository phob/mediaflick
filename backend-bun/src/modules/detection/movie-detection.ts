import { basename, dirname, extname } from "node:path"
import { extractYear, normalizeTitle } from "@/modules/detection/normalization"

export interface MovieDetectionResult {
  title: string
  normalizedTitle: string
  year: number | null
}

const moviePattern = /^(?<title>.*?)(?:\s+|[._-]+)(?<year>(?:19|20)\d{2})(?:\b|[._-])/i

const bluRayContainerFolders = new Set([
  "bdmv",
  "stream",
  "playlist",
  "clipinf",
  "backup",
  "certificate",
  "ssif",
])

function movieNameCandidateFromPath(filePath: string): string {
  const extension = extname(filePath).toLowerCase()
  const fileName = basename(filePath, extension)

  if (extension !== ".m2ts") {
    return fileName
  }

  const folderCandidates = [
    basename(dirname(filePath)),
    basename(dirname(dirname(filePath))),
    basename(dirname(dirname(dirname(filePath)))),
  ]

  const folderName = folderCandidates.find(
    (candidate) =>
      candidate && !bluRayContainerFolders.has(candidate.toLowerCase()),
  )

  return folderName ?? fileName
}

export function detectMovieFromFileName(filePath: string): MovieDetectionResult | null {
  const fileName = movieNameCandidateFromPath(filePath)
  const match = fileName.match(moviePattern)

  if (!match?.groups) {
    const fallbackTitle = normalizeTitle(fileName)
    if (!fallbackTitle) {
      return null
    }
    return {
      title: fallbackTitle,
      normalizedTitle: fallbackTitle,
      year: extractYear(fileName),
    }
  }

  const rawTitle = match.groups.title.replace(/[._-]/g, " ").trim()
  const normalizedTitle = normalizeTitle(rawTitle)
  const year = Number(match.groups.year)

  if (!normalizedTitle) {
    return null
  }

  return {
    title: rawTitle,
    normalizedTitle,
    year: Number.isInteger(year) ? year : null,
  }
}
