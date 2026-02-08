import { resolve } from "node:path"

export interface AppEnv {
  port: number
  rootDir: string
  configPath: string
  logsDir: string
  databasePath: string
}

export function loadEnv(): AppEnv {
  const rootDir = process.env.BACKEND_BUN_ROOT_DIR
    ? resolve(process.env.BACKEND_BUN_ROOT_DIR)
    : process.cwd()

  const port = Number(process.env.PORT ?? 5000)
  const configPath = process.env.BACKEND_BUN_CONFIG_PATH ?? resolve(rootDir, "config", "config.yml")
  const logsDir = process.env.BACKEND_BUN_LOGS_DIR ?? resolve(rootDir, "logs")
  const databasePath = process.env.BACKEND_BUN_DB_PATH ?? resolve(rootDir, "config", "plexscan.db")

  return {
    port,
    rootDir,
    configPath,
    logsDir,
    databasePath,
  }
}
