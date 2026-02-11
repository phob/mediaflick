import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { configSchema } from "@/config/runtime-config"
import { parseJson } from "@/shared/http"

export function createConfigRouter(context: AppContext) {
  const router = new Hono()

  router.get(ENTRYPOINTS.api.config, async c => {
    const config = await context.configStore.get()
    return c.json(config)
  })

  router.put(ENTRYPOINTS.api.config, async c => {
    const body = await parseJson<unknown>(c.req.raw)
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: "Invalid configuration", details: parsed.error.issues }, 400)
    }

    const updated = await context.configStore.update(parsed.data)
    context.tmdb = context.tmdbFactory(updated.tmDb.apiKey)
    context.poller.restart(updated)

    return c.json(updated)
  })

  router.all(ENTRYPOINTS.api.config, c => c.json({ error: "Method not allowed" }, 405))

  return router
}
