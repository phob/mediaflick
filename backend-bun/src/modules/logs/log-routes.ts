import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { getLogs } from "@/modules/logs/log-service"

export function createLogsRouter(context: AppContext) {
  const router = new Hono()

  router.get(ENTRYPOINTS.api.logs, async c => {
    const minLevel = c.req.query("minLevel")
    const searchTerm = c.req.query("searchTerm")
    const from = c.req.query("from")
    const to = c.req.query("to")
    const limit = Number(c.req.query("limit") ?? 100)

    const logs = await getLogs(context.env.logsDir, {
      minLevel: minLevel ?? null,
      searchTerm: searchTerm ?? null,
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 100,
    })

    return c.json({ logs })
  })

  return router
}
