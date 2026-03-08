import { z } from "zod"
import { mediaTypes, type ConfigurationPayload } from "@/shared/types"

const mediaTypeSchema = z.enum(mediaTypes)

const folderMappingSchema = z.object({
  sourceFolder: z.string().min(1),
  destinationFolder: z.string().min(1),
  mediaType: mediaTypeSchema,
})

export const configSchema = z.object({
  plex: z.object({
    host: z.string().min(1),
    port: z.number().int().positive(),
    plexToken: z.string(),
    pollingInterval: z.number().int().positive(),
    processNewFolderDelay: z.number().int().nonnegative(),
    folderMappings: z.array(folderMappingSchema).min(1),
  }),
  tmDb: z.object({
    apiKey: z.string().min(1),
  }),
  mediaDetection: z.object({
    cacheDuration: z.number().int().positive(),
    autoExtrasThresholdBytes: z.number().int().nonnegative().max(1_073_741_824),
  }),
  zurg: z.object({
    versionLocation: z.string().min(1),
  }),
})

export const defaultConfig: ConfigurationPayload = {
  plex: {
    host: "localhost",
    port: 32400,
    plexToken: "",
    pollingInterval: 60,
    processNewFolderDelay: 30,
    folderMappings: [
      {
        sourceFolder: "/mnt/zurg/movies",
        destinationFolder: "/mnt/organized/movies",
        mediaType: "Movies",
      },
      {
        sourceFolder: "/mnt/zurg/tvseries",
        destinationFolder: "/mnt/organized/tvseries",
        mediaType: "TvShows",
      },
    ],
  },
  tmDb: {
    apiKey: "your-tmdb-api-key",
  },
  mediaDetection: {
    cacheDuration: 3600,
    autoExtrasThresholdBytes: 104_857_600,
  },
  zurg: {
    versionLocation: "/mnt/zurg/version.txt",
  },
}

export type RuntimeConfig = z.infer<typeof configSchema>
