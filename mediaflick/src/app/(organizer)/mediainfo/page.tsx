"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"

import { Card, CardBody, CardHeader, Chip, Input, Pagination, Select, SelectItem, Spinner } from "@nextui-org/react"

import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo, MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"

interface UniqueMediaEntry {
  tmdbId: number
  title: string
  mediaInfo?: MediaInfo
  isLoading: boolean
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "ended":
      return "default"
    case "returning series":
      return "success"
    case "in production":
      return "warning"
    case "planned":
      return "primary"
    case "canceled":
      return "danger"
    case "pilot":
      return "warning"
    default:
      return "default"
  }
}

export default function MediaInfo() {
  const [searchTerm, setSearchTerm] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>(MediaTypeEnum.Movies)
  const [loading, setLoading] = useState(true)
  const [uniqueMedia, setUniqueMedia] = useState<UniqueMediaEntry[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 20

  const loadUniqueMedia = useCallback(async () => {
    try {
      setLoading(true)
      const entries = await mediaApi.getTmdbIdsAndTitles({ searchTerm, mediaType })
      console.log("Initial entries:", entries)

      setUniqueMedia(
        entries.map((entry) => ({
          tmdbId: entry.tmdbId,
          title: entry.title,
          isLoading: true,
        }))
      )

      const detailedEntries = await Promise.all(
        entries.map(async (entry) => {
          try {
            const info =
              mediaType === MediaTypeEnum.Movies
                ? await mediaApi.getMovie(entry.tmdbId)
                : await mediaApi.getTvShow(entry.tmdbId)

            console.log(`Detailed info for ${entry.title}:`, info)

            return {
              tmdbId: entry.tmdbId,
              title: entry.title,
              mediaInfo: info,
              isLoading: false,
            }
          } catch (error) {
            console.error(`Failed to load details for ${entry.title}:`, error)
            return {
              tmdbId: entry.tmdbId,
              title: entry.title,
              isLoading: false,
            }
          }
        })
      )
      setUniqueMedia(detailedEntries)
    } catch (error) {
      console.error("Failed to load media:", error)
      setUniqueMedia([])
    } finally {
      setLoading(false)
    }
  }, [searchTerm, mediaType])

  useEffect(() => {
    loadUniqueMedia()
  }, [loadUniqueMedia])

  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPageItems = uniqueMedia.slice(startIndex, endIndex)
  const totalPages = Math.ceil(uniqueMedia.length / pageSize)

  const getImageUrlSync = (path: string) => {
    if (!path) return "/placeholder-image.jpg"
    return `https://image.tmdb.org/t/p/w500${path}`
  }

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="mb-4 flex gap-4">
        <Input
          label="Search"
          placeholder="Search for movies or TV shows..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-xs"
        />
        <Select
          label="Media Type"
          selectedKeys={[mediaType]}
          className="max-w-xs"
          onChange={(e) => setMediaType(e.target.value as MediaType)}
        >
          <SelectItem key={MediaTypeEnum.Movies} value={MediaTypeEnum.Movies}>
            Movies
          </SelectItem>
          <SelectItem key={MediaTypeEnum.TvShows} value={MediaTypeEnum.TvShows}>
            TV Shows
          </SelectItem>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {currentPageItems.map((media) => {
              return (
                <Card
                  key={media.tmdbId}
                  className="group relative h-[400px] overflow-hidden border-[1px] border-transparent ring-1 ring-white/10 transition-transform duration-200 [background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(to_bottom_right,rgba(255,255,255,0.2),transparent_50%)_border-box] [box-shadow:inset_-1px_-1px_1px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.1)] before:absolute before:inset-0 before:z-10 before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-black/30 after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/5 after:via-transparent after:to-white/10 hover:scale-[1.02] hover:shadow-xl"
                  isBlurred
                >
                  {media.mediaInfo?.posterPath && (
                    <div className="absolute inset-0">
                      <Image
                        src={getImageUrlSync(media.mediaInfo.posterPath)}
                        alt={media.title}
                        fill
                        className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={page === 1}
                      />
                    </div>
                  )}
                  <CardHeader className="absolute z-20 flex-col items-start">
                    {mediaType === MediaTypeEnum.TvShows && media.mediaInfo?.status && (
                      <Chip
                        size="sm"
                        color={getStatusColor(media.mediaInfo.status)}
                        variant="shadow"
                        className="mb-2 shadow-lg"
                      >
                        {media.mediaInfo.status}
                      </Chip>
                    )}
                    <h4 className="text-xl font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white">
                      {media.mediaInfo?.title || media.title}
                    </h4>
                    <p className="text-tiny text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                      {media.mediaInfo?.year && `(${media.mediaInfo.year})`}
                    </p>
                  </CardHeader>
                  <CardBody className="absolute bottom-0 z-20 border-t-1 border-default-600/50 bg-black/50 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm dark:border-default-100/50">
                    {media.isLoading ? (
                      <div className="flex justify-center">
                        <Spinner size="sm" />
                      </div>
                    ) : media.mediaInfo ? (
                      <div className="flex flex-col gap-2">
                        {media.mediaInfo.genres && media.mediaInfo.genres.length > 0 && (
                          <p className="text-tiny text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                            {media.mediaInfo.genres.join(", ")}
                          </p>
                        )}
                        {media.mediaInfo.summary && (
                          <p className="line-clamp-3 text-tiny text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                            {media.mediaInfo.summary}
                          </p>
                        )}
                        {mediaType === MediaTypeEnum.TvShows && media.mediaInfo.seasons && (
                          <p className="text-tiny text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                            Seasons: {media.mediaInfo.seasons.length}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-tiny text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                        No additional information available
                      </p>
                    )}
                  </CardBody>
                </Card>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination total={totalPages} page={page} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
