import Image from "next/image"
import { useRouter } from "next/navigation"

import { Card, CardBody, CardHeader, Chip, Progress, Spinner } from "@nextui-org/react"

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

const getImageUrlSync = (path: string) => {
  if (!path) return "/placeholder-image.jpg"
  return `https://image.tmdb.org/t/p/w500${path}`
}

export function MediaCard({ media, mediaType, href }: MediaCardProps) {
  const router = useRouter()

  return (
    <Card
      key={media.tmdbId}
      className="group relative h-[400px] overflow-hidden border-[1px] border-transparent ring-1 ring-white/10 transition-transform duration-200 [background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(to_bottom_right,rgba(255,255,255,0.2),transparent_50%)_border-box] [box-shadow:inset_-1px_-1px_1px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.1)] before:absolute before:inset-0 before:z-10 before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-black/30 after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/5 after:via-transparent after:to-white/10 hover:scale-[1.02] hover:shadow-xl"
      isBlurred
      isPressable={!!href}
      onPress={() => href && router.push(href)}
      aria-label={`${media.mediaInfo?.Title || media.title}${media.mediaInfo?.Year ? ` (${media.mediaInfo.Year})` : ""} - Click to view details`}
      role="article"
    >
      {media.mediaInfo?.PosterPath && (
        <div className="absolute inset-0">
          <Image
            src={getImageUrlSync(media.mediaInfo.PosterPath)}
            alt={media.title}
            fill
            className="object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-[0.80]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
          />
        </div>
      )}
      <CardHeader className="absolute z-20 flex-col items-start">
        {mediaType === MediaTypeEnum.TvShows && media.mediaInfo?.Status && (
          <Chip
            size="sm"
            color={getStatusColor(media.mediaInfo.Status)}
            variant="shadow"
            className="mb-2 shadow-lg"
            aria-label={`Show status: ${media.mediaInfo.Status}`}
          >
            {media.mediaInfo.Status}
          </Chip>
        )}
        <h4 className="text-xl font-medium text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] hover:text-white">
          {media.mediaInfo?.Title || media.title}
        </h4>
        <p className="text-tiny text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {media.mediaInfo?.Year && `(${media.mediaInfo.Year})`}
        </p>
      </CardHeader>
      <CardBody className="[&::-webkit-scrollbar]:auto absolute bottom-0 z-20 max-h-[200px] overflow-y-auto border-t-1 border-default-600/50 bg-black/50 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm dark:border-default-100/50">
        {media.isLoading ? (
          <div className="flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : media.mediaInfo ? (
          <div className="flex flex-col gap-2">
            {media.mediaInfo.Genres && media.mediaInfo.Genres.length > 0 && (
              <p className="text-tiny text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                {media.mediaInfo.Genres.join(", ")}
              </p>
            )}
            {media.mediaInfo.Summary && (
              <p className="line-clamp-3 text-tiny text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                {media.mediaInfo.Summary}
              </p>
            )}
            {mediaType === MediaTypeEnum.TvShows && media.mediaInfo?.EpisodeCount && (
              <div className="mt-2">
                <Progress
                  size="lg"
                  radius="full"
                  classNames={{
                    base: "max-w-full",
                    track: "bg-default-200/20 drop-shadow-md border border-default-200/20",
                    label: "tracking-wider font-medium text-default-800",
                    value: "text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]",
                  }}
                  color={
                    (media.mediaInfo?.EpisodeCountScanned ?? 0) >= media.mediaInfo.EpisodeCount ? "primary" : "danger"
                  }
                  value={((media.mediaInfo?.EpisodeCountScanned ?? 0) / media.mediaInfo.EpisodeCount) * 100}
                  showValueLabel={true}
                  valueLabel={`${media.mediaInfo?.EpisodeCountScanned ?? 0} / ${media.mediaInfo.EpisodeCount}`}
                  aria-label={`Episodes scanned: ${media.mediaInfo?.EpisodeCountScanned ?? 0} out of ${media.mediaInfo.EpisodeCount} total episodes`}
                  isStriped={
                    (media.mediaInfo?.EpisodeCountScanned ?? 0) > 0 &&
                    (media.mediaInfo?.EpisodeCountScanned ?? 0) < media.mediaInfo.EpisodeCount
                  }
                />
              </div>
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
}
