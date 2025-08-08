import type { ReactNode } from "react"

import { MediaType } from "@/lib/api/types"

export type Row = {
  key: number
  sourceFile: string | ReactNode
  destFile: string | ReactNode
  tmdbId: number
  imdbId: string
  genres?: string | ReactNode
  title?: string
  year?: number
  mediaType: string
  episode?: string
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  ignoreEpisodeIncrement?: boolean
  status: string | ReactNode
  createdAt: string | ReactNode
  updatedAt: string | ReactNode
}

export type ColumnKey =
  | 'sourceFile'
  | 'destFile'
  | 'genres'
  | 'mediaType'
  | 'tmdbId'
  | 'imdbId'
  | 'episode'
  | 'status'
  | 'createdAt'
  | 'updatedAt'

export const statusOptions = [
  { uid: "Processing", name: "Processing" },
  { uid: "Success", name: "Success" },
  { uid: "Failed", name: "Failed" },
  { uid: "Duplicate", name: "Duplicate" },
] as const

export const mediaTypeOptions = [
  { uid: MediaType.TvShows, name: "TV Shows" },
  { uid: MediaType.Movies, name: "Movies" },
  { uid: MediaType.Extras, name: "Extras" },
  { uid: MediaType.Unknown, name: "Unknown" },
] as const
