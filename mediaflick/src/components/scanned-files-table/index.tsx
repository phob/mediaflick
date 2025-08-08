import React, { useCallback, useEffect, useRef, useState } from "react"

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
import { Loader2, Edit, Search, Trash2, Columns3 } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  type ColumnKey = 'sourceFile' | 'destFile' | 'genres' | 'mediaType' | 'tmdbId' | 'imdbId' | 'episode' | 'status' | 'createdAt' | 'updatedAt'
  const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
    sourceFile: true,
    destFile: true,
    genres: false,
    mediaType: true,
    tmdbId: false,
    imdbId: false,
    episode: true,
    status: true,
    createdAt: false,
    updatedAt: false,
  }
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS)
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [preDragSelectedKeys, setPreDragSelectedKeys] = useState<Set<number>>(new Set())
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select")
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false)

  // Clear animation after delay
  useEffect(() => {
    if (newEntries.size === 0) return

    const timeoutId = setTimeout(() => {
      setNewEntries(new Set())
    }, 2000) // 2 seconds matches the CSS animation duration

    return () => clearTimeout(timeoutId)
  }, [newEntries])

  // Load and persist column visibility settings
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('scannedFilesTable.visibleColumns') : null
      if (raw) {
        const parsed = JSON.parse(raw)
        setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS, ...parsed })
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('scannedFilesTable.visibleColumns', JSON.stringify(visibleColumns))
      }
    } catch {}
  }, [visibleColumns])

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
          <div className="flex flex-col whitespace-nowrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="max-w-[32rem] overflow-hidden"
                    style={{ WebkitMaskImage: "linear-gradient(to right, black 80%, transparent)", maskImage: "linear-gradient(to right, black 80%, transparent)" }}
                  >
                    <span className="cursor-help font-medium">{getFileName(file.sourceFile)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-2xl break-all">
                  <p>{stripFolderPrefix(file.sourceFile, file.mediaType, plexConfig)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        destFile: (
          <div className="flex flex-col whitespace-nowrap">
            {file.destFile ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="max-w-[28rem] overflow-hidden"
                      style={{ WebkitMaskImage: "linear-gradient(to right, black 80%, transparent)", maskImage: "linear-gradient(to right, black 80%, transparent)" }}
                    >
                      <span className="cursor-help font-medium">{getFileName(file.destFile)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-2xl break-all">
                    <p>{stripFolderPrefix(file.destFile, file.mediaType, plexConfig)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span>-</span>
            )}
          </div>
        ),
        genres: (
          <span className="block max-w-[20rem] truncate whitespace-nowrap" title={file.genres?.join(", ") || undefined}>
            {file.genres?.join(", ")}
          </span>
        ),
        tmdbId: file.tmdbId ?? 0,
        imdbId: file.imdbId ?? "-",
        mediaType: getMediaTypeLabel(file.mediaType),
        episode: formatEpisodeNumber(file.seasonNumber, file.episodeNumber),
        status: (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(file.status)}`}>
            {getStatusLabel(file.status)}
          </span>
        ),
        createdAt: (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="whitespace-nowrap">
                  {format(new Date(file.createdAt), "MMM d, HH:mm")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{format(new Date(file.createdAt), "yyyy-MM-dd HH:mm:ss")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        updatedAt: (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="whitespace-nowrap">
                  {format(new Date(file.updatedAt), "MMM d, HH:mm")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{format(new Date(file.updatedAt), "yyyy-MM-dd HH:mm:ss")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      })
    )
  }, [data, filteredItems, plexConfig])

  const keyToIndex = React.useMemo(() => {
    const map = new Map<number, number>()
    rows.forEach((row, index) => map.set(row.key, index))
    return map
  }, [rows])

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

  const handleRowClick = useCallback((e: React.MouseEvent, key: number) => {
    // If a drag just happened, skip click toggle
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    const clickedIndex = keyToIndex.get(key) ?? null

    if (e.shiftKey && lastSelectedIndex !== null && clickedIndex !== null) {
      const start = Math.min(lastSelectedIndex, clickedIndex)
      const end = Math.max(lastSelectedIndex, clickedIndex)
      const rangeKeys = rows.slice(start, end + 1).map((r) => r.key)
      const newKeys = new Set(selectedKeys)
      rangeKeys.forEach((k) => newKeys.add(k))
      setSelectedKeys(newKeys)
    } else {
      const newKeys = new Set(selectedKeys)
      if (newKeys.has(key)) {
        newKeys.delete(key)
      } else {
        newKeys.add(key)
      }
      setSelectedKeys(newKeys)
      if (clickedIndex !== null) setLastSelectedIndex(clickedIndex)
    }
  }, [keyToIndex, lastSelectedIndex, rows, selectedKeys])

  const updateDragSelection = useCallback((currentIndex: number) => {
    if (dragStartIndex === null) return
    const start = Math.min(dragStartIndex, currentIndex)
    const end = Math.max(dragStartIndex, currentIndex)
    const rangeKeys = rows.slice(start, end + 1).map((r) => r.key)
    const newSet = new Set(preDragSelectedKeys)
    if (dragMode === "select") {
      rangeKeys.forEach((k) => newSet.add(k))
    } else {
      rangeKeys.forEach((k) => newSet.delete(k))
    }
    setSelectedKeys(newSet)
  }, [dragStartIndex, dragMode, preDragSelectedKeys, rows])

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
        setDragStartIndex(null)
        setPreDragSelectedKeys(new Set())
      }
    }
    window.addEventListener("mouseup", handleMouseUp)
    return () => window.removeEventListener("mouseup", handleMouseUp)
  }, [])

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
            episodeNumber2: row.episodeNumber2,
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
            <Popover open={columnsPopoverOpen} onOpenChange={setColumnsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-2">
                  {(
                    [
                      { key: 'sourceFile', label: 'Source File' },
                      { key: 'destFile', label: 'Destination' },
                      { key: 'genres', label: 'Genres' },
                      { key: 'mediaType', label: 'Media Type' },
                      { key: 'tmdbId', label: 'TMDB ID' },
                      { key: 'imdbId', label: 'IMDb ID' },
                      { key: 'episode', label: 'Episode (TV Shows)' },
                      { key: 'status', label: 'Status' },
                      { key: 'createdAt', label: 'Created' },
                      { key: 'updatedAt', label: 'Updated' },
                    ] as { key: ColumnKey; label: string }[]
                  ).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/40 bg-transparent"
                        checked={visibleColumns[key]}
                        onChange={(e) =>
                          setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
    columnsPopoverOpen,
    visibleColumns,
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
    const visibleHeadersCount = (
      (visibleColumns.sourceFile ? 1 : 0) +
      (visibleColumns.destFile ? 1 : 0) +
      (visibleColumns.genres ? 1 : 0) +
      (visibleColumns.mediaType ? 1 : 0) +
      (visibleColumns.tmdbId ? 1 : 0) +
      (visibleColumns.imdbId ? 1 : 0) +
      (visibleColumns.status ? 1 : 0) +
      (visibleColumns.createdAt ? 1 : 0) +
      (visibleColumns.updatedAt ? 1 : 0) +
      ((mediaTypeFilter === MediaType.TvShows && visibleColumns.episode) ? 1 : 0)
    ) + 1 // checkbox column
    return (
      <div>
        <Separator className="my-4" />
        <div className="rounded-md border">
          <Table className="whitespace-nowrap">
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
                {visibleColumns.sourceFile && (
                  <TableHead onClick={() => handleSort("sourceFile")} className="cursor-pointer">
                    Source File {sortBy === "sourceFile" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.destFile && (
                  <TableHead onClick={() => handleSort("destFile")} className="cursor-pointer">
                    Destination {sortBy === "destFile" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.genres && (
                  <TableHead onClick={() => handleSort("genres")} className="cursor-pointer">
                    Genres {sortBy === "genres" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.mediaType && (
                  <TableHead onClick={() => handleSort("mediaType")} className="cursor-pointer">
                    Media Type {sortBy === "mediaType" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.tmdbId && (
                  <TableHead onClick={() => handleSort("tmdbId")} className="cursor-pointer">
                    TMDB ID {sortBy === "tmdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.imdbId && (
                  <TableHead onClick={() => handleSort("imdbId")} className="cursor-pointer">
                    IMDb ID {sortBy === "imdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {mediaTypeFilter === MediaType.TvShows && visibleColumns.episode && (
                  <TableHead onClick={() => handleSort("episode")} className="cursor-pointer">
                    Episode {sortBy === "episode" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.status && (
                  <TableHead onClick={() => handleSort("status")} className="cursor-pointer">
                    Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.createdAt && (
                  <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer">
                    Created {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
                {visibleColumns.updatedAt && (
                  <TableHead onClick={() => handleSort("updatedAt")} className="cursor-pointer">
                    Updated {sortBy === "updatedAt" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleHeadersCount} className="h-24 text-center">
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
                    onMouseDown={(e) => {
                      // Only left button
                      if (e.button !== 0) return
                      // Don't start drag if interacting with controls
                      if (
                        e.target instanceof HTMLElement &&
                        (e.target.closest("button") || e.target.closest("a") || e.target.closest("input"))
                      ) {
                        return
                      }
                      const index = keyToIndex.get(item.key)
                      if (index === undefined) return
                      isDraggingRef.current = true
                      didDragRef.current = false
                      setIsDragging(true)
                      setDragStartIndex(index)
                      setPreDragSelectedKeys(new Set(selectedKeys))
                      setDragMode(selectedKeys.has(item.key) ? "deselect" : "select")
                      setLastSelectedIndex(index)
                    }}
                    onMouseEnter={() => {
                      if (!isDraggingRef.current) return
                      const index = keyToIndex.get(item.key)
                      if (index === undefined || dragStartIndex === null) return
                      if (index !== dragStartIndex) didDragRef.current = true
                      updateDragSelection(index)
                    }}
                    onClick={(e) => {
                      // Don't trigger row selection if clicking the checkbox
                      if (e.target instanceof HTMLElement && 
                          (e.target.closest('button') || // For checkbox
                          e.target.closest('a'))) { // For any links
                        return
                      }
                      handleRowClick(e, item.key)
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
                    {visibleColumns.sourceFile && (<TableCell>{item.sourceFile}</TableCell>)}
                    {visibleColumns.destFile && (<TableCell>{item.destFile}</TableCell>)}
                    {visibleColumns.genres && (<TableCell>{item.genres}</TableCell>)}
                    {visibleColumns.mediaType && (<TableCell>{item.mediaType}</TableCell>)}
                    {visibleColumns.tmdbId && (<TableCell>{item.tmdbId}</TableCell>)}
                    {visibleColumns.imdbId && (<TableCell>{item.imdbId}</TableCell>)}
                    {mediaTypeFilter === MediaType.TvShows && visibleColumns.episode && (
                      <TableCell>{item.episode}</TableCell>
                    )}
                    {visibleColumns.status && (<TableCell>{item.status}</TableCell>)}
                    {visibleColumns.createdAt && (<TableCell>{item.createdAt}</TableCell>)}
                    {visibleColumns.updatedAt && (<TableCell>{item.updatedAt}</TableCell>)}
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
    mediaTypeFilter,
    visibleColumns,
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
      <div className="h-[calc(100vh-400px)] min-h-[400px] overflow-auto">
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
