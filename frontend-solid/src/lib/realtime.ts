import { getWsUrl } from "@/lib/runtime-config"
import type { RealtimeEnvelope } from "@/lib/types"

export function createRealtimeSocket(onMessage: (message: RealtimeEnvelope) => void): () => void {
  const socket = new WebSocket(getWsUrl())

  socket.onmessage = event => {
    try {
      const message = JSON.parse(event.data) as RealtimeEnvelope
      onMessage(message)
    } catch {
    }
  }

  return () => {
    socket.close()
  }
}
