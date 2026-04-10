import type { ConfigStore } from "@/config/config-store"
import type { AppEnv } from "@/config/env"
import type { AppDb } from "@/db/client"
import type { FilePoller } from "@/modules/file-ingest/file-poller"
import type { JellyfinClient } from "@/modules/jellyfin/jellyfin-client"
import type { JellyfinSyncCoordinator } from "@/modules/jellyfin/jellyfin-sync-coordinator"
import type { JellyfinSyncRepo } from "@/modules/jellyfin/jellyfin-sync-repo"
import type { TmdbClient } from "@/modules/media-lookup/tmdb-client"
import type { TvdbClient } from "@/modules/media-lookup/tvdb-client"
import type { WsHub } from "@/modules/realtime/ws-hub"
import type { ScannedFilesRepo } from "@/modules/scanned-files/scanned-files-repo"
import type { BuildInfo } from "@/shared/build-info"
import type { Logger } from "@/shared/logger"

export interface AppContext {
  env: AppEnv
  buildInfo: BuildInfo
  logger: Logger
  db: AppDb
  configStore: ConfigStore
  wsHub: WsHub
  scannedFilesRepo: ScannedFilesRepo
  jellyfin: JellyfinClient
  jellyfinFactory: (config: Awaited<ReturnType<ConfigStore["get"]>>["jellyfin"]) => JellyfinClient
  jellyfinSyncRepo: JellyfinSyncRepo
  jellyfinSyncCoordinator: JellyfinSyncCoordinator
  tmdb: TmdbClient
  tmdbFactory: (apiKey: string) => TmdbClient
  tvdb: TvdbClient
  tvdbFactory: () => TvdbClient
  poller: FilePoller
}
