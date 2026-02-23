const noiseTokens = [
  "bluray",
  "blu-ray",
  "webdl",
  "web-dl",
  "webrip",
  "remux",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "avc",
  "dts",
  "truehd",
  "ddp",
  "atmos",
  "hdr",
  "dv",
  "uhd",
  "amzn",
  "atvp",
  "max",
  "dsnp",
  "proper",
  "repack",
  "complete",
  "season",
  "seasons",
  "eng",
  "fre",
  "ger",
  "ita",
  "spa",
  "jpn",
]

const noisePattern = new RegExp(`\\b(${noiseTokens.join("|")})\\b`, "gi")

export function normalizeTitle(input: string): string {
  return input
    .replace(/[._:]/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(noisePattern, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase()
}

export function extractYear(input: string): number | null {
  const match = input.match(/\b(19\d{2}|20\d{2})\b/)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  if (!Number.isInteger(year)) {
    return null
  }
  return year
}

export function similarity(left: string, right: string): number {
  if (left === right) return 1
  if (!left || !right) return 0

  const leftParts = left.split(" ").filter(Boolean)
  const rightSet = new Set(right.split(" ").filter(Boolean))

  if (leftParts.length === 0 || rightSet.size === 0) {
    return 0
  }

  let matches = 0
  for (const part of leftParts) {
    if (rightSet.has(part)) {
      matches += 1
    }
  }

  return matches / Math.max(leftParts.length, rightSet.size)
}
