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

export interface EpisodeCardProps {
  tmdbId: number
  seasonNumber: number
  episodeNumber: number
  showTitle: string
  cardSize?: CardSize
}

const getImageUrlSync = (path: string, size: CardSize = "medium") => {
  if (!path) return "/placeholder-image.jpg"
  const imageSize = cardSizeConfig[size].imageSize
  return `https://image.tmdb.org/t/p/${imageSize}${path}`
}

export function EpisodeCard({
  tmdbId,
  seasonNumber,
  episodeNumber,
  showTitle,
  cardSize = "small",
}: Readonly<EpisodeCardProps>) {
  const router = useRouter()

  const { data: episodeInfo, isLoading, isFetching, isStale } = useQuery({
    queryKey: ["episode", tmdbId, seasonNumber, episodeNumber],
    queryFn: () => mediaApi.getTvEpisode(tmdbId, seasonNumber, episodeNumber),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const handleClick = () => {
    router.push(`/mediainfo?mediaType=TvShows&id=${tmdbId}`)
  }

  const config = cardSizeConfig[cardSize]

  return (
    <article>
      <Card
        onClick={handleClick}
        className={cn(
          "group relative overflow-hidden cursor-pointer",
          config.height,
          "border border-transparent ring-1 ring-white/10",
          "transition-transform duration-200",
          "[background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(to_bottom_right,rgba(255,255,255,0.2),transparent_50%)_border-box]",
          "[box-shadow:inset_-1px_-1px_1px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.1)]",
          "before:absolute before:inset-0 before:z-10 before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-black/30",
          "after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/5 after:via-transparent after:to-white/10",
          "hover:scale-[1.02] hover:shadow-xl"
        )}
        aria-label={`${showTitle} - S${seasonNumber}E${episodeNumber} - Click to view details`}
      >
        {episodeInfo?.stillPath && (
          <div className="absolute inset-0">
            <Image
              src={getImageUrlSync(episodeInfo.stillPath, cardSize)}
              alt={episodeInfo.name || `Episode ${episodeNumber}`}
              fill
              className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          </div>
        )}
        <CardHeader className="absolute z-20 flex flex-col items-start space-y-2">
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
        <CardContent className={cn("absolute bottom-0 z-20 w-full overflow-y-auto border-t border-border/50 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm", config.contentMaxHeight)}>
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
