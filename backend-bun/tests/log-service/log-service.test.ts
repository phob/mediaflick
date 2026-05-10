import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, test } from "bun:test"
import { getLogs } from "../../src/modules/logs/log-service"

let tempDir: string | null = null

async function createTempDir() {
  tempDir = await mkdtemp(join(tmpdir(), "mediaflick-logs-"))
  return tempDir
}

async function writeLogFile(directory: string, fileName: string, entries: unknown[]) {
  await writeFile(
    join(directory, fileName),
    entries.map(entry => JSON.stringify(entry)).join("\n") + "\n",
    "utf8",
  )
}

afterEach(async () => {
  if (!tempDir) return
  await rm(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe("getLogs", () => {
  test("returns the latest entries by timestamp across all log files", async () => {
    const directory = await createTempDir()

    await writeLogFile(directory, "log-2026-05-10.json", [
      { Timestamp: "2026-05-10T08:00:00.000Z", Level: "Information", RenderedMessage: "current latest" },
    ])
    await writeLogFile(directory, "log20260223.json", [
      { Timestamp: "2026-02-23T08:00:00.000Z", Level: "Information", RenderedMessage: "old" },
    ])

    const logs = await getLogs(directory, {
      minLevel: null,
      searchTerm: null,
      from: null,
      to: null,
      limit: 2,
    }) as Array<{ RenderedMessage?: string }>

    expect(logs.map(log => log.RenderedMessage)).toEqual(["current latest", "old"])
  })
})
