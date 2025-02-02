import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

import type { MediaInfo, MediaType } from "@/lib/api/types"
import { MediaType as MediaTypeEnum } from "@/lib/api/types"

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

const getImageUrlSync = (path: string) => {
  if (!path) return "/placeholder-image.jpg"
  return `https://image.tmdb.org/t/p/w500${path}`
}

export function MediaCard({ media, mediaType, href }: Readonly<MediaCardProps>) {
  const router = useRouter()
  console.log(media)
  const handleClick = () => {
    if (href) {
      router.push(href)
    }
  }

  const getProgressColor = () => {
    return (media.mediaInfo?.episodeCountScanned ?? 0) >= (media.mediaInfo?.episodeCount ?? 0)
      ? "bg-primary/20"
      : "bg-destructive/20"
  }

  const renderContent = () => {
    if (media.isLoading) {
      return (
        <div className="flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )
    }

    if (media.mediaInfo) {
      return (
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
          {mediaType === MediaTypeEnum.TvShows && media.mediaInfo?.episodeCount && (
            <div className="mt-2">
              <Progress
                value={((media.mediaInfo?.episodeCountScanned ?? 0) / media.mediaInfo.episodeCount) * 100}
                className={cn("h-2", getProgressColor())}
              />
              <p className="mt-1 text-[10px] font-bold text-white text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                {media.mediaInfo?.episodeCountScanned ?? 0} / {media.mediaInfo.episodeCount} Episodes
              </p>
            </div>
          )}
        </div>
      )
    }

    return (
      <p className="text-tiny text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        No additional information available
      </p>
    )
  }

  return (
    <article>
      <Card
        onClick={handleClick}
        className={cn(
          "group relative h-[400px] overflow-hidden cursor-pointer",
          "border-[1px] border-transparent ring-1 ring-white/10",
          "transition-transform duration-200",
          "[background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(to_bottom_right,rgba(255,255,255,0.2),transparent_50%)_border-box]",
          "[box-shadow:inset_-1px_-1px_1px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.1)]",
          "before:absolute before:inset-0 before:z-10 before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-black/30",
          "after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/5 after:via-transparent after:to-white/10",
          "hover:scale-[1.02] hover:shadow-xl"
        )}
        aria-label={[
          media.mediaInfo?.title ?? media.title,
          media.mediaInfo?.year ? `(${media.mediaInfo.year})` : null,
          "- Click to view details"
        ].filter(Boolean).join(" ")}
      >
        {media.mediaInfo?.posterPath && (
          <div className="absolute inset-0">
            <Image
              src={getImageUrlSync(media.mediaInfo.posterPath)}
              alt={media.title}
              fill
              className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          </div>
        )}
        <CardHeader className="absolute z-20 flex flex-col items-start space-y-2">
          {mediaType === MediaTypeEnum.TvShows && media.mediaInfo?.status && (
            <Badge
              variant={getStatusColor(media.mediaInfo.status)}
              className="shadow-lg"
              aria-label={`Show status: ${media.mediaInfo.status}`}
            >
              {media.mediaInfo.status}
            </Badge>
          )}
          <h4 className="text-xl font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white">
            {media.mediaInfo?.title ?? media.title}
          </h4>
          <p className="text-tiny text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            {media.mediaInfo?.year && `(${media.mediaInfo.year})`}
          </p>
        </CardHeader>
        <CardContent className="absolute bottom-0 z-20 max-h-[200px] w-full overflow-y-auto border-t-1 border-default-600/50 bg-black/50 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm dark:border-default-100/50">
          {renderContent()}
        </CardContent>
      </Card>
    </article>
  )
}
