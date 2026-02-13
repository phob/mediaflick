import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

interface LogEntry {
  Timestamp?: string
  Level?: string
  RenderedMessage?: string
}

const levelOrder = ["Verbose", "Debug", "Information", "Warning", "Error", "Fatal"]

function levelPasses(level: string | undefined, minLevel: string | null): boolean {
  if (!minLevel) return true
  const entryLevel = levelOrder.indexOf(level ?? "Information")
  const minIdx = levelOrder.indexOf(minLevel)
  if (minIdx === -1) return true
  return entryLevel >= minIdx
}

export async function getLogs(logDirectory: string, params: {
  minLevel: string | null
  searchTerm: string | null
  from: Date | null
  to: Date | null
  limit: number
}): Promise<unknown[]> {
  const entries: unknown[] = []

  let files: string[] = []
  try {
    files = await readdir(logDirectory)
  } catch {
    return entries
  }

  const logFiles = files
    .filter(name => name.startsWith("log") && name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a))

  for (const fileName of logFiles) {
    if (entries.length >= params.limit) break

    const filePath = join(logDirectory, fileName)
    const content = await readFile(filePath, "utf8")
    const lines = content.split("\n").filter(Boolean).reverse()

    for (const line of lines) {
      if (entries.length >= params.limit) break

      let parsed: LogEntry
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }

      if (!levelPasses(parsed.Level, params.minLevel)) {
        continue
      }

      if (
        params.searchTerm
        && !(parsed.RenderedMessage ?? "").toLowerCase().includes(params.searchTerm.toLowerCase())
      ) {
        continue
      }

      if (params.from || params.to) {
        if (!parsed.Timestamp) continue
        const ts = new Date(parsed.Timestamp)
        if (Number.isNaN(ts.getTime())) continue
        if (params.from && ts < params.from) continue
        if (params.to && ts > params.to) continue
      }

      entries.push(parsed)
    }
  }

  return entries
}
