import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, mkdir, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { mkdtemp, rm } from "node:fs/promises"
import {
  buildDestinationPath,
  removeSymlinkIfExists,
  removeSymlinksForSource,
} from "../../src/modules/symlink/symlink-service"

describe("symlink service", () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  test("formats TV show folders with the TVDB series id", () => {
    const destinationPath = buildDestinationPath(
      "/library/source/The.Series.Title!.S01E01.mkv",
      "/organized",
      "TvShows",
      {
        title: "The Series Title!",
        year: 2010,
        imdbId: null,
        tvdbId: 1520211,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: "Pilot",
      },
    )

    expect(destinationPath).toBe(
      "/organized/The Series Title! (2010) [tvdbid-1520211]/Season 01/The Series Title! - S01E01 - Pilot.mkv",
    )
  })

  test("removes empty season and series directories after deleting the last symlink", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mediaflick-symlink-"))
    tempDirs.push(rootDir)

    const sourceFile = join(rootDir, "source.mkv")
    const seasonDir = join(rootDir, "Show (2010) [tvdbid-1520211]", "Season 01")
    const destinationFile = join(seasonDir, "Show - S01E01.mkv")

    await writeFile(sourceFile, "fixture")
    await mkdir(seasonDir, { recursive: true })
    await symlink(sourceFile, destinationFile)

    await removeSymlinkIfExists(destinationFile, rootDir)

    await expect(access(destinationFile)).rejects.toThrow()
    await expect(access(seasonDir)).rejects.toThrow()
    await expect(access(join(rootDir, "Show (2010) [tvdbid-1520211]"))).rejects.toThrow()
    const rootStat = await lstat(rootDir)
    expect(rootStat.isDirectory()).toBe(true)
  })

  test("keeps parent directories when other files remain in the season", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mediaflick-symlink-"))
    tempDirs.push(rootDir)

    const sourceFile = join(rootDir, "source.mkv")
    const seasonDir = join(rootDir, "Show (2010) [tvdbid-1520211]", "Season 01")
    const destinationFile = join(seasonDir, "Show - S01E01.mkv")
    const siblingFile = join(seasonDir, "Show - S01E02.mkv")

    await writeFile(sourceFile, "fixture")
    await mkdir(seasonDir, { recursive: true })
    await symlink(sourceFile, destinationFile)
    await symlink(sourceFile, siblingFile)

    await removeSymlinkIfExists(destinationFile, rootDir)

    await expect(access(destinationFile)).rejects.toThrow()
    const seasonStat = await lstat(seasonDir)
    expect(seasonStat.isDirectory()).toBe(true)
    const siblingStat = await lstat(siblingFile)
    expect(siblingStat.isSymbolicLink()).toBe(true)
  })

  test("removes stray symlinks for the same source in old locations", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mediaflick-symlink-"))
    tempDirs.push(rootDir)

    const sourceFile = join(rootDir, "source.mkv")
    const oldSeasonDir = join(rootDir, "Show (2010)", "Season 01")
    const newSeasonDir = join(rootDir, "Show (2010) [tvdbid-1520211]", "Season 01")
    const oldDestinationFile = join(oldSeasonDir, "Show - S01E01E21.mkv")
    const newDestinationFile = join(newSeasonDir, "Show - S01E01.mkv")

    await writeFile(sourceFile, "fixture")
    await mkdir(oldSeasonDir, { recursive: true })
    await mkdir(newSeasonDir, { recursive: true })
    await symlink(sourceFile, oldDestinationFile)
    await symlink(sourceFile, newDestinationFile)

    await removeSymlinksForSource(rootDir, sourceFile, newDestinationFile)

    await expect(access(oldDestinationFile)).rejects.toThrow()
    await expect(access(oldSeasonDir)).rejects.toThrow()
    const newStat = await lstat(newDestinationFile)
    expect(newStat.isSymbolicLink()).toBe(true)
  })
})
