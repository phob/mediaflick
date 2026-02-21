export interface ParsedFileInfo {
  season?: number
  episode?: number
  episode2?: number
  confidence: "high" | "medium" | "low"
  cleanTitle: string
}

const VIDEO_EXTENSIONS = /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|mpg|mpeg|ts|m2ts|vob|divx|rmvb|3gp|ogv)$/i

const NOISE_TOKENS = new Set([
  "720p", "1080p", "2160p", "4k", "uhd",
  "bluray", "blu-ray", "bdrip", "brrip",
  "web-dl", "webdl", "webrip", "web",
  "hdrip", "dvdrip", "dvdscr", "dvd",
  "hdtv", "pdtv", "sdtv",
  "x264", "x265", "h264", "h265", "hevc", "avc",
  "aac", "ac3", "dts", "dts-hd", "atmos", "truehd", "flac", "mp3",
  "remux", "proper", "repack", "internal", "readnfo",
  "extended", "unrated", "directors", "cut", "theatrical",
  "hdr", "hdr10", "hdr10+", "dolby", "vision", "dv",
  "10bit", "8bit",
  "multi", "dual", "subs",
])

function fileNameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] ?? path
}

function stripExtension(name: string): string {
  return name.replace(VIDEO_EXTENSIONS, "")
}

function cleanForTitle(raw: string): string {
  let result = stripExtension(raw)

  // Remove season/episode patterns first so they don't leak into the title
  result = result.replace(/[Ss]\d+[Ee]\d+(?:[Ee]\d+)?(?:-[Ee]?\d+)?/g, " ")
  result = result.replace(/\d+x\d+/gi, " ")
  result = result.replace(/[Ss]eason\s*\d+/gi, " ")
  result = result.replace(/[Ee]pisode\s*\d+/gi, " ")

  // Remove bracketed/parenthesized content
  result = result.replace(/\[.*?\]/g, " ")
  result = result.replace(/\(.*?\)/g, " ")
  result = result.replace(/\{.*?\}/g, " ")

  // Replace separators with spaces
  result = result.replace(/[._-]/g, " ")

  // Remove noise tokens
  const tokens = result.split(/\s+/).filter(Boolean)
  const cleaned: string[] = []
  for (const token of tokens) {
    if (NOISE_TOKENS.has(token.toLowerCase())) break
    // Skip bare years at the end (but keep them in context)
    if (/^\d{4}$/.test(token) && Number(token) >= 1900 && Number(token) <= 2099) {
      cleaned.push(token)
      break
    }
    cleaned.push(token)
  }

  return cleaned.join(" ").trim()
}

/**
 * Parse season/episode information from a file path.
 *
 * Handles patterns in priority order:
 * 1. S01E03E04       (multi-episode, NOT a range)
 * 2. S01E03-E05      (range)
 * 3. S01E03-05       (range, no E prefix on second)
 * 4. S01E03          (standard)
 * 5. 1x03            (alt format)
 * 6. Season N Episode N (verbose)
 * 7. S1 Ep 3 / S1 E3 (spaced)
 * 8. 103 / 0103      (bare digit encoding)
 * 9. - 03 -          (bare episode)
 */
export function parseEpisodeInfo(filePath: string): ParsedFileInfo {
  const name = fileNameFromPath(filePath)
  const base = stripExtension(name)
  const cleanTitle = cleanForTitle(name)

  // 1. SxxExxExx -- multi-episode (NOT a range)
  const multiEp = base.match(/[Ss](\d+)[Ee](\d+)[Ee](\d+)/i)
  if (multiEp) {
    return {
      season: Number(multiEp[1]),
      episode: Number(multiEp[2]),
      episode2: Number(multiEp[3]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 2. SxxExx-Exx (range with E prefix)
  const rangeE = base.match(/[Ss](\d+)[Ee](\d+)-[Ee](\d+)/i)
  if (rangeE) {
    return {
      season: Number(rangeE[1]),
      episode: Number(rangeE[2]),
      episode2: Number(rangeE[3]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 3. SxxExx-xx (range without E prefix on second)
  const rangeNoE = base.match(/[Ss](\d+)[Ee](\d+)-(\d+)/i)
  if (rangeNoE) {
    const ep1 = Number(rangeNoE[2])
    const ep2 = Number(rangeNoE[3])
    // Only treat as range if second number > first (otherwise it could be year or other)
    if (ep2 > ep1) {
      return {
        season: Number(rangeNoE[1]),
        episode: ep1,
        episode2: ep2,
        confidence: "high",
        cleanTitle,
      }
    }
  }

  // 4. SxxExx (standard)
  const standard = base.match(/[Ss](\d+)[Ee](\d+)/i)
  if (standard) {
    return {
      season: Number(standard[1]),
      episode: Number(standard[2]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 5. NxNN
  const altFormat = base.match(/(\d+)x(\d{2,3})/i)
  if (altFormat) {
    return {
      season: Number(altFormat[1]),
      episode: Number(altFormat[2]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 6. Season N ... Episode N (verbose)
  const verbose = base.match(/[Ss]eason\s*(\d+).*?[Ee]pisode\s*(\d+)/i)
  if (verbose) {
    return {
      season: Number(verbose[1]),
      episode: Number(verbose[2]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 7. S1 Ep 3, S1 E3 (spaced variants)
  const spaced = base.match(/[Ss](\d+)\s*[Ee]p?\s*(\d+)/i)
  if (spaced) {
    return {
      season: Number(spaced[1]),
      episode: Number(spaced[2]),
      confidence: "high",
      cleanTitle,
    }
  }

  // 8. 4-digit bare: 0103 -> S01E03
  const fourDigit = base.match(/(?:^|[^0-9])(\d{2})(\d{2})(?:$|[^0-9])/i)
  if (fourDigit) {
    const s = Number(fourDigit[1])
    const e = Number(fourDigit[2])
    if (s >= 1 && s <= 99 && e >= 1 && e <= 99) {
      return {
        season: s,
        episode: e,
        confidence: "medium",
        cleanTitle,
      }
    }
  }

  // 9. 3-digit bare: 103 -> S1E03
  const threeDigit = base.match(/(?:^|[^0-9])(\d)(\d{2})(?:$|[^0-9])/)
  if (threeDigit) {
    const s = Number(threeDigit[1])
    const e = Number(threeDigit[2])
    if (s >= 1 && s <= 9 && e >= 1 && e <= 99) {
      return {
        season: s,
        episode: e,
        confidence: "medium",
        cleanTitle,
      }
    }
  }

  // 10. Bare number in separators: - 03 -, .03., _03_
  const bareNumber = base.match(/[.\s_-](\d{1,3})[.\s_-]/)
  if (bareNumber) {
    const e = Number(bareNumber[1])
    if (e >= 1 && e <= 999) {
      return {
        episode: e,
        confidence: "low",
        cleanTitle,
      }
    }
  }

  // No match
  return {
    confidence: "low",
    cleanTitle,
  }
}
