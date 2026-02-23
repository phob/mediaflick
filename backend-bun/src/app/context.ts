import type { ConfigStore } from "@/config/config-store"
import type { AppEnv } from "@/config/env"
import type { AppDb } from "@/db/client"
import type { FilePoller } from "@/modules/file-ingest/file-poller"
import type { TmdbClient } from "@/modules/media-lookup/tmdb-client"
import type { WsHub } from "@/modules/realtime/ws-hub"
import type { ScannedFilesRepo } from "@/modules/scanned-files/scanned-files-repo"
import type { Logger } from "@/shared/logger"

export interface AppContext {
  env: AppEnv
  logger: Logger
  db: AppDb
  configStore: ConfigStore
  wsHub: WsHub
  scannedFilesRepo: ScannedFilesRepo
  tmdb: TmdbClient
  tmdbFactory: (apiKey: string) => TmdbClient
  poller: FilePoller
}
