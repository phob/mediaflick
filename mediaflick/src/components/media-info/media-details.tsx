import Image from "next/image"

import { Card, CardBody, Chip } from "@nextui-org/react"

import type { MediaInfo } from "@/lib/api/types"
import { MediaType } from "@/lib/api/types"

interface MediaDetailsProps {
  mediaInfo: MediaInfo
}

export function MediaDetails({ mediaInfo }: MediaDetailsProps) {
  return (
    <div className="container mx-auto grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
      {/* Poster */}
      {mediaInfo.PosterPath && (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl md:w-[300px]">
          <Image
            src={`https://image.tmdb.org/t/p/w500${mediaInfo.PosterPath}`}
            alt={mediaInfo.Title}
            fill
            sizes="(min-width: 768px) 300px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Details */}
      <Card className="border-none bg-background/60 backdrop-blur-sm backdrop-saturate-150">
        <CardBody className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{mediaInfo.Title}</h1>
            {mediaInfo.Year && <p className="text-default-500">({mediaInfo.Year})</p>}
          </div>

          {mediaInfo.Genres && mediaInfo.Genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mediaInfo.Genres.map((genre) => (
                <Chip key={genre} variant="flat">
                  {genre}
                </Chip>
              ))}
            </div>
          )}
          {mediaInfo.ImdbId && (
            <div>
              <h3 className="mb-2 text-xl font-semibold">IMDb ID:</h3>
              <p className="text-default-500">
                {mediaInfo.MediaType === MediaType.Movies ? (
                  <a href={`https://debridmediamanager.com/movie/${mediaInfo.ImdbId}`} target="_blank" rel="noopener noreferrer">
                    {mediaInfo.ImdbId}
                  </a>
                ) : (
                  <a href={`https://debridmediamanager.com/show/${mediaInfo.ImdbId}/1`} target="_blank" rel="noopener noreferrer">
                    {mediaInfo.ImdbId}
                  </a>
                )}
              </p>
            </div>
          )}
          {mediaInfo.Overview && (
            <div>
              <h2 className="mb-2 text-xl font-semibold">Overview</h2>
              <p className="text-default-500">{mediaInfo.Overview}</p>
            </div>
          )}

          {mediaInfo.MediaType === MediaType.TvShows && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Status</h2>
              <Chip variant="flat" color={mediaInfo.Status === "Ended" ? "default" : "success"}>
                {mediaInfo.Status}
              </Chip>
              {mediaInfo.EpisodeCount && (
                <p className="text-default-500">
                  Total Episodes: {mediaInfo.EpisodeCountScanned ?? 0} / {mediaInfo.EpisodeCount}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
