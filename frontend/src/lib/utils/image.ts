/**
 * Get a cached TMDB image URL through our custom proxy endpoint
 * This ensures images are cached indefinitely since TMDB URLs never change
 *
 * @param path - TMDB image path (e.g., "/abc123.jpg")
 * @param size - Image size (w300, w500, w780, original)
 * @returns Proxied image URL with indefinite caching
 */
export function getTmdbImageUrl(path: string | null | undefined, size: string = "w500"): string {
  if (!path) return "/placeholder-image.jpg"

  const tmdbUrl = `https://image.tmdb.org/t/p/${size}${path}`

  // Use our custom image proxy for indefinite caching
  return `/api/image?url=${encodeURIComponent(tmdbUrl)}`
}
