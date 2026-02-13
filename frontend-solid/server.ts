import { extname, join } from "node:path"

const rootDir = process.cwd()
const distDir = join(rootDir, "dist")
const port = Number(process.env.PORT ?? "3002")

const mimeTypeByExt: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
}

function getMimeType(pathname: string): string {
  const extension = extname(pathname).toLowerCase()
  return mimeTypeByExt[extension] ?? "application/octet-stream"
}

function buildRuntimeConfigScript(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:5000/api"
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? process.env.WS_URL ?? "ws://localhost:5000/ws/filetracking"

  const payload = {
    apiBaseUrl,
    wsUrl,
  }

  return `window.__MEDIAFLICK_CONFIG__=${JSON.stringify(payload)};`
}

const server = Bun.serve({
  port,
  async fetch(request: Request) {
    const url = new URL(request.url)

    if (url.pathname === "/runtime-config.js") {
      return new Response(buildRuntimeConfigScript(), {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      })
    }

    const requestedPath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "")
    const candidateFile = Bun.file(join(distDir, requestedPath))
    if (await candidateFile.exists()) {
      return new Response(candidateFile, {
        headers: {
          "content-type": getMimeType(requestedPath),
        },
      })
    }

    const indexFile = Bun.file(join(distDir, "index.html"))
    if (!(await indexFile.exists())) {
      return new Response("Build output not found. Run bun run build first.", { status: 500 })
    }

    return new Response(indexFile, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    })
  },
})

console.log(`Mediaflick Solid frontend listening on http://localhost:${server.port}`)
