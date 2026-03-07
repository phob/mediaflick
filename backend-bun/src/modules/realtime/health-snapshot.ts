import { access } from "node:fs/promises"
import type { ConfigStore } from "@/config/config-store"
import type { InitialRealtimeEvent } from "@/modules/realtime/ws-hub"

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function getInitialHealthEvents(
  configStore: ConfigStore,
): Promise<InitialRealtimeEvent[]> {
  const timestamp = Date.now()
  const events: InitialRealtimeEvent[] = [
    { event: "heartbeat", payload: timestamp },
  ]

  const config = await configStore.get()
  if (await fileExists(config.zurg.versionLocation)) {
    events.push({ event: "zurg.version", payload: timestamp })
  }

  return events
}
