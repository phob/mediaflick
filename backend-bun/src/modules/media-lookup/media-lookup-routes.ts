import { and, eq, sql } from "drizzle-orm"
import type { AppContext } from "@/app/context"
import { scannedFiles } from "@/db/schema"
import { json } from "@/shared/http"
import type { EpisodeInfo, MediaInfo, MediaSearchResult, SeasonInfo } from "@/shared/types"

function toInt(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  return n
}

function validateTitle(request: Request): string | null {
  const title = new URL(request.url).searchParams.get("title")
  if (!title || !title.trim()) {
    return null
  }
  return title.trim()
}

export async function handleMediaLookupRoute(request: Request, pathname: string, context: AppContext): Promise<Response | null> {
  const method = request.method

  if (method === "GET" && pathname === "/api/medialookup/movies/search") {
    const title = validateTitle(request)
    if (!title) {
      return json({ error: "Title is required" }, { status: 400 })
    }

    const results = await context.tmdb.searchMovie(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.title,
      year: context.tmdb.movieYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return json(payload)
  }

  if (method === "GET" && pathname === "/api/medialookup/tvshows/search") {
    const title = validateTitle(request)
    if (!title) {
      return json({ error: "Title is required" }, { status: 400 })
    }

    const results = await context.tmdb.searchTv(title)
    const payload: MediaSearchResult[] = results.map(item => ({
      tmdbId: item.id,
      title: item.name,
      year: context.tmdb.tvYear(item),
      posterPath: item.poster_path ?? null,
    }))
    return json(payload)
  }

  const movieMatch = pathname.match(/^\/api\/medialookup\/movies\/(\d+)$/)
  if (method === "GET" && movieMatch) {
    const tmdbId = toInt(movieMatch[1])
    if (!tmdbId) {
      return json({ error: "Invalid TMDb id" }, { status: 400 })
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

    return json(payload)
  }

  const tvMatch = pathname.match(/^\/api\/medialookup\/tvshows\/(\d+)$/)
  if (method === "GET" && tvMatch) {
    const tmdbId = toInt(tvMatch[1])
    if (!tmdbId) {
      return json({ error: "Invalid TMDb id" }, { status: 400 })
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

    return json(payload)
  }

  const seasonMatch = pathname.match(/^\/api\/medialookup\/tvshows\/(\d+)\/seasons\/(\d+)$/)
  if (method === "GET" && seasonMatch) {
    const tmdbId = toInt(seasonMatch[1])
    const seasonNumber = toInt(seasonMatch[2])
    if (!tmdbId || !seasonNumber) {
      return json({ error: "Invalid TMDb or season number" }, { status: 400 })
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

    return json(payload)
  }

  const episodeMatch = pathname.match(/^\/api\/medialookup\/tvshows\/(\d+)\/seasons\/(\d+)\/episodes\/(\d+)$/)
  if (method === "GET" && episodeMatch) {
    const tmdbId = toInt(episodeMatch[1])
    const seasonNumber = toInt(episodeMatch[2])
    const episodeNumber = toInt(episodeMatch[3])
    if (!tmdbId || !seasonNumber || !episodeNumber) {
      return json({ error: "Invalid episode request" }, { status: 400 })
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

    return json(payload)
  }

  const imagePrefix = "/api/medialookup/images/"
  if (method === "GET" && pathname.startsWith(imagePrefix)) {
    const rawPath = pathname.slice(imagePrefix.length)
    const size = new URL(request.url).searchParams.get("size") ?? "w500"
    return json(context.tmdb.getImageUrl(rawPath, size))
  }

  if (method === "DELETE" && pathname.startsWith("/api/medialookup/cache")) {
    context.tmdb.invalidateAll()
    return json({ ok: true })
  }

  return null
}
