import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, rm } from "node:fs/promises"
import { join } from "node:path"
import {
  createMovieTmdbStub,
  createPollerTestHarness,
  type PollerTestHarness,
} from "../helpers/poller-test-harness"

describe("FilePoller movie ingest integration", () => {
  let harness: PollerTestHarness | null = null

  afterEach(async () => {
    if (harness) {
      await harness.cleanup()
      harness = null
    }
  })

  test("scans a new movie into the organized library layout", async () => {
    harness = await createPollerTestHarness()
    const sourceFile = await harness.writeSourceMovie("Great.Movie.2024.1080p.mkv")

    await harness.runOnce()

    const scanned = await harness.context.scannedFilesRepo.findBySource(sourceFile)
    expect(scanned).not.toBeNull()
    expect(scanned?.status).toBe("Success")
    expect(scanned?.mediaType).toBe("Movies")
    expect(scanned?.tmdbId).toBe(101)
    expect(scanned?.imdbId).toBe("tt1234567")
    expect(scanned?.title).toBe("Great Movie")
    expect(scanned?.year).toBe(2024)
    expect(scanned?.genres).toEqual(["Action"])
    expect(scanned?.posterPath).toBe("/poster.jpg")

    const destinationPath = join(
      harness.destinationDir,
      "Great Movie (2024)",
      "Great Movie (2024) {imdb-tt1234567}.mkv",
    )
    expect(scanned?.destFile).toBe(destinationPath)

    const destinationStat = await lstat(destinationPath)
    expect(destinationStat.isSymbolicLink()).toBe(true)
    expect(await harness.readSymlinkTarget(destinationPath)).toBe(sourceFile)

    expect(harness.events.map(item => item.event)).toEqual([
      "zurg.version",
      "file.added",
      "file.updated",
    ])
  })

  test("does not create duplicate rows when the same source is seen on a later poll", async () => {
    harness = await createPollerTestHarness()
    const sourceFile = await harness.writeSourceMovie("Great.Movie.2024.mkv")

    await harness.runOnce()
    await harness.runOnce()

    const tracked = await harness.context.scannedFilesRepo.listBySourcePrefix(harness.sourceDir)
    expect(tracked).toHaveLength(1)
    expect(tracked[0]?.sourceFile).toBe(sourceFile)
    expect(tracked[0]?.status).toBe("Success")
    expect(harness.events.filter(item => item.event === "file.added")).toHaveLength(1)
    expect(harness.events.filter(item => item.event === "file.updated")).toHaveLength(1)
  })

  test("marks a second file as duplicate when it resolves to an existing destination path", async () => {
    harness = await createPollerTestHarness()
    const firstSource = await harness.writeSourceMovie("Great.Movie.2024.1080p.mkv")

    await harness.runOnce()

    const secondSource = await harness.writeSourceMovie("Great.Movie.2024.2160p.mkv")
    await harness.runOnce()

    const firstTracked = await harness.context.scannedFilesRepo.findBySource(firstSource)
    const secondTracked = await harness.context.scannedFilesRepo.findBySource(secondSource)

    expect(firstTracked?.status).toBe("Success")
    expect(secondTracked?.status).toBe("Duplicate")
    expect(secondTracked?.destFile).toBeNull()
    expect(firstTracked?.destFile).not.toBeNull()
    expect(await harness.readSymlinkTarget(firstTracked!.destFile!)).toBe(firstSource)
  })

  test("removes the tracked row and symlink when the source disappears", async () => {
    harness = await createPollerTestHarness()
    const sourceFile = await harness.writeSourceMovie("Great.Movie.2024.mkv")

    await harness.runOnce()

    const tracked = await harness.context.scannedFilesRepo.findBySource(sourceFile)
    const destinationPath = tracked?.destFile
    expect(destinationPath).not.toBeNull()

    await rm(sourceFile)
    await harness.runOnce()

    const afterDelete = await harness.context.scannedFilesRepo.findBySource(sourceFile)
    expect(afterDelete).toBeNull()
    await expect(access(destinationPath!)).rejects.toThrow()
    expect(harness.events.some(item => item.event === "file.removed")).toBe(true)
  })

  test("marks unmatched movies as failed without creating a symlink", async () => {
    harness = await createPollerTestHarness(createMovieTmdbStub({
      searchMovie: async () => [],
    }))
    const sourceFile = await harness.writeSourceMovie("Unknown.Movie.2024.mkv")

    await harness.runOnce()

    const tracked = await harness.context.scannedFilesRepo.findBySource(sourceFile)
    expect(tracked).not.toBeNull()
    expect(tracked?.status).toBe("Failed")
    expect(tracked?.destFile).toBeNull()
    expect(tracked?.tmdbId).toBeNull()
    expect(harness.events.filter(item => item.event === "file.updated")).toHaveLength(1)
  })
})
