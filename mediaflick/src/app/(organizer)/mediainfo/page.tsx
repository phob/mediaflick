"use client"

import { useCallback, useEffect, useState } from "react"

import { Input, Pagination, Select, SelectItem, Spinner } from "@nextui-org/react"

import { MediaCard, type UniqueMediaEntry } from "@/components/media-info/media-card"
import { mediaApi } from "@/lib/api/endpoints"
import type { MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"

interface TmdbEntry {
  tmdbId: number
  title: string
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
      const response = await mediaApi.getTmdbIdsAndTitles({ searchTerm, mediaType })
      const entries = response as unknown as TmdbEntry[]
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

            return {
              tmdbId: entry.tmdbId,
              title: entry.title,
              mediaInfo: info,
              isLoading: false,
            }
          } catch {
            return {
              tmdbId: entry.tmdbId,
              title: entry.title,
              isLoading: false,
            }
          }
        })
      )
      setUniqueMedia(detailedEntries)
    } catch {
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
            {currentPageItems.map((media) => (
              <MediaCard key={media.tmdbId} media={media} mediaType={mediaType} />
            ))}
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
