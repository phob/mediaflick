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

export function createWsHub(logger: Logger): WsHub {
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
    if (url.pathname !== "/ws/filetracking") {
      return false
    }

    return server.upgrade(request, { data: undefined })
  }

  const websocket: Bun.WebSocketHandler<WsData> = {
    open(ws) {
      clients.add(ws)
      logger.debug("WebSocket client connected", { clientCount: clients.size })
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
