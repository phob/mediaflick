import { basename, dirname, extname } from "node:path"
import { extractYear, normalizeTitle } from "@/modules/detection/normalization"
import { SeriesIdentityService } from "@/modules/detection/series-identity-service"

export interface TvEpisodeDetection {
  seasonNumber: number
  episodeNumber: number
  episodeNumber2: number | null
  seriesTitle: string
  seriesYear: number | null
  tmdbId: number
  imdbId: string | null
}

const seasonEpisodePatterns = [
  /(?<title>.*?)[ ._-]*s(?<season>\d{1,2})[ ._-]*(?:e|ep)(?<episode>\d{1,2})(?:[- ]?(?:e|ep)?(?<episode2>\d{1,2}))?/i,
  /(?<title>.*?)[ ._-]*(?<season>\d{1,2})x(?<episode>\d{1,2})(?:[- ]?(?<episode2>\d{1,2}))?/i,
]

function extractFolderCandidates(filePath: string): string[] {
  const parent = basename(dirname(filePath))
  const grandParent = basename(dirname(dirname(filePath)))
  const candidates = [parent, grandParent]
  return candidates.filter(Boolean)
}

function normalizeCandidate(value: string): string {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b(?:s\d{1,2}|season\s*\d{1,2}|complete|series)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export async function detectTvEpisode(
  filePath: string,
  identityService: SeriesIdentityService,
): Promise<TvEpisodeDetection | null> {
  const fileName = basename(filePath, extname(filePath))

  let detected: {
    titleHint: string
    seasonNumber: number
    episodeNumber: number
    episodeNumber2: number | null
  } | null = null

  for (const pattern of seasonEpisodePatterns) {
    const match = fileName.match(pattern)
    if (!match?.groups) {
      continue
    }

    const seasonNumber = Number(match.groups.season)
    const episodeNumber = Number(match.groups.episode)
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
      continue
    }

    detected = {
      titleHint: normalizeCandidate(match.groups.title ?? ""),
      seasonNumber,
      episodeNumber,
      episodeNumber2: match.groups.episode2 ? Number(match.groups.episode2) : null,
    }
    break
  }

  if (!detected) {
    return null
  }

  const folderCandidates = extractFolderCandidates(filePath).map(normalizeCandidate)
  const titleCandidates = [detected.titleHint, ...folderCandidates].filter(Boolean)
  const yearHint = extractYear(titleCandidates.join(" "))

  const identity = await identityService.resolve({
    candidates: titleCandidates,
    yearHint,
  })

  if (!identity) {
    return null
  }

  return {
    seasonNumber: detected.seasonNumber,
    episodeNumber: detected.episodeNumber,
    episodeNumber2: detected.episodeNumber2,
    seriesTitle: identity.canonicalTitle,
    seriesYear: identity.year,
    tmdbId: identity.tmdbId,
    imdbId: identity.imdbId,
  }
}

export function candidateFromMovieFile(filePath: string): string {
  const fileName = basename(filePath, extname(filePath))
  return normalizeTitle(fileName)
}
