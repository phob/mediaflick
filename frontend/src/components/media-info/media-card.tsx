import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

import type { MediaInfo, MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"
import { type CardSize, cardSizeConfig } from "@/hooks/use-card-size"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { useQuery } from "@tanstack/react-query"
import { mediaApi } from "@/lib/api/endpoints"
import { getTmdbImageUrl } from "@/lib/utils/image"

export interface UniqueMediaEntry {
  tmdbId: number
  title: string
  mediaInfo?: MediaInfo
  isLoading: boolean
}

export interface MediaCardProps {
  media: UniqueMediaEntry
  mediaType: MediaType
  href?: string
  cardSize?: CardSize
  // Episode-specific fields
  seasonNumber?: number
  episodeNumber?: number
  showTitle?: string
}

const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (status.toLowerCase()) {
    case "ended":
      return "default"
    case "returning series":
      return "secondary"
    case "in production":
      return "outline"
    case "planned":
      return "outline"
    case "canceled":
      return "destructive"
    case "pilot":
      return "outline"
    default:
      return "default"
  }
}

const getImageUrlSync = (path: string, size: CardSize = "medium") => {
  const imageSize = cardSizeConfig[size].imageSize
  return getTmdbImageUrl(path, imageSize)
}

export function MediaCard({ media, mediaType, href, cardSize = "medium", seasonNumber, episodeNumber, showTitle }: Readonly<MediaCardProps>) {
  const router = useRouter()
  const isEpisode = seasonNumber !== undefined && episodeNumber !== undefined

  // Fetch media info (for movies/shows) - only when not an episode
  const mediaInfoQuery = useQuery({
    queryKey: mediaType === MediaTypeEnum.Movies ? ["media", "movies", media.tmdbId] : ["media", "tvshows", media.tmdbId],
    queryFn: () => mediaType === MediaTypeEnum.Movies ? mediaApi.getMovie(media.tmdbId) : mediaApi.getTvShow(media.tmdbId),
    staleTime: mediaType === MediaTypeEnum.Movies ? 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000,
    gcTime: mediaType === MediaTypeEnum.Movies ? 7 * 24 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000,
    enabled: !isEpisode && !!media.tmdbId,
  })

  // Fetch episode info (for episodes)
  const episodeInfoQuery = useQuery({
    queryKey: ["episode", media.tmdbId, seasonNumber, episodeNumber],
    queryFn: () => mediaApi.getTvEpisode(media.tmdbId, seasonNumber!, episodeNumber!),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: isEpisode,
  })

  const mediaInfo = mediaInfoQuery.data
  const episodeInfo = episodeInfoQuery.data
  const isLoading = isEpisode ? episodeInfoQuery.isLoading : mediaInfoQuery.isLoading
  const isFetching = isEpisode ? episodeInfoQuery.isFetching : mediaInfoQuery.isFetching
  const isStale = isEpisode ? episodeInfoQuery.isStale : mediaInfoQuery.isStale

  const handleClick = () => {
    if (href) {
      router.push(href)
    }
  }

  const getProgressColor = () => {
    return (mediaInfo?.episodeCountScanned ?? 0) >= (mediaInfo?.episodeCount ?? 0)
      ? "bg-primary/20"
      : "bg-destructive/20"
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center">
          <LoadingIndicator
            isLoading={isLoading}
            isFetching={isFetching}
            isStale={isStale}
            size="sm"
            showText={false}
          />
        </div>
      )
    }

    // Episode content
    if (isEpisode && episodeInfo) {
      return (
        <div className="flex flex-col gap-2">
          {episodeInfo.overview ? (
            <p className="line-clamp-3 text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {episodeInfo.overview}
            </p>
          ) : (
            <p className="text-xs text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              No episode information available
            </p>
          )}
        </div>
      )
    }

    // Movie/Show content
    if (mediaInfo) {
      return (
        <div className="flex flex-col gap-2">
          {mediaInfo.genres && mediaInfo.genres.length > 0 && (
            <p className="text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {mediaInfo.genres.join(", ")}
            </p>
          )}
          {mediaInfo.summary && (
            <p className="line-clamp-3 text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {mediaInfo.summary}
            </p>
          )}
          {mediaType === MediaTypeEnum.TvShows && mediaInfo?.episodeCount && (
            <div className="mt-2">
              <Progress
                value={((mediaInfo?.episodeCountScanned ?? 0) / mediaInfo.episodeCount) * 100}
                className={cn("h-2", getProgressColor())}
              />
              <p className="mt-1 text-[10px] font-bold text-white text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                {mediaInfo?.episodeCountScanned ?? 0} / {mediaInfo.episodeCount} Episodes
              </p>
            </div>
          )}
        </div>
      )
    }

    return (
      <p className="text-xs text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        No additional information available
      </p>
    )
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
        aria-label={
          isEpisode
            ? `${showTitle} - S${seasonNumber}E${episodeNumber} - Click to view details`
            : [
                mediaInfo?.title ?? media.title,
                mediaInfo?.year ? `(${mediaInfo.year})` : null,
                "- Click to view details"
              ].filter(Boolean).join(" ")
        }
      >
        {isEpisode ? (
          episodeInfo?.stillPath && (
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
          )
        ) : (
          mediaInfo?.posterPath && (
            <div className="absolute inset-0">
              <Image
                src={getImageUrlSync(mediaInfo.posterPath, cardSize)}
                alt={media.title}
                fill
                className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
            </div>
          )
        )}
        <CardHeader className="absolute top-0 left-0 z-20 flex flex-col items-start space-y-2 px-3 py-3 w-full pr-12">
          {isEpisode ? (
            <>
              <Badge variant="secondary" className="shadow-lg">
                S{seasonNumber}E{episodeNumber}
              </Badge>
              <h4 className={cn(config.titleSize, "font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white break-words hyphens-auto")}>
                {showTitle}
              </h4>
              {episodeInfo?.name && (
                <p className="text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] line-clamp-2">
                  {episodeInfo.name}
                </p>
              )}
            </>
          ) : (
            <>
              {mediaType === MediaTypeEnum.TvShows && mediaInfo?.status && (
                <Badge
                  variant={getStatusColor(mediaInfo.status)}
                  className="shadow-lg"
                  aria-label={`Show status: ${mediaInfo.status}`}
                >
                  {mediaInfo.status}
                </Badge>
              )}
              <h4 className={cn(config.titleSize, "font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white break-words hyphens-auto")}>
                {mediaInfo?.title ?? media.title} {mediaInfo?.year && `(${mediaInfo.year})`}
              </h4>
            </>
          )}
          {/* Show cache status indicator */}
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
          {renderContent()}
        </CardContent>
      </Card>
    </article>
  )
}
