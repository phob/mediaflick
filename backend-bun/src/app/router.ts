import type { AppContext } from "@/app/context"
import { handleConfigRoute } from "@/modules/config/config-routes"
import { handleLogsRoute } from "@/modules/logs/log-routes"
import { handleMediaLookupRoute } from "@/modules/media-lookup/media-lookup-routes"
import { handleScannedFilesRoute } from "@/modules/scanned-files/scanned-files-routes"
import { handleSymlinkRoute } from "@/modules/symlink/symlink-routes"
import { HttpError } from "@/shared/errors"
import { json, withCors } from "@/shared/http"

export function createRouter(context: AppContext) {
  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }))
    }

    if (request.method === "GET" && pathname === "/") {
      return withCors(json({ message: "Mediaflick Bun backend is running" }))
    }

    if (request.method === "GET" && pathname === "/health") {
      return withCors(json({ ok: true, ts: Date.now() }))
    }

    const handlers = [
      () => handleConfigRoute(request, context),
      () => handleLogsRoute(request, context),
      () => handleMediaLookupRoute(request, pathname, context),
      () => handleScannedFilesRoute(request, pathname, context),
      () => handleSymlinkRoute(request, context),
    ]

    for (const handler of handlers) {
      const result = await handler()
      if (result) {
        return withCors(result)
      }
    }

    return withCors(json({ error: "Not found" }, { status: 404 }))
  }

  async function safeHandle(request: Request): Promise<Response> {
    try {
      return await handle(request)
    } catch (error) {
      if (error instanceof HttpError) {
        return withCors(json({ error: error.message }, { status: error.status }))
      }

      context.logger.error("Unhandled request error", {
        error: String(error),
      })
      return withCors(json({ error: "Internal server error" }, { status: 500 }))
    }
  }

  return { handle: safeHandle }
}
