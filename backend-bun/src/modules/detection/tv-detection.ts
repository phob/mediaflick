import { basename, dirname, extname } from "node:path"
import { extractYear, normalizeTitle } from "@/modules/detection/normalization"
import { SeriesIdentityService } from "@/modules/detection/series-identity-service"
import { parseSourceEpisodeMatch } from "@/modules/media-lookup/tv-season-remapper"

export interface TvEpisodeDetection {
  seasonNumber: number
  episodeNumber: number
  episodeNumber2: number | null
  seriesTitle: string
  seriesYear: number | null
  tmdbId: number
  imdbId: string | null
}

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
  const parsed = parseSourceEpisodeMatch(filePath)
  if (!parsed) {
    return null
  }

  const detected = {
    titleHint: normalizeCandidate(parsed.titleHint),
    seasonNumber: parsed.seasonNumber,
    episodeNumber: parsed.episodeNumber,
    episodeNumber2: parsed.episodeNumber2,
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
