"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Spinner } from "@nextui-org/react"

import { MediaBackdrop } from "@/components/media-info/media-backdrop"
import { MediaDetails } from "@/components/media-info/media-details"
import { SeasonList } from "@/components/media-info/season-list"
import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo } from "@/lib/api/types"
import { MediaType } from "@/lib/api/types"

export default function MediaInfoPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const mediaType = searchParams.get("type") as MediaType
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMediaInfo = async () => {
      if (!id || !mediaType) return

      try {
        setLoading(true)
        const info =
          mediaType === MediaType.Movies ? await mediaApi.getMovie(Number(id)) : await mediaApi.getTvShow(Number(id))
        setMediaInfo(info)
        console.log(info)
      } catch (error) {
        console.error("Failed to load media info:", error)
      } finally {
        setLoading(false)
      }
    }

    loadMediaInfo()
  }, [id, mediaType])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
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
