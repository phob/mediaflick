import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Film, Heart, Info, Link2, PlayCircle, Star, Tag, Tv } from "lucide-react"

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
        <div className="motion-safe:animate-fadeIn relative aspect-[2/3] w-full overflow-hidden rounded-xl shadow-xl transition-transform hover:scale-[1.02] md:w-[300px]">
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
      <Card className="motion-safe:animate-fadeIn border-none bg-background/60 backdrop-blur-sm backdrop-saturate-150">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {mediaInfo.MediaType === MediaType.Movies ? (
                <Film className="h-6 w-6 text-primary" />
              ) : (
                <Tv className="h-6 w-6 text-primary" />
              )}
              <h1 className="text-3xl font-bold">{mediaInfo.Title}</h1>
            </div>
            {mediaInfo.Year && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <p>({mediaInfo.Year})</p>
              </div>
            )}
          </div>

          {mediaInfo.Genres && mediaInfo.Genres.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                <h3 className="text-medium font-semibold">Genres</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {mediaInfo.Genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="transition-transform hover:scale-105">
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {mediaInfo.ImdbId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                <h3 className="text-medium font-semibold">External Links</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-transform hover:scale-105"
                  asChild
                >
                  <Link
                    href={
                      mediaInfo.MediaType === MediaType.Movies
                        ? `https://debridmediamanager.com/movie/${mediaInfo.ImdbId}`
                        : `https://debridmediamanager.com/show/${mediaInfo.ImdbId}/1`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Info className="mr-2 h-4 w-4" />
                    DMM
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-transform hover:scale-105"
                  asChild
                >
                  <Link
                    href={`https://www.imdb.com/title/${mediaInfo.ImdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Star className="mr-2 h-4 w-4" />
                    IMDb
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {mediaInfo.Overview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                <h2 className="text-medium font-semibold">Overview</h2>
              </div>
              <p className="leading-relaxed text-muted-foreground">{mediaInfo.Overview}</p>
            </div>
          )}

          {mediaInfo.MediaType === MediaType.TvShows && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                <h2 className="text-medium font-semibold">Status</h2>
              </div>
              <div className="flex flex-col gap-2">
                <Badge 
                  variant={mediaInfo.Status === "Ended" ? "default" : "secondary"}
                  className="w-fit"
                >
                  {mediaInfo.Status}
                </Badge>
                {mediaInfo.EpisodeCount && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Film className="h-4 w-4" />
                    <p>
                      Total Episodes: {mediaInfo.EpisodeCountScanned ?? 0} / {mediaInfo.EpisodeCount}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
