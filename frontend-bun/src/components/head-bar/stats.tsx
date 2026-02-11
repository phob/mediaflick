"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { mediaApi } from "@/lib/api/endpoints"
import { formatBytes } from "@/lib/format-helper"
import { signalr } from "@/lib/api/signalr"

export default function Stats() {
  const queryClient = useQueryClient()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["scannedfile-stats"],
    queryFn: mediaApi.getScannedFileStats,
    refetchInterval: 60000, // Refetch every 60 seconds as fallback
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2,
  })

  useEffect(() => {
    const invalidateStats = () => {
      queryClient.invalidateQueries({ queryKey: ["scannedfile-stats"] })
    }

    const unsubscribeAdd = signalr.subscribe("file.added", invalidateStats)
    const unsubscribeUpdate = signalr.subscribe("file.updated", invalidateStats)
    const unsubscribeRemove = signalr.subscribe("file.removed", invalidateStats)

    return () => {
      unsubscribeAdd()
      unsubscribeUpdate()
      unsubscribeRemove()
    }
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Loading stats...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Stats unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span>
        Total: <b className="text-foreground">{data.totalFiles.toLocaleString()}</b>
      </span>
      <span>
        OK: <b className="text-foreground">{data.totalSuccessfulFiles.toLocaleString()}</b>
      </span>
      <span>
        Size: <b className="text-foreground">{formatBytes(data.totalFileSize)}</b>
      </span>
      <span>
        OK Size: <b className="text-foreground">{formatBytes(data.totalSuccessfulFileSize)}</b>
      </span>
    </div>
  )
}
