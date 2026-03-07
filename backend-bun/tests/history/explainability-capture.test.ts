import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import type { AppContext } from "../../src/app/context"
import { scanHistoryItems, scanRuns } from "../../src/db/schema"
import { FilePoller } from "../../src/modules/file-ingest/file-poller"
import { HistoryRepo } from "../../src/modules/history/history-repo"
import { ScannedFilesRepo } from "../../src/modules/scanned-files/scanned-files-repo"
import type { RuntimeConfig } from "../../src/config/runtime-config"
import type { Logger } from "../../src/shared/logger"
import type { TmdbClient, TmdbMovieDetails, TmdbMovieResult } from "../../src/modules/media-lookup/tmdb-client"
import { createTestDb, type TestDbHandle } from "../helpers/test-db"

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function createRuntimeConfig(sourceFolder: string, destinationFolder: string, versionLocation: string): RuntimeConfig {
  return {
    plex: {
      host: "localhost",
      port: 32400,
      plexToken: "",
      pollingInterval: 60,
      processNewFolderDelay: 0,
      folderMappings: [{
        sourceFolder,
        destinationFolder,
        mediaType: "Movies",
      }],
    },
    tmDb: {
      apiKey: "test-key",
    },
    mediaDetection: {
      cacheDuration: 60,
      autoExtrasThresholdBytes: 100,
    },
    zurg: {
      versionLocation,
    },
  }
}

function createTmdbStub(): TmdbClient {
  const movieResult: TmdbMovieResult = {
    id: 101,
    title: "Great Movie",
    release_date: "2024-01-01",
    popularity: 90,
  }

  const movieDetails: TmdbMovieDetails = {
    ...movieResult,
    genres: [{ id: 1, name: "Action" }],
  }

  return {
    searchMovie: async title => title.includes("Great Movie") ? [movieResult] : [],
    searchTv: async () => [],
    getMovie: async tmdbId => {
      if (tmdbId !== 101) {
        throw new Error("unexpected tmdb id")
      }
      return movieDetails
    },
    getMovieExternalIds: async () => ({ imdb_id: "tt1234567" }),
    getMovieCredits: async () => [],
    getTv: async () => {
      throw new Error("tv lookup not expected")
    },
    getTvExternalIds: async () => ({ imdb_id: null }),
    getTvCredits: async () => [],
    getTvSeason: async () => {
      throw new Error("tv season lookup not expected")
    },
    getTvEpisode: async () => {
      throw new Error("tv episode lookup not expected")
    },
    getTvEpisodeGroups: async () => [],
    getTvEpisodeGroup: async () => ({
      id: "",
      name: "",
      description: null,
      group_count: 0,
      episode_count: 0,
      groups: [],
    }),
    movieYear: movie => (movie.release_date ? Number(movie.release_date.slice(0, 4)) : null),
    tvYear: () => null,
    invalidateAll: () => {},
    getImageUrl: () => "",
  } as unknown as TmdbClient
}

describe("poller explainability capture", () => {
  let handle: TestDbHandle
  let context: AppContext

  beforeEach(async () => {
    handle = await createTestDb("explainability-capture")
    const source = join(handle.rootDir, "source")
    const destination = join(handle.rootDir, "destination")
    const versionLocation = join(handle.rootDir, "zurg.version")
    await mkdir(source, { recursive: true })
    await mkdir(destination, { recursive: true })
    await writeFile(versionLocation, "ready")

    const config = createRuntimeConfig(source, destination, versionLocation)
    const tmdb = createTmdbStub()

    context = {
      env: {
        rootDir: handle.rootDir,
        configPath: join(handle.rootDir, "config.yaml"),
        databasePath: handle.dbPath,
        logsDir: join(handle.rootDir, "logs"),
        port: 0,
      },
      logger,
      db: handle.db,
      configStore: {
        init: async () => {},
        get: async () => config,
        update: async next => next,
      } as AppContext["configStore"],
      wsHub: {
        tryUpgrade: () => false,
        websocket: {
          open: () => {},
          close: () => {},
          message: () => {},
        },
        broadcast: () => {},
      },
      scannedFilesRepo: new ScannedFilesRepo(handle.db),
      historyRepo: new HistoryRepo(handle.db),
      tmdb,
      tmdbFactory: () => tmdb,
      poller: null as never,
    }
  })

  afterEach(async () => {
    await handle.cleanup()
  })

  test("captures explainability for successful and unresolved movie attempts", async () => {
    const sourceFolder = (await context.configStore.get()).plex.folderMappings[0]!.sourceFolder
    await writeFile(join(sourceFolder, "Great.Movie.2024.mkv"), "ok")
    await writeFile(join(sourceFolder, "Missing.Match.2025.mkv"), "missing")

    const poller = new FilePoller(context)
    context.poller = poller

    await (poller as unknown as { runInternal: () => Promise<void> }).runInternal()

    const runRows = await handle.db
      .select()
      .from(scanRuns)
      .where(eq(scanRuns.trigger, "poller"))
    expect(runRows.length).toBe(1)

    const attempts = await handle.db
      .select()
      .from(scanHistoryItems)
      .where(eq(scanHistoryItems.runId, runRows[0]!.id))
    expect(attempts.length).toBe(2)

    const matched = attempts.find(row => row.status === "Success")
    const unresolved = attempts.find(row => row.status === "Failed")
    expect(matched).toBeDefined()
    expect(unresolved).toBeDefined()

    const matchedExplainability = matched!.explainability as {
      identification: { providerResultTitle: string | null }
      matchAttempts: Array<{ outcome: string }>
      unresolvedCause: { code: string; message: string } | null
    }
    expect(matchedExplainability.identification.providerResultTitle).toBe("Great Movie")
    expect(matchedExplainability.matchAttempts[0]?.outcome).toBe("match")
    expect(matchedExplainability.unresolvedCause).toBeNull()

    const unresolvedExplainability = unresolved!.explainability as {
      matchAttempts: Array<{ outcome: string; causeCode: string | null }>
      unresolvedCause: { code: string; message: string } | null
    }
    expect(unresolvedExplainability.matchAttempts[0]?.outcome).toBe("no-match")
    expect(unresolvedExplainability.matchAttempts[0]?.causeCode).toBe("movie-tmdb-search-no-match")
    expect(unresolvedExplainability.unresolvedCause?.code).toBe("movie-tmdb-search-no-match")
    expect(unresolvedExplainability.unresolvedCause?.message).toContain("TMDb search")
  })
})
