import { extname, join } from "node:path"

const rootDir = process.cwd()
const distDir = join(rootDir, "dist")
const port = Number(process.env.PORT ?? "3002")
const backendHttpOrigin = process.env.BACKEND_HTTP_ORIGIN ?? process.env.BACKEND_URL ?? "http://127.0.0.1:5000"
const backendWsOrigin = process.env.BACKEND_WS_ORIGIN ?? process.env.BACKEND_WS_URL ?? "ws://127.0.0.1:5000"

interface ProxySocketData {
  upstreamUrl: string
  upstream?: WebSocket
}

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

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`
}

function optionalEnvValue(name: string): string | null {
  const value = process.env[name]
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null
  }

  const first = value.split(",", 1)[0]?.trim()
  return first && first.length > 0 ? first : null
}

function inferPublicScheme(request: Request, requestUrl: URL): "http" | "https" {
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))
  if (forwardedProto === "https") {
    return "https"
  }
  if (forwardedProto === "http") {
    return "http"
  }

  const forwarded = request.headers.get("forwarded")
  if (forwarded) {
    const match = forwarded.match(/proto=(https|http)/i)
    if (match?.[1]) {
      return match[1].toLowerCase() === "https" ? "https" : "http"
    }
  }

  return requestUrl.protocol === "https:" ? "https" : "http"
}

function inferPublicHost(request: Request, requestUrl: URL): string {
  return firstHeaderValue(request.headers.get("x-forwarded-host")) ?? requestUrl.host
}

function buildRuntimeConfigScriptForRequest(request: Request, requestUrl: URL): string {
  const publicScheme = inferPublicScheme(request, requestUrl)
  const publicHost = inferPublicHost(request, requestUrl)
  const wsProtocol = publicScheme === "https" ? "wss" : "ws"

  const defaultApiBaseUrl = `${publicScheme}://${publicHost}/api`
  const defaultWsUrl = `${wsProtocol}://${publicHost}/ws/filetracking`

  const apiBaseUrl = optionalEnvValue("API_BASE_URL") ?? defaultApiBaseUrl
  const wsUrl = optionalEnvValue("WS_URL") ?? defaultWsUrl

  const payload = {
    apiBaseUrl,
    wsUrl,
  }

  return `window.__MEDIAFLICK_CONFIG__=${JSON.stringify(payload)};`
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/")
}

function isWebSocketPath(pathname: string): boolean {
  return pathname === "/ws" || pathname.startsWith("/ws/")
}

function buildBackendApiUrl(pathname: string, search: string): string {
  return new URL(`${pathname}${search}`, withTrailingSlash(backendHttpOrigin)).toString()
}

function buildBackendWsUrl(pathname: string, search: string): string {
  return new URL(`${pathname}${search}`, withTrailingSlash(backendWsOrigin)).toString()
}

const server = Bun.serve<ProxySocketData>({
  port,
  async fetch(request: Request, bunServer) {
    const url = new URL(request.url)

    if (isApiPath(url.pathname)) {
      const proxiedRequest = new Request(buildBackendApiUrl(url.pathname, url.search), request)
      return fetch(proxiedRequest)
    }

    if (isWebSocketPath(url.pathname)) {
      const upgraded = bunServer.upgrade(request, {
        data: {
          upstreamUrl: buildBackendWsUrl(url.pathname, url.search),
        },
      })
      if (upgraded) {
        return undefined
      }

      return new Response("WebSocket upgrade failed.", { status: 400 })
    }

    if (url.pathname === "/runtime-config.js") {
      return new Response(buildRuntimeConfigScriptForRequest(request, url), {
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
  websocket: {
    open(client) {
      const upstream = new WebSocket(client.data.upstreamUrl)
      client.data.upstream = upstream

      upstream.onmessage = event => {
        client.send(event.data as string | ArrayBuffer | Uint8Array)
      }

      upstream.onclose = () => {
        if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
          client.close()
        }
      }

      upstream.onerror = () => {
        if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
          client.close(1011, "Upstream websocket error")
        }
      }
    },

    message(client, message) {
      const upstream = client.data.upstream
      if (!upstream || upstream.readyState !== WebSocket.OPEN) {
        return
      }

      upstream.send(message as string | Uint8Array)
    },

    close(client) {
      const upstream = client.data.upstream
      if (!upstream) {
        return
      }

      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close()
      }
    },
  },
})

console.log(`Mediaflick Solid frontend listening on http://localhost:${server.port}`)
