import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import YAML from "yaml"
import { configSchema, defaultConfig, type RuntimeConfig } from "@/config/runtime-config"
import type { ConfigurationPayload } from "@/shared/types"

function mergeConfigWithDefaults(raw: unknown): ConfigurationPayload {
  const parsed = raw && typeof raw === "object" ? raw as Partial<ConfigurationPayload> : {}

  return {
    ...defaultConfig,
    ...parsed,
    plex: {
      ...defaultConfig.plex,
      ...(parsed.plex ?? {}),
      folderMappings: parsed.plex?.folderMappings ?? defaultConfig.plex.folderMappings,
    },
    jellyfin: {
      ...defaultConfig.jellyfin,
      ...(parsed.jellyfin ?? {}),
    },
    tmDb: {
      ...defaultConfig.tmDb,
      ...(parsed.tmDb ?? {}),
    },
    mediaDetection: {
      ...defaultConfig.mediaDetection,
      ...(parsed.mediaDetection ?? {}),
    },
    zurg: {
      ...defaultConfig.zurg,
      ...(parsed.zurg ?? {}),
    },
  }
}

export async function ensureConfigFile(configPath: string): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true })

  try {
    await readFile(configPath, "utf8")
  } catch {
    const content = YAML.stringify(defaultConfig)
    await writeFile(configPath, content, "utf8")
  }
}

export async function loadConfig(configPath: string): Promise<RuntimeConfig> {
  await ensureConfigFile(configPath)
  const raw = await readFile(configPath, "utf8")
  const parsed = YAML.parse(raw)
  return configSchema.parse(mergeConfigWithDefaults(parsed))
}

export async function saveConfig(configPath: string, config: RuntimeConfig): Promise<void> {
  const valid = configSchema.parse(config)
  const content = YAML.stringify(valid)
  await writeFile(configPath, content, "utf8")
}
