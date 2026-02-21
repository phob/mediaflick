import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import YAML from "yaml"
import { configSchema, defaultConfig, type RuntimeConfig } from "@/config/runtime-config"

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
  return configSchema.parse(parsed)
}

export async function saveConfig(configPath: string, config: RuntimeConfig): Promise<void> {
  const valid = configSchema.parse(config)
  const content = YAML.stringify(valid)
  await writeFile(configPath, content, "utf8")
}
