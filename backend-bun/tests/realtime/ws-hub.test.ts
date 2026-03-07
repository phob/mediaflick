import { describe, expect, mock, test } from "bun:test"
import { createWsHub } from "../../src/modules/realtime/ws-hub"
import type { Logger } from "../../src/shared/logger"

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function createSocket() {
  return {
    readyState: 1,
    send: mock(() => {}),
  } as unknown as Bun.ServerWebSocket<undefined>
}

describe("createWsHub", () => {
  test("sends initial realtime events when a websocket client connects", async () => {
    const ws = createSocket()
    const hub = createWsHub(logger, async () => [
      { event: "heartbeat", payload: 123 },
      { event: "zurg.version", payload: 123 },
    ])

    hub.websocket.open?.(ws)
    await Promise.resolve()

    expect(ws.send).toHaveBeenCalledTimes(2)
    expect(ws.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: "heartbeat", payload: 123 }),
    )
    expect(ws.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ type: "zurg.version", payload: 123 }),
    )
  })

  test("broadcast sends realtime events to connected clients", () => {
    const ws = createSocket()
    const hub = createWsHub(logger)

    hub.websocket.open?.(ws)
    hub.broadcast("heartbeat", 456)

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "heartbeat", payload: 456 }),
    )
  })
})
