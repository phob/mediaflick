import React, { useCallback, useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Loader2, Edit, Search, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

import { EditModal } from "@/components/scanned-files-table/edit-modal"
import { mediaTypeOptions, statusOptions, Row } from "@/components/scanned-files-table/types"
import { mediaApi } from "@/lib/api/endpoints"
import { signalr } from "@/lib/api/signalr"
import { MediaStatus, MediaType, PagedResult, PlexConfig, ScannedFile } from "@/lib/api/types"
import { getFileName, stripFolderPrefix } from "@/lib/files-folders"
import { formatEpisodeNumber, getMediaTypeLabel, getStatusClass, getStatusLabel } from "@/lib/format-helper"
import { Separator } from "../ui/separator"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ScannedFilesTableProps {
  readonly page?: number
  readonly pageSize?: number
  readonly sortBy?: string
  readonly sortOrder?: string
  readonly initialStatus?: MediaStatus
  readonly initialMediaType?: MediaType
  readonly initialSearch?: string
  readonly onPageChange?: (page: number) => void
  readonly onPageSizeChange?: (pageSize: number) => void
  readonly onSortByChange?: (sortBy: string) => void
  readonly onSortOrderChange?: (sortOrder: string) => void
  readonly onStatusChange?: (status: MediaStatus) => void
  readonly onMediaTypeChange?: (mediaType: MediaType) => void
  readonly onSearchChange?: (search: string) => void
}

export function ScannedFilesTable({
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
  initialStatus = MediaStatus.Success,
  initialMediaType = MediaType.TvShows,
  initialSearch = "",
  onPageChange,
  onPageSizeChange,
  onSortByChange,
  onSortOrderChange,
  onStatusChange,
  onMediaTypeChange,
  onSearchChange,
}: ScannedFilesTableProps) {
  const [data, setData] = useState<PagedResult<ScannedFile> | null>(null)
  const [loading, setLoading] = useState(true)
  const [plexConfig, setPlexConfig] = useState<PlexConfig | null>(null)
  const [filterValue, setFilterValue] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<MediaStatus>(initialStatus)
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType>(initialMediaType)
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set())
  const [newEntries, setNewEntries] = useState<Set<number>>(new Set())
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Clear animation after delay
  useEffect(() => {
    if (newEntries.size === 0) return

    const timeoutId = setTimeout(() => {
      setNewEntries(new Set())
    }, 2000) // 2 seconds matches the CSS animation duration

    return () => clearTimeout(timeoutId)
  }, [newEntries])

  const filteredItems = React.useMemo(() => {
    const hasSearchFilter = Boolean(filterValue)
    let filteredData = [...(data?.items || [])]

    if (hasSearchFilter) {
      filteredData = filteredData.filter(
        (item) =>
          item.sourceFile.toLowerCase().includes(filterValue.toLowerCase()) ||
          item.destFile?.toLowerCase()?.includes(filterValue.toLowerCase())
      )
    }

    if (statusFilter) {
      filteredData = filteredData.filter((item) => item.status === statusFilter)
    }

    return filteredData
  }, [data?.items, filterValue, statusFilter])

  const rows = React.useMemo(() => {
    if (!data) return []

    return filteredItems.map(
      (file): Row => ({
        key: file.id,
        sourceFile: (
          <div className="flex flex-col">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help font-medium">{getFileName(file.sourceFile)}</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-lg break-all">
                  <p>{stripFolderPrefix(file.sourceFile, file.mediaType, plexConfig)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        destFile: (
          <div className="flex flex-col">
            {file.destFile ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help font-medium">{getFileName(file.destFile)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-lg break-all">
                    <p>{stripFolderPrefix(file.destFile, file.mediaType, plexConfig)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span>-</span>
            )}
          </div>
        ),
        genres: file.genres?.join(", "),
        tmdbId: file.tmdbId ?? 0,
        imdbId: file.imdbId ?? "-",
        mediaType: getMediaTypeLabel(file.mediaType),
        episode: formatEpisodeNumber(file.seasonNumber, file.episodeNumber),
        status: (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(file.status)}`}>
            {getStatusLabel(file.status)}
          </span>
        ),
        createdAt: format(new Date(file.createdAt), "MMM d, yyyy HH:mm"),
        updatedAt: format(new Date(file.updatedAt), "MMM d, yyyy HH:mm"),
      })
    )
  }, [data, filteredItems, plexConfig])

  const handleDeleteSelected = useCallback(async () => {
    const selectedIds = Array.from(selectedKeys)

    try {
      await mediaApi.deleteScannedFiles(selectedIds)

      const result = await mediaApi.getScannedFiles({
        page,
        pageSize,
        sortBy,
        sortOrder,
        searchTerm: filterValue,
        status: statusFilter,
        mediaType: mediaTypeFilter,
      })

      setData(result)
      setSelectedKeys(new Set())
    } catch (error) {
      console.error("Failed to delete files:", error)
    }
  }, [selectedKeys, page, pageSize, sortBy, sortOrder, filterValue, statusFilter, mediaTypeFilter])

  const selectedRows = React.useMemo(() => {
    return rows.filter((row) => selectedKeys.has(row.key))
  }, [selectedKeys, rows])

  const handleRowClick = useCallback((key: number) => {
    const newKeys = new Set(selectedKeys)
    if (newKeys.has(key)) {
      newKeys.delete(key)
    } else {
      newKeys.add(key)
    }
    setSelectedKeys(newKeys)
  }, [selectedKeys])

  const handleEditSelected = useCallback(() => {
    setIsEditModalOpen(true)
  }, [])

  const handleSaveEdits = useCallback(async (updatedRows: Row[]) => {
    setIsEditModalOpen(false)
    setLoading(true)

    try {
      // Update each file
      await Promise.all(
        updatedRows.map((row) =>
          mediaApi.updateScannedFile(row.key, {
            tmdbId: row.tmdbId,
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
          })
        )
      )

      // Recreate all symlinks
      await mediaApi.recreateAllSymlinks()
    } catch (error) {
      console.error("Failed to save changes:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total {filteredItems.length} files</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="w-full max-w-sm"
              placeholder="Search files..."
              value={filterValue}
              onChange={(e) => {
                setFilterValue(e.target.value)
                setSelectedKeys(new Set())
                onSearchChange?.(e.target.value)
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as MediaStatus)
                setSelectedKeys(new Set())
                onStatusChange?.(value as MediaStatus)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.uid} value={status.uid}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mediaTypeFilter}
              onValueChange={(value) => {
                setMediaTypeFilter(value as MediaType)
                setSelectedKeys(new Set())
                onMediaTypeChange?.(value as MediaType)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Media Type" />
              </SelectTrigger>
              <SelectContent>
                {mediaTypeOptions.map((type) => (
                  <SelectItem key={type.uid} value={type.uid}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={selectedKeys.size === 0}
              onClick={handleEditSelected}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Selected
            </Button>
            <Button
              variant="destructive"
              disabled={selectedKeys.size === 0}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      </div>
    )
  }, [
    filterValue,
    statusFilter,
    mediaTypeFilter,
    selectedKeys,
    filteredItems.length,
    onPageSizeChange,
    handleDeleteSelected,
    handleEditSelected,
    pageSize,
    onStatusChange,
    onMediaTypeChange,
    onSearchChange,
  ])

  const handleSort = React.useCallback(
    (column: string) => {
      if (sortBy === column) {
        onSortOrderChange?.(sortOrder === "asc" ? "desc" : "asc")
      } else {
        onSortByChange?.(column)
        onSortOrderChange?.("asc")
      }
    },
    [sortBy, sortOrder, onSortOrderChange, onSortByChange]
  )

  const tableComponent = React.useMemo(() => {
    return (
      <div>
        <Separator className="my-4" />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedKeys.size > 0 && selectedKeys.size === rows.length}
                    onCheckedChange={(checked) => {
                      const newKeys = checked ? new Set<number>(rows.map(row => row.key)) : new Set<number>()
                      setSelectedKeys(newKeys)
                    }}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead onClick={() => handleSort("sourceFile")} className="cursor-pointer">
                  Source File {sortBy === "sourceFile" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("destFile")} className="cursor-pointer">
                  Destination {sortBy === "destFile" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("genres")} className="cursor-pointer">
                  Genres {sortBy === "genres" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("mediaType")} className="cursor-pointer">
                  Media Type {sortBy === "mediaType" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("tmdbId")} className="cursor-pointer">
                  TMDB ID {sortBy === "tmdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("imdbId")} className="cursor-pointer">
                  IMDb ID {sortBy === "imdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("episode")} className="cursor-pointer">
                  Episode {sortBy === "episode" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("status")} className="cursor-pointer">
                  Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer">
                  Created {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("updatedAt")} className="cursor-pointer">
                  Updated {sortBy === "updatedAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((item) => (
                  <TableRow
                    key={item.key}
                    className={cn(
                      "transition-colors cursor-pointer select-none",
                      newEntries.has(item.key) ? "animate-new-row" : "",
                      selectedKeys.has(item.key) ? "bg-muted/50" : "",
                      "hover:bg-muted/30"
                    )}
                    data-selected={selectedKeys.has(item.key)}
                    onClick={(e) => {
                      // Don't trigger row selection if clicking the checkbox
                      if (e.target instanceof HTMLElement && 
                          (e.target.closest('button') || // For checkbox
                          e.target.closest('a'))) { // For any links
                        return
                      }
                      handleRowClick(item.key)
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedKeys.has(item.key)}
                        onCheckedChange={(checked) => {
                          const newKeys = new Set(selectedKeys)
                          if (checked) {
                            newKeys.add(item.key)
                          } else {
                            newKeys.delete(item.key)
                          }
                          setSelectedKeys(newKeys)
                        }}
                        aria-label={`Select row ${item.key}`}
                      />
                    </TableCell>
                    <TableCell>{item.sourceFile}</TableCell>
                    <TableCell>{item.destFile}</TableCell>
                    <TableCell>{item.genres}</TableCell>
                    <TableCell>{item.mediaType}</TableCell>
                    <TableCell>{item.tmdbId}</TableCell>
                    <TableCell>{item.imdbId}</TableCell>
                    <TableCell>{item.episode}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.createdAt}</TableCell>
                    <TableCell>{item.updatedAt}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }, [
    loading,
    rows,
    sortBy,
    sortOrder,
    handleSort,
    selectedKeys,
    newEntries,
    handleRowClick,
  ])

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await mediaApi.getPlexConfig()
        setPlexConfig(config)
      } catch (err) {
        console.error("Failed to fetch Plex config:", err)
      }
    }
    fetchConfig()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await mediaApi.getScannedFiles({
          page,
          pageSize,
          sortBy,
          sortOrder,
          searchTerm: filterValue,
          status: statusFilter,
          mediaType: mediaTypeFilter,
        })
        setData(result)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [page, pageSize, sortBy, sortOrder, filterValue, statusFilter, mediaTypeFilter])

  // Move sortItems before handlers
  const sortItems = React.useCallback((items: ScannedFile[], sortBy: string, sortOrder: string): ScannedFile[] => {
    return [...items].sort((a, b) => {
      const aValue = a[sortBy as keyof ScannedFile]
      const bValue = b[sortBy as keyof ScannedFile]
      if (aValue === bValue) return 0
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      const comparison = aValue < bValue ? -1 : 1
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [])

  // SignalR handler functions
  const handleFileAdded = React.useCallback((file: ScannedFile, pageSize: number) => {
    setNewEntries((prev) => new Set([...prev, file.id]))
    setData((prevData) => {
      if (!prevData) return null
      const newItems = sortItems([file, ...prevData.items], sortBy, sortOrder).slice(0, pageSize)
      const newTotalItems = prevData.totalItems + 1
      return {
        ...prevData,
        items: newItems,
        totalItems: newTotalItems,
        totalPages: Math.ceil(newTotalItems / pageSize),
      }
    })
  }, [sortBy, sortOrder, sortItems])

  const handleExistingFileUpdate = React.useCallback((
    prevData: PagedResult<ScannedFile>,
    file: ScannedFile,
    itemIndex: number,
    matchesFilters: boolean,
    pageSize: number
  ) => {
    if (!matchesFilters) {
      const filteredItems = prevData.items.filter((_, index) => index !== itemIndex)
      return {
        ...prevData,
        items: filteredItems,
        totalItems: prevData.totalItems - 1,
        totalPages: Math.ceil((prevData.totalItems - 1) / pageSize),
      }
    }
    const updatedItems = sortItems([file, ...prevData.items.filter((_, index) => index !== itemIndex)], sortBy, sortOrder).slice(0, pageSize)
    return { ...prevData, items: updatedItems }
  }, [sortItems, sortBy, sortOrder])

  const handleNewFileUpdate = React.useCallback((
    prevData: PagedResult<ScannedFile>,
    file: ScannedFile,
    pageSize: number
  ) => {
    setNewEntries((prev) => new Set([...prev, file.id]))
    const newItems = sortItems([file, ...prevData.items], sortBy, sortOrder).slice(0, pageSize)
    return {
      ...prevData,
      items: newItems,
      totalItems: prevData.totalItems + 1,
      totalPages: Math.ceil((prevData.totalItems + 1) / pageSize),
    }
  }, [sortItems, sortBy, sortOrder])

  const handleFileUpdated = React.useCallback((file: ScannedFile, pageSize: number, shouldIncludeFile: (file: ScannedFile) => boolean) => {
    setData((prevData) => {
      if (!prevData?.items) return null
      const itemIndex = prevData.items.findIndex((item) => item.id === file.id)
      const matchesFilters = shouldIncludeFile(file)

      if (itemIndex !== -1) {
        return handleExistingFileUpdate(prevData, file, itemIndex, matchesFilters, pageSize)
      }
      if (matchesFilters) {
        return handleNewFileUpdate(prevData, file, pageSize)
      }
      return prevData
    })
  }, [handleExistingFileUpdate, handleNewFileUpdate])

  const handleFileRemoved = React.useCallback((file: ScannedFile, pageSize: number) => {
    setData((prevData) => {
      if (!prevData?.items) return null
      const itemIndex = prevData.items.findIndex((item) => item.id === file.id)
      if (itemIndex === -1) return prevData
      const filteredItems = prevData.items.filter((_, index) => index !== itemIndex)
      const newTotalItems = Math.max(0, prevData.totalItems - 1)
      return {
        ...prevData,
        items: filteredItems,
        totalItems: newTotalItems,
        totalPages: Math.max(1, Math.ceil(newTotalItems / pageSize)),
      }
    })
  }, [])

  // Effect for SignalR subscriptions
  useEffect(() => {
    if (!data || !statusFilter || !mediaTypeFilter) return

    const shouldIncludeFile = (file: ScannedFile): boolean => {
      const statusMatch = file.status === statusFilter
      const mediaTypeMatch = file.mediaType === mediaTypeFilter
      const searchMatch = !filterValue ||
        file.sourceFile.toLowerCase().includes(filterValue.toLowerCase()) ||
        (file.destFile?.toLowerCase() || "").includes(filterValue.toLowerCase())
      return statusMatch && mediaTypeMatch && searchMatch
    }

    const unsubscribeAdd = signalr.subscribe("OnFileAdded", 
      (file) => handleFileAdded(file, pageSize))
    const unsubscribeUpdate = signalr.subscribe("OnFileUpdated", 
      (file) => handleFileUpdated(file, pageSize, shouldIncludeFile))
    const unsubscribeRemove = signalr.subscribe("OnFileRemoved", 
      (file) => handleFileRemoved(file, pageSize))

    return () => {
      unsubscribeAdd()
      unsubscribeUpdate()
      unsubscribeRemove()
    }
  }, [data, pageSize, statusFilter, mediaTypeFilter, filterValue, handleFileAdded, handleFileUpdated, handleFileRemoved])

  return (
    <>
      {topContent}
      <div className="h-[calc(100vh-200px)] min-h-[400px] overflow-auto">
        {tableComponent}
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => onPageChange?.(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4">
                  Page {page} of {data.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  onClick={() => onPageChange?.(Math.min(data.totalPages, page + 1))}
                  aria-disabled={page === data.totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      <EditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        selectedRows={selectedRows}
        onSave={handleSaveEdits}
        initialMediaType={mediaTypeFilter as MediaType.Movies | MediaType.TvShows}
      />
    </>
  )
}
