"use client"

import { useCallback, useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

import { MediaCard, type UniqueMediaEntry } from "@/components/media-info/media-card"
import { MediaInfoContent as MediaInfoView } from "@/components/media-info/media-info-content"
import { mediaApi } from "@/lib/api/endpoints"
import type { MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"

interface TmdbEntry {
  tmdbId: number
  title: string
}

function MediaInfoContent() {
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')
  const type = searchParams.get('type') as MediaType || MediaTypeEnum.Movies
  
  if (selectedId) {
    return <MediaInfoView id={selectedId} type={type} />
  }
  return <MediaGrid />
}

function MediaGrid() {
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
          placeholder="Search for movies or TV shows..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={mediaType}
          onValueChange={(value) => setMediaType(value as MediaType)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Media Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MediaTypeEnum.Movies}>Movies</SelectItem>
            <SelectItem value={MediaTypeEnum.TvShows}>TV Shows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {currentPageItems.map((media) => (
              <MediaCard 
                key={media.tmdbId} 
                media={media} 
                mediaType={mediaType}
                href={`/mediainfo?id=${media.tmdbId}&type=${mediaType}`}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      aria-disabled={page === 1}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      aria-disabled={page === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function MediaInfoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <MediaInfoContent />
    </Suspense>
  )
}
