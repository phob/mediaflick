import { access } from "node:fs/promises"
import type { ConfigStore } from "@/config/config-store"
import type { WsHub } from "@/modules/realtime/ws-hub"

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export function startRuntimeJobs(configStore: ConfigStore, wsHub: WsHub): () => void {
  const heartbeatTimer = setInterval(() => {
    wsHub.broadcast("heartbeat", Date.now())
  }, 30_000)

  const zurgTimer = setInterval(async () => {
    const config = await configStore.get()
    if (await fileExists(config.zurg.versionLocation)) {
      wsHub.broadcast("zurg.version", Date.now())
    }
  }, 30_000)

  return () => {
    clearInterval(heartbeatTimer)
    clearInterval(zurgTimer)
  }
}
