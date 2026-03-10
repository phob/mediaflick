import { afterEach, describe, expect, test } from "bun:test"
import { MediaMetadataResolver } from "../../src/modules/media-lookup/media-metadata-resolver"
import type {
  TmdbClient,
  TmdbEpisodeDetails,
  TmdbExternalIds,
  TmdbSeasonDetails,
  TmdbTvDetails,
} from "../../src/modules/media-lookup/tmdb-client"
import type { TvdbClient, TvdbEpisodeRecord } from "../../src/modules/media-lookup/tvdb-client"
import { createTestDb, type TestDbHandle } from "../helpers/test-db"
import { tvEpisodeSourceSelections } from "../../src/db/schema"

function createTmdbStub(overrides?: {
  externalIds?: TmdbExternalIds
  episode?: TmdbEpisodeDetails
  season?: TmdbSeasonDetails
}): TmdbClient {
  const show: TmdbTvDetails = {
    id: 101,
    name: "The Series Title!",
    first_air_date: "2010-01-01",
    genres: [{ id: 1, name: "Drama" }],
    poster_path: "/poster.jpg",
    number_of_episodes: 10,
    number_of_seasons: 1,
    seasons: [],
  }

  const episode: TmdbEpisodeDetails = overrides?.episode ?? {
    id: 501,
    episode_number: 1,
    name: "Pilot",
    overview: null,
    still_path: null,
    air_date: "2010-01-01",
  }

  const season: TmdbSeasonDetails = overrides?.season ?? {
    season_number: 1,
    name: "Season 1",
    overview: null,
    poster_path: null,
    air_date: "2010-01-01",
    episodes: [episode],
  }

  return {
    searchMovie: async () => [],
    searchTv: async () => [],
    getMovie: async () => {
      throw new Error("movie lookup not expected")
    },
    getMovieExternalIds: async () => ({ imdb_id: null }),
    getMovieCredits: async () => [],
    getTv: async () => show,
    getTvExternalIds: async () => overrides?.externalIds ?? { imdb_id: "tt1234567", tvdb_id: 1520211 },
    getTvCredits: async () => [],
    getTvSeason: async () => season,
    getTvEpisode: async () => episode,
    getTvEpisodeGroups: async () => [],
    getTvEpisodeGroup: async () => ({
      id: "",
      name: "",
      description: null,
      group_count: 0,
      episode_count: 0,
      groups: [],
    }),
    movieYear: () => null,
    tvYear: tv => (tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null),
    invalidateAll: () => {},
    getImageUrl: () => "",
  } as unknown as TmdbClient
}

function createTvdbStub(): TvdbClient {
  const episodes: TvdbEpisodeRecord[] = [
    {
      id: 987654,
      name: "Pilot",
      aired: "2010-01-01",
      seasonNumber: 1,
      number: 1,
      overview: null,
      image: null,
    },
  ]

  return {
    searchSeries: async () => [],
    getSeriesExtended: async () => ({
      id: 7654321,
      name: "Alt Series",
      overview: null,
      image: null,
      firstAired: "2010-01-01",
      year: "2010",
    }),
    getSeriesEpisodes: async () => episodes,
    seriesImage: () => null,
    episodeImage: () => null,
    seriesYear: series => series.year ?? null,
    seriesPoster: () => null,
    searchResultId: () => null,
    searchResultTitle: () => "",
    searchResultYear: () => null,
    searchResultPoster: () => null,
  } as unknown as TvdbClient
}

describe("MediaMetadataResolver", () => {
  let handle: TestDbHandle | null = null

  afterEach(async () => {
    if (handle) {
      await handle.cleanup()
      handle = null
    }
  })

  test("returns the TVDB series id from TMDb external ids", async () => {
    handle = await createTestDb("resolver")
    const tmdb = createTmdbStub()
    const resolver = new MediaMetadataResolver(handle.db, () => tmdb, () => createTvdbStub())

    const resolved = await resolver.resolveTv({
      tmdbId: 101,
      seasonNumber: 1,
      episodeNumber: 1,
    })

    expect(resolved.tvdbId).toBe(1520211)
    expect(resolved.episodeTitle).toBe("Pilot")
  })

  test("prefers the selected TVDB source series id over the TMDb external id", async () => {
    handle = await createTestDb("resolver")
    await handle.db.insert(tvEpisodeSourceSelections).values({
      tmdbId: 101,
      sourceType: "tvdb",
      tvdbId: 7654321,
      tvdbSeriesName: "Alt Series",
      tvdbSeasonType: "default",
      updatedAt: new Date().toISOString(),
    })

    const tmdb = createTmdbStub({
      externalIds: {
        imdb_id: "tt1234567",
        tvdb_id: 1520211,
      },
    })
    const resolver = new MediaMetadataResolver(handle.db, () => tmdb, () => createTvdbStub())

    const resolved = await resolver.resolveTv({
      tmdbId: 101,
      seasonNumber: 1,
      episodeNumber: 1,
    })

    expect(resolved.tvdbId).toBe(7654321)
    expect(resolved.episodeTitle).toBe("Pilot")
  })

  test("uses the provided ordering snapshot instead of rereading the saved source selection", async () => {
    handle = await createTestDb("resolver")
    await handle.db.insert(tvEpisodeSourceSelections).values({
      tmdbId: 101,
      sourceType: "tvdb",
      tvdbId: 7654321,
      tvdbSeriesName: "Alt Series",
      tvdbSeasonType: "default",
      updatedAt: new Date().toISOString(),
    })

    const tmdb = createTmdbStub({
      episode: {
        id: 501,
        episode_number: 1,
        name: "TMDb Pilot",
        overview: null,
        still_path: null,
        air_date: "2010-01-01",
      },
      season: {
        season_number: 1,
        name: "Season 1",
        overview: null,
        poster_path: null,
        air_date: "2010-01-01",
        episodes: [{
          id: 501,
          episode_number: 1,
          name: "TMDb Pilot",
          overview: null,
          still_path: null,
          air_date: "2010-01-01",
        }],
      },
    })
    const resolver = new MediaMetadataResolver(handle.db, () => tmdb, () => createTvdbStub())

    const resolved = await resolver.resolveTv({
      tmdbId: 101,
      seasonNumber: 1,
      episodeNumber: 1,
      orderingSnapshot: {
        episodeSource: {
          tmdbId: 101,
          source: "tmdb",
          tvdbId: null,
          tvdbSeriesName: null,
          tvdbSeasonType: null,
          updatedAt: new Date().toISOString(),
        },
        episodeGroupId: null,
      },
    })

    expect(resolved.tvdbId).toBe(1520211)
    expect(resolved.episodeTitle).toBe("TMDb Pilot")
  })
})
