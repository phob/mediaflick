"use client"

import { useEffect, useState, Suspense, useMemo, useRef, useCallback } from "react"
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
import type { MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"
import { useCardSize, cardSizeConfig } from "@/hooks/use-card-size"
import { useTmdbList, usePrefetchMediaInfo } from "@/hooks/use-media-queries"

interface TmdbEntry {
  tmdbId: number
  title: string
}

// Helper function to normalize titles for sorting (ignore articles like "The", "A", "An")
function normalizeTitleForSorting(title: string): string {
  // Remove leading articles (case-insensitive) and trim
  return title.replace(/^(the|a|an)\s+/i, '').trim().toLowerCase()
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
  // Initialize display count based on search term and media type to avoid setState in effect
  const [displayCount, setDisplayCount] = useState(30)
  const [lastSearchTerm, setLastSearchTerm] = useState(searchTerm)
  const { cardSize, setCardSize, isLoaded } = useCardSize()
  const { prefetchMovie, prefetchTvShow } = usePrefetchMediaInfo()
  const observerTarget = useRef<HTMLDivElement>(null)
  const loadMoreSize = 30

  // Use React Query for the TMDB list
  const { data: tmdbData, isLoading, error } = useTmdbList(searchTerm, mediaType)

  // Save mediaType to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('selectedMediaType', mediaType)
  }, [mediaType])

  // Reset display count when search term changes (derived from state comparison)
  if (searchTerm !== lastSearchTerm) {
    setLastSearchTerm(searchTerm)
    setDisplayCount(30)
  }

  const handleMediaTypeChange = (value: MediaType) => {
    setMediaType(value)
    setDisplayCount(30) // Reset display count when changing media type
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

    // Sort entries by normalized title (ignoring articles like "The", "A", "An")
    entries.sort((a, b) => {
      const titleA = normalizeTitleForSorting(a.title)
      const titleB = normalizeTitleForSorting(b.title)
      return titleA.localeCompare(titleB)
    })

    // Prefetch media info for visible items and next batch to improve perceived performance
    entries.slice(0, displayCount + loadMoreSize).forEach((entry) => {
      if (mediaType === MediaTypeEnum.Movies) {
        prefetchMovie(entry.tmdbId)
      } else {
        prefetchTvShow(entry.tmdbId)
      }
    })

    return entries
  }, [tmdbData, mediaType, prefetchMovie, prefetchTvShow, displayCount, loadMoreSize])

  const visibleItems = uniqueMedia.slice(0, displayCount)
  const hasMore = displayCount < uniqueMedia.length

  // Load more items when user scrolls to bottom
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setDisplayCount(prev => prev + loadMoreSize)
    }
  }, [hasMore, isLoading, loadMoreSize])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, isLoading, loadMore])

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
            {visibleItems.map((media) => (
              <MediaCard
                key={media.tmdbId}
                media={media}
                mediaType={mediaType}
                href={`/mediainfo?id=${media.tmdbId}&type=${mediaType}`}
                cardSize={cardSize}
              />
            ))}
          </div>

          {/* Intersection observer target for infinite scroll */}
          <div ref={observerTarget} className="h-20 flex items-center justify-center">
            {hasMore && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Show count info */}
          <div className="text-center text-sm text-muted-foreground py-4">
            Showing {visibleItems.length} of {uniqueMedia.length} items
          </div>
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
