"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Trash2, RefreshCw, Info, AlertCircle } from "lucide-react"
import { fetchApi } from "@/lib/api/client"
import { MediaType } from "@/lib/api/types"
import { useInvalidateMediaCache } from "@/hooks/use-media-queries"
import { useToast } from "@/hooks/use-toast"

export function CacheManagement() {
  const [tmdbId, setTmdbId] = useState("")
  const [searchTitle, setSearchTitle] = useState("")
  const [searchMediaType, setSearchMediaType] = useState<MediaType>(MediaType.Movies)
  const [isLoading, setIsLoading] = useState(false)
  const [cacheStats, setCacheStats] = useState<Record<string, unknown> | null>(null)
  
  const { invalidateMovie, invalidateTvShow, invalidateSearch, invalidateAllMedia } = useInvalidateMediaCache()
  const { toast } = useToast()

  const handleInvalidateMovie = async () => {
    if (!tmdbId) return
    
    setIsLoading(true)
    try {
      await fetchApi(`/medialookup/cache/movies/${tmdbId}`, { method: "DELETE" })
      invalidateMovie(Number(tmdbId))
      toast({
        title: "Cache Cleared",
        description: `Movie cache cleared for TMDb ID: ${tmdbId}`,
      })
      setTmdbId("")
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear movie cache",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvalidateTvShow = async () => {
    if (!tmdbId) return
    
    setIsLoading(true)
    try {
      await fetchApi(`/medialookup/cache/tvshows/${tmdbId}`, { method: "DELETE" })
      invalidateTvShow(Number(tmdbId))
      toast({
        title: "Cache Cleared",
        description: `TV show cache cleared for TMDb ID: ${tmdbId}`,
      })
      setTmdbId("")
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear TV show cache",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvalidateSearch = async () => {
    if (!searchTitle) return
    
    setIsLoading(true)
    try {
      await fetchApi(`/medialookup/cache/search?title=${encodeURIComponent(searchTitle)}&mediaType=${searchMediaType}`, { 
        method: "DELETE" 
      })
      invalidateSearch(searchTitle, searchMediaType)
      toast({
        title: "Cache Cleared",
        description: `Search cache cleared for: ${searchTitle} (${searchMediaType})`,
      })
      setSearchTitle("")
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear search cache",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearAllCache = async () => {
    setIsLoading(true)
    try {
      // Clear both backend and frontend caches
      invalidateAllMedia()
      toast({
        title: "All Caches Cleared",
        description: "All media caches have been cleared",
        variant: "default",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear all caches",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetCacheStats = async () => {
    setIsLoading(true)
    try {
      const stats = await fetchApi<Record<string, unknown>>("/medialookup/cache/stats")
      setCacheStats(stats)
      toast({
        title: "Cache Stats Retrieved",
        description: "Cache statistics loaded successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to retrieve cache stats",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Cache Management</h2>
        <Badge variant="outline">Admin</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Individual Cache Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Specific Cache
            </CardTitle>
            <CardDescription>
              Clear cache for specific movies or TV shows by TMDb ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">TMDb ID</label>
              <Input
                placeholder="Enter TMDb ID (e.g., 550)"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                type="number"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleInvalidateMovie} 
                disabled={!tmdbId || isLoading}
                variant="outline"
                size="sm"
              >
                Clear Movie
              </Button>
              <Button 
                onClick={handleInvalidateTvShow} 
                disabled={!tmdbId || isLoading}
                variant="outline"
                size="sm"
              >
                Clear TV Show
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Cache Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Search Cache
            </CardTitle>
            <CardDescription>
              Clear cached search results for specific titles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Title</label>
              <Input
                placeholder="Enter search title"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Media Type</label>
              <Select value={searchMediaType} onValueChange={(value: MediaType) => setSearchMediaType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Movies">Movies</SelectItem>
                  <SelectItem value="TvShows">TV Shows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleInvalidateSearch} 
              disabled={!searchTitle || isLoading}
              variant="outline"
              size="sm"
            >
              Clear Search Cache
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Global Cache Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Global Cache Operations
          </CardTitle>
          <CardDescription>
            Operations that affect all cached data. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={handleClearAllCache} 
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              Clear All Caches
            </Button>
            <Button 
              onClick={handleGetCacheStats} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <Info className="h-4 w-4 mr-2" />
              Get Cache Stats
            </Button>
          </div>
          
          {cacheStats && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Cache Statistics</h4>
              <pre className="text-sm text-muted-foreground">
                {JSON.stringify(cacheStats, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache Information */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Information</CardTitle>
          <CardDescription>
            Understanding the caching system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2">
            <div className="flex justify-between">
              <span className="font-medium">Movies:</span>
              <Badge variant="outline">24 hours</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">TV Shows:</span>
              <Badge variant="outline">6 hours</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Seasons/Episodes:</span>
              <Badge variant="outline">2 hours</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Search Results:</span>
              <Badge variant="outline">1 hour</Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            Cache durations are optimized based on how frequently data changes.
            Clearing cache will force fresh data to be fetched from TMDb.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
