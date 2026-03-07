import { ENTRYPOINTS } from "@/app/entrypoints"
import type { Logger } from "@/shared/logger"

type WsData = undefined

export type RealtimeEvent =
  | "file.added"
  | "file.updated"
  | "file.removed"
  | "heartbeat"
  | "zurg.version"

export interface WsHub {
  tryUpgrade(request: Request, server: Bun.Server<WsData>): boolean
  websocket: Bun.WebSocketHandler<WsData>
  broadcast(event: RealtimeEvent, payload: unknown): void
}

export interface InitialRealtimeEvent {
  event: RealtimeEvent
  payload: unknown
}

export function createWsHub(
  logger: Logger,
  getInitialEvents?: () => Promise<InitialRealtimeEvent[]>,
): WsHub {
  const clients = new Set<Bun.ServerWebSocket<WsData>>()

  function broadcast(event: RealtimeEvent, payload: unknown): void {
    const message = JSON.stringify({ type: event, payload })
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(message)
      }
    }
  }

  function tryUpgrade(request: Request, server: Bun.Server<WsData>): boolean {
    const url = new URL(request.url)
    if (url.pathname !== ENTRYPOINTS.ws.filetracking) {
      return false
    }

    return server.upgrade(request, { data: undefined })
  }

  async function sendInitialEvents(ws: Bun.ServerWebSocket<WsData>): Promise<void> {
    if (!getInitialEvents) {
      return
    }

    try {
      const events = await getInitialEvents()
      for (const event of events) {
        if (ws.readyState !== 1) {
          return
        }
        ws.send(JSON.stringify({ type: event.event, payload: event.payload }))
      }
    } catch (error) {
      logger.warn("Failed to send initial realtime events", {
        error: String(error),
      })
    }
  }

  const websocket: Bun.WebSocketHandler<WsData> = {
    open(ws) {
      clients.add(ws)
      logger.debug("WebSocket client connected", { clientCount: clients.size })
      void sendInitialEvents(ws)
    },
    close(ws) {
      clients.delete(ws)
      logger.debug("WebSocket client disconnected", { clientCount: clients.size })
    },
    message() {
    },
  }

  return {
    tryUpgrade,
    websocket,
    broadcast,
  }
}
