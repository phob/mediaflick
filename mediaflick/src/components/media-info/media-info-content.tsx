"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { MediaBackdrop } from "./media-backdrop"
import { MediaDetails } from "./media-details"
import { SeasonList } from "./season-list"
import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo } from "@/lib/api/types"
import { MediaType } from "@/lib/api/types"

interface MediaInfoContentProps {
  id: string
  type: MediaType
}

export function MediaInfoContent({ id, type }: MediaInfoContentProps) {
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMediaInfo = async () => {
      if (!id || !type) return

      try {
        setLoading(true)
        const info =
          type === MediaType.Movies ? await mediaApi.getMovie(Number(id)) : await mediaApi.getTvShow(Number(id))
        setMediaInfo(info)
      } catch (error) {
        console.error("Failed to load media info:", error)
      } finally {
        setLoading(false)
      }
    }

    loadMediaInfo()
  }, [id, type])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!mediaInfo) {
    return <div className="p-4 text-center">Media not found</div>
  }

  return (
    <div className="relative -mt-16 min-h-screen w-full">
      <MediaBackdrop backdropPath={mediaInfo.BackdropPath} />
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-24">
          <MediaDetails mediaInfo={mediaInfo} />
          {mediaInfo.MediaType === MediaType.TvShows && (
            <SeasonList tmdbId={mediaInfo.TmdbId} mediaInfo={mediaInfo} />
          )}
        </div>
      </div>
    </div>
  )
} 