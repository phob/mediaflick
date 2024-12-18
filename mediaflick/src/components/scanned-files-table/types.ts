import { MediaType } from "@/lib/api/types"
import type { ReactNode } from "react"

export type Row = {
  key: number
  sourceFile: ReactNode
  destFile: ReactNode
  tmdbId: number
  imdbId: string
  mediaType: string
  episode: string
  status: ReactNode
  createdAt: string
  updatedAt: string
}

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

