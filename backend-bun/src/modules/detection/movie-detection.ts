import { basename, extname } from "node:path"
import { extractYear, normalizeTitle } from "@/modules/detection/normalization"

export interface MovieDetectionResult {
  title: string
  normalizedTitle: string
  year: number | null
}

const moviePattern = /^(?<title>.*?)(?:\s+|[._-]+)(?<year>(?:19|20)\d{2})(?:\b|[._-])/i

export function detectMovieFromFileName(filePath: string): MovieDetectionResult | null {
  const fileName = basename(filePath, extname(filePath))
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
