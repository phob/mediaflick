import Image from "next/image"
import { useEffect, useState } from "react"

import { Accordion, AccordionItem, Button, Card, CardBody, Link, Spinner } from "@nextui-org/react"

import { mediaApi } from "@/lib/api/endpoints"
import type { MediaInfo, SeasonInfo } from "@/lib/api/types"

// Cache for storing season data
const seasonCache = new Map<string, { data: SeasonInfo; timestamp: number }>()
const CACHE_DURATION = 1000 * 30 // 30 seconds

interface SeasonListProps {
  tmdbId: number
  mediaInfo: MediaInfo
}

export function SeasonList({ tmdbId, mediaInfo }: SeasonListProps) {
  const [loading, setLoading] = useState(false)
  const [seasons, setSeasons] = useState<SeasonInfo[]>([])

  useEffect(() => {
    const loadSeasons = async () => {
      if (!mediaInfo.SeasonCount) return

      try {
        setLoading(true)
        const seasonNumbers = Array.from({ length: mediaInfo.SeasonCount }, (_, i) => i + 1)
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
            seasonMap.set(season.SeasonNumber, season)
          })

          // Convert map to sorted array and update state
          const sortedSeasons = Array.from(seasonMap.values()).sort((a, b) => a.SeasonNumber - b.SeasonNumber)
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
  }, [mediaInfo.SeasonCount, tmdbId])

  if (loading && seasons.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    )
  }

  if (seasons.length === 0) {
    return <div className="p-4 text-center">No seasons found</div>
  }

  return (
    <div className="container mx-auto mt-8">
      <h2 className="mb-4 text-2xl font-bold">Seasons</h2>
      <div className="grid grid-cols-1 gap-4">
        {seasons.map((season) => (
          <Card key={season.SeasonNumber} className="bg-content1">
            <CardBody>
              <Accordion variant="splitted" className="px-0">
                <AccordionItem
                  key={season.SeasonNumber}
                  aria-label={`Season ${season.SeasonNumber}`}
                  title={
                    <div className="flex items-center gap-4">
                      {season.PosterPath && (
                        <div className="relative h-32 w-24 overflow-hidden rounded-lg">
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${season.PosterPath}`}
                            alt={season.Name}
                            fill
                            sizes="(min-width: 768px) 300px, 100vw"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-white">{season.Name}</h3>
                        <p className="text-small text-default-500 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                          {season.Episodes.length} Episodes {season.Episodes.filter(e => e.IsScanned).length >= season.Episodes.length ? "✅" : "❌"}
                        </p>
                        <p className="text-small text-default-500 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                          {season.AirDate ? new Date(season.AirDate).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="line-clamp-3 text-small text-default-500 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                          {season.Overview}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="bordered"
                          color="primary"
                          size="sm"
                          className="p-0"
                          as={Link}
                          href={`https://debridmediamanager.com/show/${mediaInfo.ImdbId}/${season.SeasonNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          DMM
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div className="grid gap-4 px-2 py-4 md:grid-cols-2 lg:grid-cols-1">
                    {season.Episodes.map((episode) => (
                      <Card key={episode.EpisodeNumber} className="border-none bg-content2/40">
                        <CardBody className="flex flex-row gap-4">
                          {episode.StillPath && (
                            <div className="relative h-24 w-40 overflow-hidden rounded-lg">
                              <Image
                                src={`https://image.tmdb.org/t/p/w300${episode.StillPath}`}
                                alt={episode.Name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold">
                              {episode.EpisodeNumber}. {episode.Name} (
                              {episode.AirDate ? new Date(episode.AirDate).toLocaleDateString() : ""}) 
                              {episode.IsScanned ? "✅" : "❌"}
                            </h4>
                            <p className="line-clamp-3 text-small text-default-500">{episode.Overview}</p>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </AccordionItem>
              </Accordion>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
