import { afterEach, describe, expect, test } from "bun:test"
import { scannedFiles } from "@/db/schema"
import { ScannedFilesRepo } from "@/modules/scanned-files/scanned-files-repo"
import { createTestDb, type TestDbHandle } from "../helpers/test-db"

describe("ScannedFilesRepo.listForTmdbTitles", () => {
  let handle: TestDbHandle | null = null

  afterEach(async () => {
    await handle?.cleanup()
    handle = null
  })

  test("sorts titles while ignoring leading articles", async () => {
    handle = await createTestDb("scanned-files-repo")
    const repo = new ScannedFilesRepo(handle.db)

    await handle.db.insert(scannedFiles).values([
      {
        sourceFile: "/library/tv/the-matrix.mkv",
        mediaType: "Movies",
        tmdbId: 1,
        title: "The Matrix",
        status: "Success",
        createdAt: "2026-03-07T10:00:00.000Z",
        updatedAt: "2026-03-07T10:00:00.000Z",
      },
      {
        sourceFile: "/library/tv/batman-begins.mkv",
        mediaType: "Movies",
        tmdbId: 2,
        title: "Batman Begins",
        status: "Success",
        createdAt: "2026-03-07T10:00:01.000Z",
        updatedAt: "2026-03-07T10:00:01.000Z",
      },
      {
        sourceFile: "/library/tv/an-education.mkv",
        mediaType: "Movies",
        tmdbId: 3,
        title: "An Education",
        status: "Success",
        createdAt: "2026-03-07T10:00:02.000Z",
        updatedAt: "2026-03-07T10:00:02.000Z",
      },
      {
        sourceFile: "/library/tv/a-beautiful-mind.mkv",
        mediaType: "Movies",
        tmdbId: 4,
        title: "A Beautiful Mind",
        status: "Success",
        createdAt: "2026-03-07T10:00:03.000Z",
        updatedAt: "2026-03-07T10:00:03.000Z",
      },
    ])

    const titles = await repo.listForTmdbTitles("Movies")

    expect(titles.map(item => item.title)).toEqual([
      "Batman Begins",
      "A Beautiful Mind",
      "An Education",
      "The Matrix",
    ])
  })
})

describe("ScannedFilesRepo.dashboardSummary", () => {
  let handle: TestDbHandle | null = null

  afterEach(async () => {
    await handle?.cleanup()
    handle = null
  })

  test("aggregates catalog metrics and returns newest successful media rows", async () => {
    handle = await createTestDb("scanned-files-dashboard")
    const repo = new ScannedFilesRepo(handle.db)
    const now = Date.now()

    await handle.db.insert(scannedFiles).values([
      {
        sourceFile: "/library/movies/dune-part-two.mkv",
        destFile: "/organized/movies/Dune Part Two (2024)/Dune Part Two (2024).mkv",
        fileSize: 8_000_000_000,
        mediaType: "Movies",
        tmdbId: 100,
        title: "Dune Part Two",
        year: 2024,
        posterPath: "/dune.jpg",
        status: "Success",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        sourceFile: "/library/tv/andor/andor.s02e01.mkv",
        destFile: "/organized/tv/Andor (2022)/Season 02/Andor S02E01.mkv",
        fileSize: 2_000_000_000,
        mediaType: "TvShows",
        tmdbId: 200,
        title: "Andor",
        year: 2022,
        posterPath: "/andor.jpg",
        seasonNumber: 2,
        episodeNumber: 1,
        status: "Success",
        createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        sourceFile: "/library/tv/andor/andor.s02e02.mkv",
        destFile: "/organized/tv/Andor (2022)/Season 02/Andor S02E02.mkv",
        fileSize: 2_100_000_000,
        mediaType: "TvShows",
        tmdbId: 200,
        title: "Andor",
        year: 2022,
        posterPath: "/andor.jpg",
        seasonNumber: 2,
        episodeNumber: 2,
        status: "Success",
        createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        sourceFile: "/library/extras/bonus-feature.mp4",
        fileSize: 400_000_000,
        mediaType: "Extras",
        status: "Success",
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        sourceFile: "/library/unidentified/mystery-file.mkv",
        fileSize: 700_000_000,
        mediaType: "Unknown",
        status: "Failed",
        createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        sourceFile: "/library/duplicates/andor-copy.mkv",
        fileSize: 2_100_000_000,
        mediaType: "TvShows",
        tmdbId: 200,
        title: "Andor",
        year: 2022,
        status: "Duplicate",
        createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      },
    ])

    const dashboard = await repo.dashboardSummary(2)

    expect(dashboard.totalFiles).toBe(6)
    expect(dashboard.totalSuccessfulFiles).toBe(4)
    expect(dashboard.distinctMovies).toBe(1)
    expect(dashboard.distinctTvShows).toBe(1)
    expect(dashboard.addedLast7Days).toBe(4)
    expect(dashboard.addedLast30Days).toBe(5)
    expect(dashboard.attentionCount).toBe(2)
    expect(dashboard.lastIngestedAt).toBeTruthy()
    expect(dashboard.lastLibraryItemAt).toBeTruthy()
    expect(dashboard.recentItems).toHaveLength(2)
    expect(dashboard.recentItems.map(item => item.episodeNumber)).toEqual([2, 1])

    expect(dashboard.byStatus).toEqual(
      expect.arrayContaining([
        { status: "Success", count: 4 },
        { status: "Duplicate", count: 1 },
        { status: "Failed", count: 1 },
      ]),
    )

    expect(dashboard.byMediaType).toEqual(
      expect.arrayContaining([
        { mediaType: "Movies", count: 1 },
        { mediaType: "TvShows", count: 3 },
        { mediaType: "Extras", count: 1 },
        { mediaType: "Unknown", count: 1 },
      ]),
    )

    expect(dashboard.storageByMediaType).toEqual(
      expect.arrayContaining([
        { mediaType: "Movies", count: 1, totalFileSize: 8_000_000_000 },
        { mediaType: "TvShows", count: 3, totalFileSize: 6_200_000_000 },
      ]),
    )
  })
})
