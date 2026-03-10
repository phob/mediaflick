import { afterEach, describe, expect, test } from "bun:test"
import { JellyfinSyncCoordinator } from "@/modules/jellyfin/jellyfin-sync-coordinator"
import { JellyfinSyncRepo } from "@/modules/jellyfin/jellyfin-sync-repo"
import { createTestDb, type TestDbHandle } from "../helpers/test-db"

function createLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
}

describe("JellyfinSyncCoordinator", () => {
  let handle: TestDbHandle | null = null

  afterEach(async () => {
    if (handle) {
      await handle.cleanup()
      handle = null
    }
  })

  test("prefers the provider-id match that lives under the configured destination root", async () => {
    handle = await createTestDb("jellyfin-sync-coordinator")

    const coordinator = new JellyfinSyncCoordinator({
      configStore: {
        get: async () => ({
          plex: {
            host: "localhost",
            port: 32400,
            plexToken: "",
            pollingInterval: 60,
            processNewFolderDelay: 30,
            folderMappings: [{
              sourceFolder: "/mnt/zurg/shows",
              destinationFolder: "/mnt/organized2/tvseries",
              mediaType: "TvShows",
            }],
          },
          jellyfin: {
            enabled: true,
            baseUrl: "http://jellyfin.local",
            apiKey: "token",
            requestTimeoutMs: 5000,
          },
          tmDb: {
            apiKey: "tmdb",
          },
          mediaDetection: {
            cacheDuration: 3600,
            autoExtrasThresholdBytes: 104857600,
          },
          zurg: {
            versionLocation: "/mnt/zurg/version.txt",
          },
        }),
      },
      jellyfin: {
        isEnabled: () => true,
        getMediaFolders: async () => [],
        findItems: async () => [
          {
            id: "old-library",
            name: "Better Call Saul",
            path: "/mnt/organized/tvseries/Better Call Saul (2015)",
            providerIds: {
              imdb: "tt3032476",
              tmdb: "60059",
              tvdb: "273181",
            },
          },
          {
            id: "current-library",
            name: "Better Call Saul",
            path: "/mnt/organized2/tvseries/Better Call Saul (2015)",
            providerIds: {
              imdb: "tt3032476",
              tmdb: "60059",
              tvdb: "273181",
            },
          },
        ],
        getSeriesEpisodes: async () => [{
          id: "episode-1",
          name: "Uno",
          path: "/mnt/organized2/tvseries/Better Call Saul (2015) [tvdbid-273181]/Season 01/Better Call Saul - S01E01 - Uno.mkv",
          providerIds: {},
          seasonNumber: 1,
          episodeNumber: 1,
        }],
        foldersForDestination: () => [],
      },
      logger: createLogger(),
      scannedFilesRepo: {
        listByTmdbId: async () => [{
          id: 1,
          sourceFile: "/mnt/zurg/shows/Better.Call.Saul.S01E01.mkv",
          destFile: "/mnt/organized2/tvseries/Better Call Saul (2015) [tvdbid-273181]/Season 01/Better Call Saul - S01E01 - Uno.mkv",
          fileSize: null,
          fileHash: null,
          mediaType: "TvShows",
          tmdbId: 60059,
          tvdbId: 273181,
          imdbId: "tt3032476",
          title: "Better Call Saul",
          year: 2015,
          genres: null,
          seasonNumber: 1,
          episodeNumber: 1,
          episodeNumber2: null,
          posterPath: null,
          status: "Success",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: null,
          versionUpdated: 1,
          updateToVersion: 1,
        }],
      },
      jellyfinSyncRepo: new JellyfinSyncRepo(handle.db),
    } as ConstructorParameters<typeof JellyfinSyncCoordinator>[0])

    const record = await coordinator.refreshForDetail({
      mediaType: "TvShows",
      tmdbId: 60059,
      tvdbId: 273181,
      imdbId: "tt3032476",
      title: "Better Call Saul",
      force: true,
    })

    expect(record?.state).toBe("outOfSync")
    expect(record?.matchedBy).toBe("providerId")
    expect(record?.jellyfinItemId).toBe("current-library")
    expect(record?.jellyfinPath).toBe("/mnt/organized2/tvseries/Better Call Saul (2015)")
  })
})
