import React, { useCallback, useEffect, useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { EditModal } from "@/components/scanned-files-table/edit-modal"
import { TableComponent } from "@/components/scanned-files-table/table-component"
import { createRowMapper } from "@/components/scanned-files-table/row-mapper"
import { mediaTypeOptions, statusOptions, Row } from "@/components/scanned-files-table/types"
import { useColumnVisibility } from "@/components/scanned-files-table/hooks/useColumnVisibility"
import { useRowSelection } from "@/components/scanned-files-table/hooks/useRowSelection"
import { useSignalRHandlers } from "@/components/scanned-files-table/hooks/useSignalRHandlers"
import { ScannedFilesToolbar } from "@/components/scanned-files-table/toolbar"
import { mediaApi } from "@/lib/api/endpoints"
import { MediaStatus, MediaType, PagedResult, PlexConfig, ScannedFile } from "@/lib/api/types"
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
  const [newEntries, setNewEntries] = useState<Set<number>>(new Set())
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const { visibleColumns, setVisibleColumns } = useColumnVisibility()
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false)
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable")

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

  const rowMapper = React.useMemo(() => createRowMapper({ plexConfig }), [plexConfig])
  
  const rows = React.useMemo(() => {
    if (!data) return []
    return filteredItems.map(rowMapper)
  }, [data, filteredItems, rowMapper])

  // Use custom hooks
  const {
    selectedKeys,
    setSelectedKeys,
    handleRowClick,
    handleMouseDown,
    handleMouseEnter,
    handleSelectAll,
    handleCheckboxChange,
    didDragRef,
  } = useRowSelection(rows)

  useSignalRHandlers({
    data,
    pageSize,
    statusFilter,
    mediaTypeFilter,
    filterValue,
    sortBy,
    sortOrder,
    setData,
    setNewEntries,
  })

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
  }, [selectedKeys, page, pageSize, sortBy, sortOrder, filterValue, statusFilter, mediaTypeFilter, setSelectedKeys])

  const selectedRows = React.useMemo(() => {
    return rows.filter((row) => selectedKeys.has(row.key))
  }, [selectedKeys, rows])

  const handleEditSelected = useCallback(() => {
    setIsEditModalOpen(true)
  }, [])

  const handleSaveEdits = useCallback(async (updatedRows: Row[]) => {
    setIsEditModalOpen(false)

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
    }
  }, [])

  const topContent = (
    <ScannedFilesToolbar
      totalResults={filteredItems.length}
      filterValue={filterValue}
      onChangeFilterValue={(v) => {
        setFilterValue(v)
        setSelectedKeys(new Set())
        onSearchChange?.(v)
      }}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      statusFilter={statusFilter}
      statusOptions={statusOptions}
      onStatusChange={(value) => {
        setStatusFilter(value)
        setSelectedKeys(new Set())
        onStatusChange?.(value)
      }}
      mediaTypeFilter={mediaTypeFilter}
      mediaTypeOptions={mediaTypeOptions}
      onMediaTypeChange={(value) => {
        setMediaTypeFilter(value)
        setSelectedKeys(new Set())
        onMediaTypeChange?.(value)
      }}
      selectedCount={selectedKeys.size}
      onEditSelected={handleEditSelected}
      onDeleteSelected={handleDeleteSelected}
      columnsPopoverOpen={columnsPopoverOpen}
      setColumnsPopoverOpen={setColumnsPopoverOpen}
      visibleColumns={visibleColumns}
      setVisibleColumns={setVisibleColumns}
    />
  )

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

  return (
    <>
      {topContent}
      <TableComponent
        loading={loading}
        rows={rows}
        sortBy={sortBy}
        sortOrder={sortOrder}
        selectedKeys={selectedKeys}
        newEntries={newEntries}
        mediaTypeFilter={mediaTypeFilter}
        visibleColumns={visibleColumns}
        density={density}
        onSort={handleSort}
        onSelectAll={handleSelectAll}
        onCheckboxChange={handleCheckboxChange}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onRowClick={handleRowClick}
        didDragRef={didDragRef}
      />
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Density:</span>
        <Select
          value={density}
          onValueChange={(value) => setDensity(value as "comfortable" | "compact")}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
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
