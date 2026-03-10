import { readdir } from "node:fs/promises"
import { dirname, join, normalize, resolve } from "node:path"
import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { configSchema } from "@/config/runtime-config"
import { parseJson } from "@/shared/http"

interface BrowserEntry {
  name: string
  path: string
  kind: "directory" | "file"
}

function normalizeBrowsePath(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return "/"
  }

  const trimmed = value.trim().replace(/\\/g, "/")
  if (!trimmed.startsWith("/")) {
    return "/"
  }

  const normalized = normalize(trimmed)
  return normalized.startsWith("/") ? normalized : "/"
}

function parentPath(path: string): string | null {
  if (path === "/") {
    return null
  }

  const segments = path.split("/").filter(Boolean)
  if (segments.length <= 1) {
    return "/"
  }

  return `/${segments.slice(0, -1).join("/")}`
}

async function resolveBrowsePath(path: string): Promise<string> {
  let current = path

  while (true) {
    try {
      await readdir(current)
      return current
    } catch {
      if (current === "/") {
        return "/"
      }
      const next = dirname(current)
      if (next === current) {
        return "/"
      }
      current = next
    }
  }
}

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
    context.jellyfin = context.jellyfinFactory(updated.jellyfin)
    context.logger.info("Jellyfin configuration updated", {
      enabled: updated.jellyfin.enabled,
      baseUrl: updated.jellyfin.baseUrl,
      apiKeyConfigured: updated.jellyfin.apiKey.trim().length > 0,
      requestTimeoutMs: updated.jellyfin.requestTimeoutMs,
    })
    context.poller.restart(updated)

    return c.json(updated)
  })

  router.get(ENTRYPOINTS.api.configBrowse, async c => {
    const requestedPath = normalizeBrowsePath(c.req.query("path"))
    const resolvedPath = await resolveBrowsePath(requestedPath)

    try {
      const entries = await readdir(resolvedPath, { withFileTypes: true })
      const directories: BrowserEntry[] = []
      const files: BrowserEntry[] = []

      for (const entry of entries) {
        const absolutePath = resolve(join(resolvedPath, entry.name))
        if (entry.isDirectory()) {
          directories.push({ name: entry.name, path: absolutePath, kind: "directory" })
        } else if (entry.isFile()) {
          files.push({ name: entry.name, path: absolutePath, kind: "file" })
        }
      }

      directories.sort((left, right) => left.name.localeCompare(right.name))
      files.sort((left, right) => left.name.localeCompare(right.name))

      return c.json({
        path: resolvedPath,
        parentPath: parentPath(resolvedPath),
        directories,
        files,
      })
    } catch (error) {
      context.logger.warn("Config directory browse failed", {
        path: requestedPath,
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: `Unable to browse directory: ${requestedPath}` }, 400)
    }
  })

  router.all(ENTRYPOINTS.api.config, c => c.json({ error: "Method not allowed" }, 405))
  router.all(ENTRYPOINTS.api.configBrowse, c => c.json({ error: "Method not allowed" }, 405))

  return router
}
