import { mkdir, readlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { AppContext } from "../../src/app/context"
import type { RuntimeConfig } from "../../src/config/runtime-config"
import { FilePoller } from "../../src/modules/file-ingest/file-poller"
import type { JellyfinFolder, JellyfinItem } from "../../src/modules/jellyfin/jellyfin-client"
import { JellyfinSyncCoordinator } from "../../src/modules/jellyfin/jellyfin-sync-coordinator"
import { JellyfinSyncRepo } from "../../src/modules/jellyfin/jellyfin-sync-repo"
import type {
  RealtimeEvent,
  WsHub,
} from "../../src/modules/realtime/ws-hub"
import type {
  TmdbClient,
  TmdbMovieDetails,
  TmdbMovieExternalIds,
  TmdbMovieResult,
} from "../../src/modules/media-lookup/tmdb-client"
import type { TvdbClient } from "../../src/modules/media-lookup/tvdb-client"
import { ScannedFilesRepo } from "../../src/modules/scanned-files/scanned-files-repo"
import type { Logger } from "../../src/shared/logger"
import { createTestDb, type TestDbHandle } from "./test-db"

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export interface BroadcastEvent {
  event: RealtimeEvent
  payload: unknown
}

export interface PollerTestHarness {
  handle: TestDbHandle
  context: AppContext
  config: RuntimeConfig
  events: BroadcastEvent[]
  sourceDir: string
  destinationDir: string
  versionPath: string
  jellyfinCalls: Array<{ method: string; payload?: unknown }>
  runOnce: () => Promise<void>
  writeSourceMovie: (name: string, contents?: string) => Promise<string>
  readSymlinkTarget: (path: string) => Promise<string>
  cleanup: () => Promise<void>
}

interface MovieStubOptions {
  result?: TmdbMovieResult
  details?: TmdbMovieDetails
  externalIds?: TmdbMovieExternalIds
  searchMovie?: (title: string) => Promise<TmdbMovieResult[]>
}

interface JellyfinStubOptions {
  enabled?: boolean
  mediaFolders?: JellyfinFolder[]
  itemsByType?: Partial<Record<"Movie" | "Series", JellyfinItem[]>>
  seriesEpisodesBySeason?: Record<number, JellyfinItem[]>
}

function createRuntimeConfig(
  sourceFolder: string,
  destinationFolder: string,
  versionLocation: string,
): RuntimeConfig {
  return {
    plex: {
      host: "localhost",
      port: 32400,
      plexToken: "",
      pollingInterval: 60,
      processNewFolderDelay: 0,
      folderMappings: [
        {
          sourceFolder,
          destinationFolder,
          mediaType: "Movies",
        },
      ],
    },
    jellyfin: {
      enabled: true,
      baseUrl: "http://jellyfin.test",
      apiKey: "test-jellyfin-key",
      requestTimeoutMs: 5000,
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

export function createMovieTmdbStub(options: MovieStubOptions = {}): TmdbClient {
  const movieResult: TmdbMovieResult = options.result ?? {
    id: 101,
    title: "Great Movie",
    release_date: "2024-01-01",
    popularity: 90,
  }

  const movieDetails: TmdbMovieDetails = options.details ?? {
    ...movieResult,
    genres: [{ id: 1, name: "Action" }],
    poster_path: "/poster.jpg",
  }

  const externalIds: TmdbMovieExternalIds = options.externalIds ?? {
    imdb_id: "tt1234567",
  }

  return {
    searchMovie: options.searchMovie ?? (async title => (
      title.includes(movieResult.title) ? [movieResult] : []
    )),
    searchTv: async () => [],
    getMovie: async tmdbId => {
      if (tmdbId !== movieResult.id) {
        throw new Error(`unexpected tmdb id: ${tmdbId}`)
      }
      return movieDetails
    },
    getMovieExternalIds: async () => externalIds,
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

function createTvdbStub(): TvdbClient {
  return {
    searchSeries: async () => [],
    getSeriesExtended: async () => ({
      id: 0,
      name: "",
      overview: null,
      image: null,
      firstAired: null,
      year: null,
      seasons: [],
    }),
    getSeriesEpisodes: async () => [],
    seriesImage: () => null,
    episodeImage: () => null,
  } as unknown as TvdbClient
}

function createJellyfinStub(
  calls: Array<{ method: string; payload?: unknown }>,
  options: JellyfinStubOptions = {},
) {
  const mediaFolders = options.mediaFolders ?? [
    {
      id: "movies-folder",
      name: "Movies",
      path: "/organized",
      collectionType: "movies",
    },
  ]

  return {
    isEnabled: () => options.enabled ?? true,
    getMediaFolders: async () => {
      calls.push({ method: "getMediaFolders" })
      return mediaFolders
    },
    reportMovieAdded: async (payload: unknown) => {
      calls.push({ method: "reportMovieAdded", payload })
    },
    reportMovieUpdated: async (payload: unknown) => {
      calls.push({ method: "reportMovieUpdated", payload })
    },
    reportSeriesAdded: async (payload: unknown) => {
      calls.push({ method: "reportSeriesAdded", payload })
    },
    reportSeriesUpdated: async (payload: unknown) => {
      calls.push({ method: "reportSeriesUpdated", payload })
    },
    reportMediaUpdated: async (payload: unknown) => {
      calls.push({ method: "reportMediaUpdated", payload })
    },
    refreshItem: async (payload: unknown) => {
      calls.push({ method: "refreshItem", payload })
    },
    findItems: async (input: { includeItemTypes: "Movie" | "Series" }) => {
      calls.push({ method: "findItems", payload: input })
      return options.itemsByType?.[input.includeItemTypes] ?? []
    },
    getSeriesEpisodes: async (_seriesId: string, seasonNumber: number) => {
      calls.push({ method: "getSeriesEpisodes", payload: seasonNumber })
      return (options.seriesEpisodesBySeason?.[seasonNumber] ?? []).map(item => ({
        ...item,
        seasonNumber,
        episodeNumber: null,
      }))
    },
    foldersForDestination: (folders: JellyfinFolder[]) => folders,
  }
}

function createWsHub(events: BroadcastEvent[]): WsHub {
  return {
    tryUpgrade: () => false,
    websocket: {
      open: () => {},
      close: () => {},
      message: () => {},
      drain: () => {},
    },
    broadcast: (event, payload) => {
      events.push({ event, payload })
    },
  }
}

export async function createPollerTestHarness(
  tmdb: TmdbClient = createMovieTmdbStub(),
  jellyfinOptions: JellyfinStubOptions = {},
): Promise<PollerTestHarness> {
  const handle = await createTestDb("poller")
  const sourceDir = join(handle.rootDir, "source")
  const destinationDir = join(handle.rootDir, "destination")
  const versionPath = join(handle.rootDir, "zurg.version")
  const events: BroadcastEvent[] = []
  const jellyfinCalls: Array<{ method: string; payload?: unknown }> = []

  await mkdir(sourceDir, { recursive: true })
  await mkdir(destinationDir, { recursive: true })
  await writeFile(versionPath, "ready")

  const config = createRuntimeConfig(sourceDir, destinationDir, versionPath)

  const context: AppContext = {
    env: {
      rootDir: handle.rootDir,
      configPath: join(handle.rootDir, "config.yml"),
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
    wsHub: createWsHub(events),
    scannedFilesRepo: new ScannedFilesRepo(handle.db),
    jellyfin: createJellyfinStub(jellyfinCalls, jellyfinOptions) as AppContext["jellyfin"],
    jellyfinFactory: () => createJellyfinStub(jellyfinCalls, jellyfinOptions) as AppContext["jellyfin"],
    jellyfinSyncRepo: new JellyfinSyncRepo(handle.db),
    jellyfinSyncCoordinator: null as never,
    tmdb,
    tmdbFactory: () => tmdb,
    tvdb: createTvdbStub(),
    tvdbFactory: () => createTvdbStub(),
    poller: null as never,
  }

  context.jellyfinSyncCoordinator = new JellyfinSyncCoordinator(context)

  const poller = new FilePoller(context)
  context.poller = poller

  return {
    handle,
    context,
    config,
    events,
    sourceDir,
    destinationDir,
    versionPath,
    jellyfinCalls,
    runOnce: async () => {
      poller.start(config)
      await poller.stop()
    },
    writeSourceMovie: async (name: string, contents = "fixture-video") => {
      const sourceFile = join(sourceDir, name)
      await writeFile(sourceFile, contents)
      return sourceFile
    },
    readSymlinkTarget: async path => readlink(path),
    cleanup: async () => {
      await poller.stop()
      await handle.cleanup()
    },
  }
}
