import { basename, extname } from "node:path"
import type { EpisodeRemapInfo } from "@/shared/types"

export interface SourceEpisodeTuple {
  seasonNumber: number
  episodeNumber: number
  episodeNumber2: number | null
}

interface IndexedSourceEpisodeTuple extends SourceEpisodeTuple {
  maxEpisode: number
}

export interface SeasonRemapRange {
  sourceStart: number
  sourceEnd: number
}

export interface SeasonRemapPlan {
  seasonNumber: number
  tmdbEpisodeCount: number
  sourceEpisodeMax: number
  collapsedRanges: SeasonRemapRange[]
}

const seasonEpisodePatterns = [
  /(?<title>.*?)[ ._-]*s(?<season>\d{1,2})[ ._-]*(?:e|ep)(?<episode>\d{1,3})(?:(?:[ ._-]*(?:e|ep)|[-_])(?<episode2>\d{1,3}))?(?=$|\D)/i,
  /(?<title>.*?)[ ._-]*(?<season>\d{1,2})x(?<episode>\d{1,3})(?:(?:x|[-_])(?<episode2>\d{1,3}))?(?=$|\D)/i,
]

export interface ParsedSourceEpisodeMatch {
  titleHint: string
  seasonNumber: number
  episodeNumber: number
  episodeNumber2: number | null
}

export function parseSourceEpisodeMatch(sourceFile: string): ParsedSourceEpisodeMatch | null {
  const fileName = basename(sourceFile, extname(sourceFile))

  for (const pattern of seasonEpisodePatterns) {
    const match = fileName.match(pattern)
    if (!match?.groups) {
      continue
    }

    const seasonNumber = Number(match.groups.season)
    const episodeNumber = Number(match.groups.episode)
    const episodeNumber2 = match.groups.episode2 ? Number(match.groups.episode2) : null
    if (!Number.isInteger(seasonNumber) || seasonNumber <= 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0) {
      continue
    }

    if (episodeNumber2 !== null && (!Number.isInteger(episodeNumber2) || episodeNumber2 <= episodeNumber)) {
      return {
        titleHint: match.groups.title ?? "",
        seasonNumber,
        episodeNumber,
        episodeNumber2: null,
      }
    }

    return {
      titleHint: match.groups.title ?? "",
      seasonNumber,
      episodeNumber,
      episodeNumber2,
    }
  }

  return null
}

export function parseSourceEpisodeTuple(sourceFile: string): SourceEpisodeTuple | null {
  const parsed = parseSourceEpisodeMatch(sourceFile)
  if (!parsed) {
    return null
  }

  return {
    seasonNumber: parsed.seasonNumber,
    episodeNumber: parsed.episodeNumber,
    episodeNumber2: parsed.episodeNumber2,
  }
}

function keyForTuple(tuple: SourceEpisodeTuple): string {
  return `${tuple.seasonNumber}:${tuple.episodeNumber}:${tuple.episodeNumber2 ?? ""}`
}

function dedupeAndSortTuples(tuples: SourceEpisodeTuple[]): IndexedSourceEpisodeTuple[] {
  const seen = new Set<string>()
  const deduped: IndexedSourceEpisodeTuple[] = []

  for (const tuple of tuples) {
    const key = keyForTuple(tuple)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push({
      ...tuple,
      maxEpisode: tuple.episodeNumber2 ?? tuple.episodeNumber,
    })
  }

  return deduped.sort((left, right) => {
    if (left.episodeNumber !== right.episodeNumber) {
      return left.episodeNumber - right.episodeNumber
    }
    return left.maxEpisode - right.maxEpisode
  })
}

