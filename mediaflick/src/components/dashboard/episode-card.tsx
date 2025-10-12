"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { mediaApi } from "@/lib/api/endpoints"
import { type CardSize, cardSizeConfig } from "@/hooks/use-card-size"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { getImageUrl, CARD_BASE_CLASSES, CARD_HEADER_CLASSES, CARD_CONTENT_CLASSES } from "./card-utils"

export interface EpisodeCardProps {
  tmdbId: number
  seasonNumber: number
  episodeNumber: number
  showTitle: string
  href?: string
  cardSize?: CardSize
}

export function EpisodeCard({
  tmdbId,
  seasonNumber,
  episodeNumber,
  showTitle,
  href,
  cardSize = "small",
}: Readonly<EpisodeCardProps>) {
  const router = useRouter()

  const { data: episodeInfo, isLoading, isFetching, isStale } = useQuery({
    queryKey: ["episode", tmdbId, seasonNumber, episodeNumber],
    queryFn: () => mediaApi.getTvEpisode(tmdbId, seasonNumber, episodeNumber),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const handleClick = () => {
    if (href) {
      router.push(href)
    }
  }

  const config = cardSizeConfig[cardSize]

  return (
    <article>
      <Card
        onClick={handleClick}
        className={cn(CARD_BASE_CLASSES, config.height)}
        aria-label={`${showTitle} - S${seasonNumber}E${episodeNumber} - Click to view details`}
      >
        {episodeInfo?.stillPath && (
          <div className="absolute inset-0">
            <Image
              src={getImageUrl(episodeInfo.stillPath, cardSize)}
              alt={episodeInfo.name || `Episode ${episodeNumber}`}
              fill
              className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          </div>
        )}
        <CardHeader className={CARD_HEADER_CLASSES}>
          <Badge variant="secondary" className="shadow-lg">
            S{seasonNumber}E{episodeNumber}
          </Badge>
          <h4 className={cn(config.titleSize, "font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white")}>
            {showTitle}
          </h4>
          {episodeInfo?.name && (
            <p className="text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] line-clamp-2">
              {episodeInfo.name}
            </p>
          )}
          {isFetching && (
            <div className="absolute top-2 right-2">
              <LoadingIndicator
                isLoading={isLoading}
                isFetching={isFetching}
                isStale={isStale}
                size="sm"
                showText={false}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className={cn(CARD_CONTENT_CLASSES, config.contentMaxHeight)}>
          {isLoading ? (
            <div className="flex justify-center">
              <LoadingIndicator
                isLoading={isLoading}
                isFetching={isFetching}
                isStale={isStale}
                size="sm"
                showText={false}
              />
            </div>
          ) : episodeInfo?.overview ? (
            <p className="line-clamp-3 text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {episodeInfo.overview}
            </p>
          ) : (
            <p className="text-xs text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              No episode information available
            </p>
          )}
        </CardContent>
      </Card>
    </article>
  )
}
