import type { AppContext } from "@/app/context"
import { configSchema } from "@/config/runtime-config"
import { json, parseJson } from "@/shared/http"

export async function handleConfigRoute(request: Request, context: AppContext): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  if (pathname !== "/api/config") {
    return null
  }

  if (request.method === "GET") {
    const config = await context.configStore.get()
    return json(config)
  }

  if (request.method === "PUT") {
    const body = await parseJson<unknown>(request)
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) {
      return json({ error: "Invalid configuration", details: parsed.error.issues }, { status: 400 })
    }

    const updated = await context.configStore.update(parsed.data)
    context.tmdb = context.tmdbFactory(updated.tmDb.apiKey)
    context.poller.restart(updated)

    return json(updated)
  }

  return json({ error: "Method not allowed" }, { status: 405 })
}
