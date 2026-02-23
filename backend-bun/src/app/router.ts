import { Hono } from "hono"
import { cors } from "hono/cors"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { createConfigRouter } from "@/modules/config/config-routes"
import { createLogsRouter } from "@/modules/logs/log-routes"
import { createMediaLookupRouter } from "@/modules/media-lookup/media-lookup-routes"
import { createScannedFilesRouter } from "@/modules/scanned-files/scanned-files-routes"
import { createSymlinkRouter } from "@/modules/symlink/symlink-routes"
import { HttpError } from "@/shared/errors"

export function createRouter(context: AppContext) {
  const app = new Hono()

  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
  }))

  app.get(ENTRYPOINTS.root, c => c.json({ message: "Mediaflick Bun backend is running" }))
  app.get(ENTRYPOINTS.health, c => c.json({ ok: true, ts: Date.now() }))

  app.route("/", createConfigRouter(context))
  app.route("/", createLogsRouter(context))
  app.route("/", createMediaLookupRouter(context))
  app.route("/", createScannedFilesRouter(context))
  app.route("/", createSymlinkRouter(context))

  app.notFound(c => c.json({ error: "Not found" }, 404))

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "content-type": "application/json" },
      })
    }

    context.logger.error("Unhandled request error", {
      error: String(error),
    })
    return c.json({ error: "Internal server error" }, 500)
  })

  return app
}
