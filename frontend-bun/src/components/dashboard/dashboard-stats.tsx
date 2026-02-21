"use client"

import { useQuery } from "@tanstack/react-query"
import { Film, Tv, FileVideo, HardDrive } from "lucide-react"
import { StatCard } from "./stat-card"
import { mediaApi } from "@/lib/api/endpoints"
import { MediaType } from "@/lib/api/types"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

export function DashboardStats() {
  const { data: stats, isLoading: isLoadingStats, isFetching: isFetchingStats, isStale: isStaleStats } = useQuery({
    queryKey: ["scannedFileStats"],
    queryFn: () => mediaApi.getScannedFileStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: tvShowCount, isLoading: isLoadingTvShows } = useQuery({
    queryKey: ["uniqueTvShowCount"],
    queryFn: async () => {
      const result = await mediaApi.getScannedFiles({
        mediaType: MediaType.TvShows,
        page: 1,
        pageSize: 1,
      })

      // The backend doesn't return unique show count directly, so we need to fetch all TV shows
      // and count unique tmdbIds. For efficiency, we'll fetch a large page size.
      const fullResult = await mediaApi.getScannedFiles({
        mediaType: MediaType.TvShows,
        page: 1,
        pageSize: result.totalItems,
      })

      const uniqueShows = new Set<number>()
      fullResult.items.forEach(item => {
        if (item.tmdbId) {
          uniqueShows.add(item.tmdbId)
        }
      })

      return uniqueShows.size
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const isLoading = isLoadingStats || isLoadingTvShows

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingIndicator
          isLoading={isLoading}
          isFetching={isFetchingStats}
          isStale={isStaleStats}
          size="lg"
          showText={true}
        />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const movieCount = stats.byMediaType.find(m => m.mediaType === MediaType.Movies)?.count ?? 0

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Movies"
        value={movieCount.toLocaleString()}
        icon={Film}
        description="Total movies in library"
        href="/mediainfo?mediaType=Movies"
      />
      <StatCard
        title="TV Shows"
        value={(tvShowCount ?? 0).toLocaleString()}
        icon={Tv}
        description="Total TV series in library"
        href="/mediainfo?mediaType=TvShows"
      />
      <StatCard
        title="Total Files"
        value={stats.totalSuccessfulFiles.toLocaleString()}
        icon={FileVideo}
        description={`${stats.totalFiles.toLocaleString()} files scanned`}
        href="/medialibrary"
      />
      <StatCard
        title="Storage Used"
        value={formatBytes(stats.totalSuccessfulFileSize)}
        icon={HardDrive}
        description={`${formatBytes(stats.totalFileSize)} total`}
        valueClassName="text-xl"
      />
    </div>
  )
}
