import { MediaStatus, MediaType } from "@/lib/api/types"

export const getStatusClass = (status: MediaStatus) => {
  switch (status) {
    case MediaStatus.Processing:
      return "bg-yellow-700 text-white"
    case MediaStatus.Success:
      return "bg-green-700 text-white"
    case MediaStatus.Failed:
      return "bg-red-700 text-white"
    case MediaStatus.Duplicate:
      return "bg-gray-700 text-white"
    default:
      return "bg-gray-700 text-white"
  }
}

export const getStatusLabel = (status: MediaStatus) => {
  switch (status) {
    case MediaStatus.Processing:
      return "Processing"
    case MediaStatus.Success:
      return "Success"
    case MediaStatus.Failed:
      return "Failed"
    case MediaStatus.Duplicate:
      return "Duplicate"
  }
}

export const getMediaTypeLabel = (mediaType: MediaType) => {
  switch (mediaType) {
    case MediaType.Movies:
      return "Movies"
    case MediaType.TvShows:
      return "TV Shows"
    case MediaType.Extras:
      return "Extras"
    case MediaType.Unknown:
      return "Unknown"
    default:
      return "Unknown"
  }
}

export const formatEpisodeNumber = (seasonNumber?: number, episodeNumber?: number) => {
  if (seasonNumber === null || episodeNumber === null || seasonNumber === undefined || episodeNumber === undefined) {
    return "-"
  }
  return `S${seasonNumber.toString().padStart(2, "0")}E${episodeNumber.toString().padStart(2, "0")}`
}

