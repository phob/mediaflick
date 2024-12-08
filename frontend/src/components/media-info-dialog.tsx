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
  const [selectedItem, setSelectedItem] = useState<MediaInfo | null>(null)
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
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) setSelectedItem(null)
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] w-full">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {mediaType === MediaType.Movies ? 'Movie' : 'TV Show'} Information
          </DialogTitle>
          <DialogDescription className="text-lg">
            Overview of your {mediaType === MediaType.Movies ? 'movies' : 'TV shows'} collection
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[75vh] pr-4">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
              {[...Array(20)].map((_, i) => (
                <Card key={i} className="cursor-pointer">
                  <Skeleton className="w-full aspect-[2/3] rounded-t-lg" />
                  <CardHeader className="p-2">
                    <Skeleton className="h-3 w-[100px]" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : selectedItem ? (
            <div className="animate-in slide-in-from-bottom duration-500">
              <Card className="flex flex-col md:flex-row gap-6 p-6">
                {selectedItem.posterPath && (
                  <div className="relative w-[300px] h-[450px] shrink-0 transition-transform duration-300 hover:scale-105">
                    <Image
                      src={getImageUrl(selectedItem.posterPath)!}
                      alt={selectedItem.title}
                      fill
                      className="object-cover rounded-lg shadow-lg"
                      sizes="300px"
                      unoptimized
                    />
                    {selectedItem.status?.toLowerCase() === 'ended' && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="destructive" className="opacity-90 text-sm px-3 py-1">
                          Ended
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 space-y-6">
                  <CardHeader className="p-0">
                    <CardTitle className="text-3xl font-bold">{selectedItem.title}</CardTitle>
                    <CardDescription className="text-lg mt-2">
                      {selectedItem.year} • {selectedItem.status}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-base leading-relaxed text-muted-foreground">{selectedItem.summary}</p>
                    {mediaType === MediaType.TvShows && selectedItem.seasons && (
                      <div className="mt-8">
                        {(() => {
                          const { regularSeasons, extras } = groupSeasons(selectedItem.seasons)
                          return (
                            <>
                              <h4 className="text-xl font-semibold mb-4">
                                Seasons: {regularSeasons.length}
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {regularSeasons.map((season) => (
                                  <div key={season.seasonNumber} 
                                    className="text-sm bg-secondary/50 rounded-lg p-3 hover:bg-secondary/70 transition-colors">
                                    Season {season.seasonNumber}: {season.episodes.length} episodes
                                  </div>
                                ))}
                              </div>
                              {extras.length > 0 && (
                                <>
                                  <h4 className="text-xl font-semibold mb-4 mt-6">Extras</h4>
                                  <div className="text-sm bg-secondary/50 rounded-lg p-3">
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
                  <CardFooter className="p-0 mt-6">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="flex items-center gap-2 text-base text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 19-7-7 7-7"/>
                        <path d="M19 12H5"/>
                      </svg>
                      Back to list
                    </button>
                  </CardFooter>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
              {mediaInfo.map((item) => (
                <Card 
                  key={item.tmdbId} 
                  className="group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => setSelectedItem(item)}
                >
                  {item.posterPath && (
                    <div className="relative w-full aspect-[2/3] overflow-hidden rounded-t-lg">
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 z-10" />
                      <Image
                        src={getImageUrl(item.posterPath)!}
                        alt={item.title}
                        fill
                        className="object-contain transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16.66vw, (max-width: 1280px) 12.5vw, 10vw"
                        unoptimized
                      />
                      {item.status?.toLowerCase() === 'ended' && (
                        <div className="absolute top-1 right-1 z-20">
                          <Badge variant="destructive" className="opacity-90 text-xs px-1">
                            Ended
                          </Badge>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                        <p className="text-white text-xs">View details</p>
                      </div>
                    </div>
                  )}
                  <CardHeader className="p-2">
                    <CardTitle className="text-sm truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {item.year}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 