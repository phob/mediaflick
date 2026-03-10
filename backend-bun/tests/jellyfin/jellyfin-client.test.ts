import { afterEach, describe, expect, test } from "bun:test"
import { JellyfinClient } from "@/modules/jellyfin/jellyfin-client"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function createClient() {
  return new JellyfinClient({
    enabled: true,
    baseUrl: "http://jellyfin.local",
    apiKey: "abc123",
    requestTimeoutMs: 5000,
  })
}

describe("JellyfinClient", () => {
  test("sends targeted movie update requests with provider ids", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init })
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const client = createClient()
    await client.reportMovieAdded({ tmdbId: 101, imdbId: "tt1234567" })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe("http://jellyfin.local/Library/Movies/Added?tmdbId=101&imdbId=tt1234567")
    expect(requests[0]?.init?.method).toBe("POST")
    expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toContain("abc123")
  })

  test("sends media path updates using Jellyfin's DTO shape", async () => {
    const requests: Array<{ url: string; init?: RequestInit; body: string | null }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init, body: init?.body ? String(init.body) : null })
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const client = createClient()
    await client.reportMediaUpdated([
      { path: "/library/movie/file.mkv", updateType: "Created" },
      { path: "/library/show/file.mkv", updateType: "Deleted" },
    ])

    expect(requests[0]?.url).toBe("http://jellyfin.local/Library/Media/Updated")
    expect(JSON.parse(requests[0]?.body ?? "{}")).toEqual({
      Updates: [
        { Path: "/library/movie/file.mkv", UpdateType: "Created" },
        { Path: "/library/show/file.mkv", UpdateType: "Deleted" },
      ],
    })
  })

  test("queries items with provider ids and path fields for verification", async () => {
    const requests: Array<string> = []
    globalThis.fetch = (async (input) => {
      requests.push(String(input))
      return Response.json({
        Items: [
          {
            Id: "jf-1",
            Name: "Great Movie",
            Path: "/library/Great Movie (2024)",
            ProviderIds: {
              Tmdb: "101",
            },
          },
        ],
      })
    }) as typeof fetch

    const client = createClient()
    const items = await client.findItems({
      includeItemTypes: "Movie",
      parentId: "movies-folder",
      searchTerm: "Great Movie",
      limit: 10,
    })

    expect(requests[0]).toContain("/Items?")
    expect(requests[0]).toContain("includeItemTypes=Movie")
    expect(requests[0]).toContain("parentId=movies-folder")
    expect(requests[0]).toContain("fields=ProviderIds%2CPath")
    expect(items[0]?.providerIds.tmdb).toBe("101")
  })
})
