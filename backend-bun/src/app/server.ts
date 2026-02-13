import { createRouter } from "@/app/router"
import type { AppContext } from "@/app/context"
import { ConfigStore } from "@/config/config-store"
import { loadEnv } from "@/config/env"
import { createDb } from "@/db/client"
import { FilePoller } from "@/modules/file-ingest/file-poller"
import { startRuntimeJobs } from "@/modules/file-ingest/runtime-jobs"
import { TmdbClient } from "@/modules/media-lookup/tmdb-client"
import { createWsHub } from "@/modules/realtime/ws-hub"
import { ScannedFilesRepo } from "@/modules/scanned-files/scanned-files-repo"
import { createLogger } from "@/shared/logger"

const env = loadEnv()
const logger = createLogger(env.logsDir)

const configStore = new ConfigStore(env.configPath)
await configStore.init()
const initialConfig = await configStore.get()

const db = await createDb(env.databasePath)
const wsHub = createWsHub(logger)
const scannedFilesRepo = new ScannedFilesRepo(db)
const tmdbFactory = (apiKey: string) => new TmdbClient(apiKey)

const context: AppContext = {
  env,
  logger,
  db,
  configStore,
  wsHub,
  scannedFilesRepo,
  tmdb: tmdbFactory(initialConfig.tmDb.apiKey),
  tmdbFactory,
  poller: null as unknown as FilePoller,
}

const poller = new FilePoller(context)
context.poller = poller

poller.start(initialConfig)
const stopRuntimeJobs = startRuntimeJobs(configStore, wsHub)

const app = createRouter(context)

const server = Bun.serve({
  port: env.port,
  fetch(request, bunServer) {
    if (wsHub.tryUpgrade(request, bunServer)) {
      return undefined
    }
    return app.fetch(request)
  },
  websocket: wsHub.websocket,
})

logger.info("Bun backend started", {
  port: env.port,
  rootDir: env.rootDir,
  configPath: env.configPath,
  dbPath: env.databasePath,
})

// Backfill posterPath for existing rows that have a tmdbId but no poster yet
;(async () => {
  try {
    const missing = await scannedFilesRepo.listMissingPosters()
    if (missing.length === 0) return
    logger.info(`Backfilling poster paths for ${missing.length} titles`)

    let filled = 0
    for (const { tmdbId, mediaType } of missing) {
      try {
        const posterPath = mediaType === "Movies"
          ? (await context.tmdb.getMovie(tmdbId)).poster_path
          : (await context.tmdb.getTv(tmdbId)).poster_path
        if (posterPath) {
          await scannedFilesRepo.setPosterByTmdbId(tmdbId, posterPath)
          filled++
        }
      } catch {
        // Skip individual failures silently — TMDb rate limits or missing entries
      }
    }

    logger.info(`Poster backfill complete: ${filled}/${missing.length} updated`)
  } catch (err) {
    logger.error("Poster backfill failed", { error: err })
  }
})()

function shutdown() {
  poller.stop()
  stopRuntimeJobs()
  server.stop(true)
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
