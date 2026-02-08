import { HttpError } from "@/shared/errors"

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, "Invalid JSON body")
  }
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set("access-control-allow-origin", "*")
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  headers.set("access-control-allow-headers", "content-type, authorization")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
