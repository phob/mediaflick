import type { RuntimeConfig } from "@/config/runtime-config"
import { loadConfig, saveConfig } from "@/config/yaml-config"

export class ConfigStore {
  private currentConfig: RuntimeConfig | null = null

  constructor(private readonly configPath: string) {}

  async init(): Promise<void> {
    this.currentConfig = await loadConfig(this.configPath)
  }

  async get(): Promise<RuntimeConfig> {
    if (!this.currentConfig) {
      this.currentConfig = await loadConfig(this.configPath)
    }
    return this.currentConfig
  }

  async update(next: RuntimeConfig): Promise<RuntimeConfig> {
    await saveConfig(this.configPath, next)
    this.currentConfig = next
    return next
  }
}
