import { useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query"
import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo, MediaSearchResult } from "@/lib/api/types"
import { MediaType } from "@/lib/api/types"

// Query key factories for consistent cache keys
export const mediaQueries = {
  all: ["media"] as const,
  movies: () => [...mediaQueries.all, "movies"] as const,
  movie: (tmdbId: number) => [...mediaQueries.movies(), tmdbId] as const,
  tvShows: () => [...mediaQueries.all, "tvshows"] as const,
  tvShow: (tmdbId: number) => [...mediaQueries.tvShows(), tmdbId] as const,
  searches: () => [...mediaQueries.all, "searches"] as const,
  search: (title: string, mediaType: MediaType) => 
    [...mediaQueries.searches(), mediaType, title] as const,
  tmdbList: (searchTerm: string, mediaType: MediaType) => 
    [...mediaQueries.all, "tmdb-list", mediaType, searchTerm] as const,
}

// Custom hooks for media queries
export function useMovieInfo(tmdbId: number): UseQueryResult<MediaInfo, Error> {
  return useQuery({
    queryKey: mediaQueries.movie(tmdbId),
    queryFn: () => mediaApi.getMovie(tmdbId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - aligns with backend cache
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - keep movie data longer
    enabled: !!tmdbId,
  })
}

export function useTvShowInfo(tmdbId: number): UseQueryResult<MediaInfo, Error> {
  return useQuery({
    queryKey: mediaQueries.tvShow(tmdbId),
    queryFn: () => mediaApi.getTvShow(tmdbId),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours - aligns with backend cache
    gcTime: 2 * 24 * 60 * 60 * 1000, // 2 days - TV shows change more frequently
    enabled: !!tmdbId,
  })
}

export function useMediaInfo(tmdbId: number, mediaType: MediaType): UseQueryResult<MediaInfo, Error> {
  return useQuery({
    queryKey: mediaType === MediaType.Movies ? mediaQueries.movie(tmdbId) : mediaQueries.tvShow(tmdbId),
    queryFn: () => mediaType === MediaType.Movies ? mediaApi.getMovie(tmdbId) : mediaApi.getTvShow(tmdbId),
    staleTime: mediaType === MediaType.Movies ? 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000,
    gcTime: mediaType === MediaType.Movies ? 7 * 24 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000,
    enabled: !!tmdbId,
  })
}

export function useMovieSearch(title: string): UseQueryResult<MediaSearchResult[], Error> {
  return useQuery({
    queryKey: mediaQueries.search(title, MediaType.Movies),
    queryFn: () => mediaApi.searchMovies(title),
    staleTime: 60 * 60 * 1000, // 1 hour - aligns with backend cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    enabled: title.length > 0,
  })
}

export function useTvShowSearch(title: string): UseQueryResult<MediaSearchResult[], Error> {
  return useQuery({
    queryKey: mediaQueries.search(title, MediaType.TvShows),
    queryFn: () => mediaApi.searchTvShows(title),
    staleTime: 60 * 60 * 1000, // 1 hour - aligns with backend cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    enabled: title.length > 0,
  })
}

export function useTmdbList(searchTerm: string, mediaType: MediaType) {
  return useQuery({
    queryKey: mediaQueries.tmdbList(searchTerm, mediaType),
    queryFn: () => mediaApi.getTmdbIdsAndTitles({ searchTerm, mediaType }),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    enabled: true,
  })
}

// Utility hook to prefetch media info
export function usePrefetchMediaInfo() {
  const queryClient = useQueryClient()

  const prefetchMovie = (tmdbId: number) => {
    queryClient.prefetchQuery({
      queryKey: mediaQueries.movie(tmdbId),
      queryFn: () => mediaApi.getMovie(tmdbId),
      staleTime: 24 * 60 * 60 * 1000,
    })
  }

  const prefetchTvShow = (tmdbId: number) => {
    queryClient.prefetchQuery({
      queryKey: mediaQueries.tvShow(tmdbId),
      queryFn: () => mediaApi.getTvShow(tmdbId),
      staleTime: 6 * 60 * 60 * 1000,
    })
  }

  return { prefetchMovie, prefetchTvShow }
}

// Cache invalidation utilities
export function useInvalidateMediaCache() {
  const queryClient = useQueryClient()

  const invalidateMovie = (tmdbId: number) => {
    queryClient.invalidateQueries({ queryKey: mediaQueries.movie(tmdbId) })
  }

  const invalidateTvShow = (tmdbId: number) => {
    queryClient.invalidateQueries({ queryKey: mediaQueries.tvShow(tmdbId) })
  }

  const invalidateSearch = (title: string, mediaType: MediaType) => {
    queryClient.invalidateQueries({ queryKey: mediaQueries.search(title, mediaType) })
  }

  const invalidateAllMedia = () => {
    queryClient.invalidateQueries({ queryKey: mediaQueries.all })
  }

  return {
    invalidateMovie,
    invalidateTvShow,
    invalidateSearch,
    invalidateAllMedia,
  }
}
