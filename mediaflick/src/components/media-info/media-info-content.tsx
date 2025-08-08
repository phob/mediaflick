"use client"

import { Loader2 } from "lucide-react"

import { MediaBackdrop } from "./media-backdrop"
import { MediaDetails } from "./media-details"
import { SeasonList } from "./season-list"
import type { MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"
import { useMediaInfo } from "@/hooks/use-media-queries"

interface MediaInfoContentProps {
  id: string
  type: MediaType
}

export function MediaInfoContent({ id, type }: Readonly<MediaInfoContentProps>) {
  const tmdbId = Number(id)
  const { data: mediaInfo, isLoading, error, isStale } = useMediaInfo(tmdbId, type)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          {/* Show if data is being fetched from cache vs API */}
          <p className="text-sm text-muted-foreground">
            {isStale ? "Loading fresh data..." : "Loading..."}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Failed to load media info</p>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    )
  }

  if (!mediaInfo) {
    return <div className="p-4 text-center">Media not found</div>
  }

  return (
    <div className="relative -mt-16 min-h-screen w-full">
      <MediaBackdrop backdropPath={mediaInfo.backdropPath} />
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-24">
          <MediaDetails mediaInfo={mediaInfo} />
          {mediaInfo.mediaType === MediaTypeEnum.TvShows && (
            <SeasonList tmdbId={mediaInfo.tmdbId} mediaInfo={mediaInfo} />
          )}
        </div>
      </div>
    </div>
  )
} 