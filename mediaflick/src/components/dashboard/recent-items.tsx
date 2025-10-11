"use client"

import { useQuery } from "@tanstack/react-query"
import { MediaCard } from "@/components/media-info/media-card"
import { EpisodeCard } from "./episode-card"
import { mediaApi } from "@/lib/api/endpoints"
import { MediaType } from "@/lib/api/types"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Film, Tv } from "lucide-react"

export interface RecentItemsProps {
  mediaType: MediaType
  title: string
  limit?: number
}

type MovieItem = {
  tmdbId: number
  title: string
}

type EpisodeItem = {
  tmdbId: number
  title: string
  seasonNumber: number
  episodeNumber: number
}

export function RecentItems({ mediaType, title, limit = 10 }: Readonly<RecentItemsProps>) {
  const { data, isLoading, isFetching, isStale } = useQuery<MovieItem[] | EpisodeItem[]>({
    queryKey: ["recentItems", mediaType, limit],
    queryFn: async () => {
      const result = await mediaApi.getScannedFiles({
        mediaType,
        page: 1,
        pageSize: limit,
        sortBy: "createdAt",
        sortOrder: "desc",
      })

      if (mediaType === MediaType.Movies) {
        // For movies, extract unique media items
        const uniqueMedia = new Map<number, MovieItem>()
        result.items.forEach(item => {
          if (item.tmdbId && item.title && !uniqueMedia.has(item.tmdbId)) {
            uniqueMedia.set(item.tmdbId, {
              tmdbId: item.tmdbId,
              title: item.title,
            })
          }
        })
        return Array.from(uniqueMedia.values()).slice(0, limit)
      } else {
        // For TV shows, return individual episodes
        return result.items
          .filter(item => item.tmdbId && item.seasonNumber && item.episodeNumber)
          .slice(0, limit)
          .map(item => ({
            tmdbId: item.tmdbId!,
            title: item.title || "Unknown Show",
            seasonNumber: item.seasonNumber!,
            episodeNumber: item.episodeNumber!,
          }))
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const Icon = mediaType === MediaType.Movies ? Film : Tv

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <LoadingIndicator
              isLoading={isLoading}
              isFetching={isFetching}
              isStale={isStale}
              size="md"
              showText={true}
            />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            No {mediaType.toLowerCase()} found
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {mediaType === MediaType.Movies ? (
              (data as MovieItem[]).map((item) => (
                <MediaCard
                  key={item.tmdbId}
                  media={{
                    tmdbId: item.tmdbId,
                    title: item.title,
                    isLoading: false,
                  }}
                  mediaType={mediaType}
                  href={`/mediainfo?mediaType=${mediaType}&id=${item.tmdbId}`}
                  cardSize="small"
                />
              ))
            ) : (
              (data as EpisodeItem[]).map((item) => (
                <EpisodeCard
                  key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                  tmdbId={item.tmdbId}
                  seasonNumber={item.seasonNumber}
                  episodeNumber={item.episodeNumber}
                  showTitle={item.title}
                  cardSize="small"
                />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
