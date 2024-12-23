/**
 * TMDB image size options
 * @see https://developer.themoviedb.org/docs/image-basics
 */
export type TMDBImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original"

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

/**
 * Get the full URL for a TMDB image
 * @param path The image path from TMDB (e.g., /1234.jpg)
 * @param size The desired image size
 * @returns The complete URL to the image
 */
export function getTMDBImageUrl(path: string | null | undefined, size: TMDBImageSize = "w500"): string | null {
  if (!path) return null
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}
