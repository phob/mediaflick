"use client"

import { useEffect, useState, Suspense, useMemo } from "react"
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


import { MediaCard, type UniqueMediaEntry } from "@/components/media-info/media-card"
import { MediaInfoContent as MediaInfoView } from "@/components/media-info/media-info-content"
import { CardSizeSelector } from "@/components/media-info/card-size-selector"
import { TablePagination } from "@/components/scanned-files-table/pagination"
import type { MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"
import { useCardSize, cardSizeConfig } from "@/hooks/use-card-size"
import { useTmdbList, usePrefetchMediaInfo } from "@/hooks/use-media-queries"

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
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>(
    (searchParams.get('mediaType') as MediaType) || MediaTypeEnum.Movies
  )
  const [page, setPage] = useState(1)
  const { cardSize, setCardSize, isLoaded } = useCardSize()
  const { prefetchMovie, prefetchTvShow } = usePrefetchMediaInfo()
  const pageSize = 20

  // Use React Query for the TMDB list
  const { data: tmdbData, isLoading, error } = useTmdbList(searchTerm, mediaType)

  // Save mediaType to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('selectedMediaType', mediaType)
  }, [mediaType])

  const handleMediaTypeChange = (value: MediaType) => {
    setMediaType(value)
    setPage(1) // Reset page when changing media type
    const params = new URLSearchParams(searchParams)
    params.set('mediaType', value)
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  // Convert TMDB data to UniqueMediaEntry format and prefetch media info
  const uniqueMedia: UniqueMediaEntry[] = useMemo(() => {
    if (!tmdbData) return []
    
    const entries = (tmdbData as unknown as TmdbEntry[]).map((entry) => ({
      tmdbId: entry.tmdbId,
      title: entry.title,
      isLoading: false, // We'll handle loading per-card now
    }))

    // Prefetch media info for visible items to improve perceived performance
    entries.slice(0, pageSize * 2).forEach((entry) => {
      if (mediaType === MediaTypeEnum.Movies) {
        prefetchMovie(entry.tmdbId)
      } else {
        prefetchTvShow(entry.tmdbId)
      }
    })

    return entries
  }, [tmdbData, mediaType, prefetchMovie, prefetchTvShow, pageSize])

  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPageItems = uniqueMedia.slice(startIndex, endIndex)
  const totalPages = Math.ceil(uniqueMedia.length / pageSize)

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <Input
            placeholder="Search for movies or TV shows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={mediaType}
            onValueChange={(value) => handleMediaTypeChange(value as MediaType)}
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
        {isLoaded && (
          <CardSizeSelector
            cardSize={cardSize}
            onCardSizeChange={setCardSize}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center p-4">
          <p className="text-destructive">Failed to load media list</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      ) : (
        <>
          <div className={`grid gap-4 ${isLoaded ? cardSizeConfig[cardSize].gridCols : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
            {currentPageItems.map((media) => (
              <MediaCard 
                key={media.tmdbId} 
                media={media} 
                mediaType={mediaType}
                href={`/mediainfo?id=${media.tmdbId}&type=${mediaType}`}
                cardSize={cardSize}
              />
            ))}
          </div>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
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
