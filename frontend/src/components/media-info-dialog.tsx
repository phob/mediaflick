"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { MediaType, MediaInfo, SeasonInfo } from '@/types/api'
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

interface MediaInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mediaType: MediaType
}

export function MediaInfoDialog({
  open,
  onOpenChange,
  mediaType
}: MediaInfoDialogProps) {
  const [loading, setLoading] = useState(true)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo[]>([])
  const { toast } = useToast()

  const getImageUrl = (path: string | null) => {
    if (!path) return null
    const cleanPath = path.startsWith('/') ? path.substring(1) : path
    return `/api/MediaLookup/images/${cleanPath}?size=w500`
  }

  const groupSeasons = (seasons: SeasonInfo[]) => {
    const regularSeasons = seasons.filter(s => s.seasonNumber > 0)
    const extras = seasons.filter(s => s.seasonNumber === 0)
    return { regularSeasons, extras }
  }

  useEffect(() => {
    if (open) {
      fetchMediaInfo()
    }
  }, [open, mediaType])

  const fetchMediaInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ScannedFiles?mediaType=${mediaType}&pageSize=100`)
      if (!response.ok) throw new Error('Failed to fetch media info')
      const data = await response.json()
      
      const itemsWithTmdbId = data.items.filter((item: any) => item.tmdbId)
      const uniqueTmdbIds = [...new Set(itemsWithTmdbId.map((item: any) => item.tmdbId))]
      
      const detailedInfo = await Promise.all(
        uniqueTmdbIds.map(async (tmdbId) => {
          const detailResponse = await fetch(`/api/MediaLookup/${mediaType === MediaType.Movies ? 'movies' : 'tvshows'}/${tmdbId}`)
          if (!detailResponse.ok) return null
          return detailResponse.json()
        })
      )

      setMediaInfo(detailedInfo.filter((info): info is MediaInfo => info !== null))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load media information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {mediaType === MediaType.Movies ? 'Movie' : 'TV Show'} Information
          </DialogTitle>
          <DialogDescription>
            Overview of your {mediaType === MediaType.Movies ? 'movies' : 'TV shows'} collection
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {mediaInfo.map((item) => (
                <Card key={item.tmdbId} className="flex flex-col md:flex-row gap-4 p-4">
                  {item.posterPath && (
                    <div className="relative w-[200px] h-[300px] shrink-0">
                      <Image
                        src={getImageUrl(item.posterPath)!}
                        alt={item.title}
                        fill
                        className="object-cover rounded-md"
                        sizes="200px"
                        unoptimized
                      />
                      {item.status?.toLowerCase() === 'ended' && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="destructive" className="opacity-90">
                            Ended
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <CardHeader>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>
                        {item.year} • {item.status}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                      {mediaType === MediaType.TvShows && item.seasons && (
                        <div className="mt-4">
                          {(() => {
                            const { regularSeasons, extras } = groupSeasons(item.seasons)
                            return (
                              <>
                                <h4 className="font-medium mb-2">
                                  Seasons: {regularSeasons.length}
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {regularSeasons.map((season) => (
                                    <div key={season.seasonNumber} className="text-sm">
                                      Season {season.seasonNumber}: {season.episodes.length} episodes
                                    </div>
                                  ))}
                                </div>
                                {extras.length > 0 && (
                                  <>
                                    <h4 className="font-medium mb-2 mt-4">Extras</h4>
                                    <div className="text-sm">
                                      {extras[0].episodes.length} special episodes
                                    </div>
                                  </>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 