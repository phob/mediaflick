import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import { and, eq, sql } from "drizzle-orm"
import type { AppContext } from "@/app/context"
import { scannedFiles } from "@/db/schema"
import type { EpisodeInfo, MediaInfo, MediaSearchResult, SeasonInfo } from "@/shared/types"

function toInt(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  return n
}

function validateTitle(title: string | undefined): string | null {
  if (!title || !title.trim()) {
    return null
  }
  return title.trim()
}

export function createMediaLookupRouter(context: AppContext) {
  const router = new Hono()

  router.get(ENTRYPOINTS.api.mediaLookup.movieSearch, async c => {
    const title = validateTitle(c.req.query("title"))
    if (!title) {
      return c.json({ error: "Title is required" }, 400)
    }

    const results = await context.tmdb.searchMovie(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.title,
      year: context.tmdb.movieYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvSearch, async c => {
    const title = validateTitle(c.req.query("title"))
    if (!title) {
      return c.json({ error: "Title is required" }, 400)
    }

    const results = await context.tmdb.searchTv(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.name,
      year: context.tmdb.tvYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.movieByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [movie, external] = await Promise.all([
      context.tmdb.getMovie(tmdbId),
      context.tmdb.getMovieExternalIds(tmdbId),
    ])

    const payload: MediaInfo = {
      title: movie.title,
      year: context.tmdb.movieYear(movie),
      tmdbId: movie.id,
      imdbId: external.imdb_id,
      mediaType: "Movies",
      posterPath: movie.poster_path ?? null,
      backdropPath: movie.backdrop_path ?? null,
      overview: movie.overview ?? null,
      status: movie.status ?? null,
      genres: movie.genres?.map(g => g.name) ?? [],
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    if (!tmdbId) {
      return c.json({ error: "Invalid TMDb id" }, 400)
    }

    const [show, external, counts] = await Promise.all([
      context.tmdb.getTv(tmdbId),
      context.tmdb.getTvExternalIds(tmdbId),
      context.db
        .select({ count: sql<number>`count(*)` })
        .from(scannedFiles)
        .where(and(eq(scannedFiles.tmdbId, tmdbId), eq(scannedFiles.mediaType, "TvShows"), eq(scannedFiles.status, "Success"))),
    ])

    const payload: MediaInfo = {
      title: show.name,
      year: context.tmdb.tvYear(show),
      tmdbId: show.id,
      imdbId: external.imdb_id,
      mediaType: "TvShows",
      posterPath: show.poster_path ?? null,
      backdropPath: show.backdrop_path ?? null,
      overview: show.overview ?? null,
      status: show.status ?? null,
      genres: show.genres?.map(g => g.name) ?? [],
      episodeCount: show.number_of_episodes,
      episodeCountScanned: counts[0]?.count ?? 0,
      seasonCount: show.number_of_seasons,
      seasonCountScanned: 0,
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvSeasonByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    const seasonNumber = toInt(c.req.param("seasonNumber"))
    if (!tmdbId || !seasonNumber) {
      return c.json({ error: "Invalid TMDb or season number" }, 400)
    }

    const [season, scannedEpisodes] = await Promise.all([
      context.tmdb.getTvSeason(tmdbId, seasonNumber),
      context.db
        .select({ episodeNumber: scannedFiles.episodeNumber })
        .from(scannedFiles)
        .where(and(eq(scannedFiles.tmdbId, tmdbId), eq(scannedFiles.seasonNumber, seasonNumber))),
    ])

    const scannedSet = new Set(scannedEpisodes.map(row => row.episodeNumber).filter(v => v !== null) as number[])

    const payload: SeasonInfo = {
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview,
      posterPath: season.poster_path,
      airDate: season.air_date,
      episodes: season.episodes.map(ep => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        stillPath: ep.still_path,
        airDate: ep.air_date,
        isScanned: scannedSet.has(ep.episode_number),
      })),
      episodeCount: season.episodes.length,
      episodeCountScanned: scannedSet.size,
    }

    return c.json(payload)
  })

  router.get(ENTRYPOINTS.api.mediaLookup.tvEpisodeByTmdbId, async c => {
    const tmdbId = toInt(c.req.param("tmdbId"))
    const seasonNumber = toInt(c.req.param("seasonNumber"))
    const episodeNumber = toInt(c.req.param("episodeNumber"))
    if (!tmdbId || !seasonNumber || !episodeNumber) {
      return c.json({ error: "Invalid episode request" }, 400)
    }

    const episode = await context.tmdb.getTvEpisode(tmdbId, seasonNumber, episodeNumber)
    const payload: EpisodeInfo = {
      episodeNumber: episode.episode_number,
      name: episode.name,
      overview: episode.overview,
      stillPath: episode.still_path,
      airDate: episode.air_date,
      tmdbId: episode.id,
    }

    return c.json(payload)
  })

  router.get(`${ENTRYPOINTS.api.mediaLookup.imagesPrefix}/*`, c => {
    const rawPath = c.req.path.slice(`${ENTRYPOINTS.api.mediaLookup.imagesPrefix}/`.length)
    const size = c.req.query("size") ?? "w500"
    return c.json(context.tmdb.getImageUrl(rawPath, size))
  })

  router.delete(ENTRYPOINTS.api.mediaLookup.cacheBase, c => {
    context.tmdb.invalidateAll()
    return c.json({ ok: true })
  })

  router.delete(ENTRYPOINTS.api.mediaLookup.cacheWildcard, c => {
    context.tmdb.invalidateAll()
    return c.json({ ok: true })
  })

  return router
}
