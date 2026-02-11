import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Loader2, Calendar, CheckCircle2, Film, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo, SeasonInfo } from "@/lib/api/types"

// Cache for storing season data
const seasonCache = new Map<string, { data: SeasonInfo; timestamp: number }>()
const CACHE_DURATION = 1000 * 30 // 30 seconds

interface SeasonListProps {
  tmdbId: number
  mediaInfo: MediaInfo
}

export function SeasonList({ tmdbId, mediaInfo }: Readonly<SeasonListProps>) {
  const [loading, setLoading] = useState(false)
  const [seasons, setSeasons] = useState<SeasonInfo[]>([])

  useEffect(() => {
    const loadSeasons = async () => {
      if (!mediaInfo.seasonCount) return

      try {
        setLoading(true)
        const seasonNumbers = Array.from({ length: mediaInfo.seasonCount }, (_, i) => i + 1)
        const seasonMap = new Map<number, SeasonInfo>()

        // Process seasons in chunks to avoid overwhelming the API
        const chunkSize = 3
        for (let i = 0; i < seasonNumbers.length; i += chunkSize) {
          const chunk = seasonNumbers.slice(i, i + chunkSize)
          const promises = chunk.map(async (seasonNumber) => {
            const cacheKey = `${tmdbId}_${seasonNumber}`
            const cached = seasonCache.get(cacheKey)

            // Check cache first
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
              return cached.data
            }

            try {
              const response = await mediaApi.getTvSeason(tmdbId, seasonNumber)
              const seasonData = response as unknown as SeasonInfo

              // Update cache
              seasonCache.set(cacheKey, {
                data: seasonData,
                timestamp: Date.now(),
              })

              return seasonData
            } catch {
              return null
            }
          })

          const results = await Promise.all(promises)
          const validResults = results.filter((season): season is SeasonInfo => season !== null)

          // Add to map to ensure uniqueness and maintain order
          validResults.forEach((season) => {
            seasonMap.set(season.seasonNumber, season)
          })

          // Convert map to sorted array and update state
          const sortedSeasons = Array.from(seasonMap.values()).sort((a, b) => a.seasonNumber - b.seasonNumber)
          setSeasons(sortedSeasons)
        }
      } catch (error) {
        console.error("Failed to load seasons:", error)
      } finally {
        setLoading(false)
      }
    }

    // Reset seasons when tmdbId or seasonCount changes
    setSeasons([])
    loadSeasons()
  }, [mediaInfo.seasonCount, tmdbId])

  if (loading && seasons.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (seasons.length === 0) {
    return <div className="p-4 text-center">No seasons found</div>
  }

  return (
    <div className="container mx-auto mt-8">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Film className="h-6 w-6" />
        Seasons
      </h2>
      <div className="grid grid-cols-1 gap-6">
        {seasons.map((season) => (
          <Card
            key={season.seasonNumber}
            className="motion-safe:animate-fadeIn bg-card transition-transform"
          >
            <CardContent className="p-0">
              <Accordion type="single" collapsible>
                <AccordionItem value={`season-${season.seasonNumber}`}>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-4">
                      {season.posterPath && (
                        <div className="relative h-36 w-24 overflow-hidden rounded-xl shadow-lg transition-transform hover:scale-105">
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${season.posterPath}`}
                            alt={season.name}
                            fill
                            sizes="(min-width: 768px) 300px, 100vw"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">{season.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Film className="h-4 w-4" />
                            <span>
                              {season.episodeCountScanned} / {season.episodeCount} Episodes{" "}
                              {season.episodeCountScanned >= season.episodeCount ? (
                                <CheckCircle2 className="inline h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="inline h-4 w-4 text-destructive" />
                              )}
                            </span>
                          </div>
                          {season.airDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(season.airDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {season.overview || "No overview available"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[80px]"
                          asChild
                        >
                          <Link
                            href={`https://debridmediamanager.com/show/${mediaInfo.imdbId}/${season.seasonNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Info className="mr-2 h-4 w-4" />
                            DMM
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 px-6 py-4 md:grid-cols-2 lg:grid-cols-1">
                      {season.episodes.map((episode) => (
                        <Card
                          key={episode.episodeNumber}
                          className={cn(
                            "border-none bg-accent/20 transition-all hover:bg-accent/40"
                          )}
                        >
                          <CardContent className="flex flex-row gap-4 p-4">
                            {episode.stillPath && (
                              <div className="relative h-24 w-40 overflow-hidden rounded-xl shadow-md transition-transform hover:scale-105">
                                <Image
                                  src={`https://image.tmdb.org/t/p/w300${episode.stillPath}`}
                                  alt={episode.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-medium font-semibold">
                                  {episode.episodeNumber}. {episode.name}
                                </h4>
                                {episode.isScanned ? (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              {episode.airDate && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(episode.airDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {episode.overview || "No overview available"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