export function buildSeasonRemapPlan(input: {
  seasonNumber: number
  tmdbEpisodeCount: number
  tuples: SourceEpisodeTuple[]
}): SeasonRemapPlan | null {
  if (input.tmdbEpisodeCount <= 0) {
    return null
  }

  const tuples = dedupeAndSortTuples(
    input.tuples.filter(tuple => tuple.seasonNumber === input.seasonNumber),
  )
  if (tuples.length === 0) {
    return null
  }

  const sourceEpisodeMax = Math.max(...tuples.map(tuple => tuple.maxEpisode))
  const overflow = sourceEpisodeMax - input.tmdbEpisodeCount
  if (overflow <= 0) {
    return null
  }

  const ranged = tuples
    .filter(tuple => tuple.episodeNumber2 !== null && tuple.episodeNumber2 > tuple.episodeNumber)
    .map(tuple => ({
      sourceStart: tuple.episodeNumber,
      sourceEnd: tuple.episodeNumber2 as number,
    }))
    .sort((left, right) => left.sourceStart - right.sourceStart || left.sourceEnd - right.sourceEnd)

  if (ranged.length === 0) {
    return null
  }

  let remaining = overflow
  const collapsedRanges: SeasonRemapRange[] = []
  for (const range of ranged) {
    if (remaining <= 0) {
      break
    }

    const availableReduction = range.sourceEnd - range.sourceStart
    if (availableReduction <= 0) {
      continue
    }

    const reducedBy = Math.min(availableReduction, remaining)
    const collapsed = {
      sourceStart: range.sourceStart,
      sourceEnd: range.sourceStart + reducedBy,
    }

    const previous = collapsedRanges[collapsedRanges.length - 1]
    if (previous && collapsed.sourceStart <= previous.sourceEnd) {
      continue
    }

    collapsedRanges.push(collapsed)
    remaining -= reducedBy
  }

  if (remaining > 0 || collapsedRanges.length === 0) {
    return null
  }

  return {
    seasonNumber: input.seasonNumber,
    tmdbEpisodeCount: input.tmdbEpisodeCount,
    sourceEpisodeMax,
    collapsedRanges,
  }
}

function remapSingleEpisode(sourceEpisode: number, collapsedRanges: SeasonRemapRange[]): number {
  let reduction = 0

  for (const range of collapsedRanges) {
    if (sourceEpisode < range.sourceStart) {
      break
    }

    if (sourceEpisode <= range.sourceEnd) {
      return range.sourceStart - reduction
    }

    reduction += range.sourceEnd - range.sourceStart
  }

  return sourceEpisode - reduction
}

export function applySeasonRemap(
  tuple: SourceEpisodeTuple,
  plan: SeasonRemapPlan | null,
): SourceEpisodeTuple {
  if (!plan || tuple.seasonNumber !== plan.seasonNumber) {
    return tuple
  }

  const remappedEpisodeNumber = remapSingleEpisode(
    tuple.episodeNumber,
    plan.collapsedRanges,
  )

  const remappedEpisodeNumber2 = tuple.episodeNumber2 === null
    ? null
    : remapSingleEpisode(tuple.episodeNumber2, plan.collapsedRanges)

  return {
    seasonNumber: tuple.seasonNumber,
    episodeNumber: remappedEpisodeNumber,
    episodeNumber2:
      remappedEpisodeNumber2 !== null && remappedEpisodeNumber2 > remappedEpisodeNumber
        ? remappedEpisodeNumber2
        : null,
  }
}

export function createEpisodeRemapInfo(
  source: SourceEpisodeTuple,
  remapped: SourceEpisodeTuple,
  plan: SeasonRemapPlan | null,
): EpisodeRemapInfo | null {
  if (!plan) {
    return null
  }

  const changed = source.episodeNumber !== remapped.episodeNumber
    || (source.episodeNumber2 ?? null) !== (remapped.episodeNumber2 ?? null)

  if (!changed) {
    return null
  }

  return {
    reason: "season-episode-compaction",
    sourceSeasonNumber: source.seasonNumber,
    sourceEpisodeNumber: source.episodeNumber,
    sourceEpisodeNumber2: source.episodeNumber2,
    remappedSeasonNumber: remapped.seasonNumber,
    remappedEpisodeNumber: remapped.episodeNumber,
    remappedEpisodeNumber2: remapped.episodeNumber2,
    tmdbEpisodeCount: plan.tmdbEpisodeCount,
    sourceEpisodeMax: plan.sourceEpisodeMax,
    collapsedRanges: plan.collapsedRanges.map(range => ({
      sourceStart: range.sourceStart,
      sourceEnd: range.sourceEnd,
    })),
  }
}
