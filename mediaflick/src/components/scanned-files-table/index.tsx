import dynamic from "next/dynamic"
import React, { useCallback, useEffect, useState } from "react"

import {
  Button,
  Input,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  getKeyValue,
} from "@nextui-org/react"
import type { Selection, SortDescriptor } from "@nextui-org/react"
import { format } from "date-fns"
import { Edit, Search, Trash2 } from "lucide-react"

import { mediaApi } from "@/lib/api/endpoints"
import { MediaStatus, MediaType, PagedResult, PlexConfig, ScannedFile } from "@/lib/api/types"
import { getFileName, stripFolderPrefix } from "@/lib/files-folders"
import { formatEpisodeNumber, getMediaTypeLabel, getStatusClass, getStatusLabel } from "@/lib/format-helper"

interface ScannedFilesTableProps {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onSortByChange?: (sortBy: string) => void
  onSortOrderChange?: (sortOrder: string) => void
}

type Row = {
  key: number
  sourceFile: React.ReactNode
  destFile: React.ReactNode
  tmdbId: number
  imdbId: string
  mediaType: string
  episode: string
  status: React.ReactNode
  createdAt: string
  updatedAt: string
}

const statusOptions = [
  { uid: "Processing", name: "Processing" },
  { uid: "Success", name: "Success" },
  { uid: "Failed", name: "Failed" },
  { uid: "Duplicate", name: "Duplicate" },
] as const

const mediaTypeOptions = [
  { uid: MediaType.TvShows, name: "TV Shows" },
  { uid: MediaType.Movies, name: "Movies" },
  { uid: MediaType.Extras, name: "Extras" },
  { uid: MediaType.Unknown, name: "Unknown" },
] as const

const DynamicTable = dynamic(
  () =>
    Promise.resolve(({ children, ...props }: React.ComponentProps<typeof Table>) => (
      <Table {...props}>{children}</Table>
    )),
  { ssr: false }
)

export function ScannedFilesTable({
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
  onPageChange,
  onPageSizeChange,
  onSortByChange,
  onSortOrderChange,
}: ScannedFilesTableProps) {
  const [data, setData] = useState<PagedResult<ScannedFile> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plexConfig, setPlexConfig] = useState<PlexConfig | null>(null)
  const [filterValue, setFilterValue] = useState("")
  const [statusFilter, setStatusFilter] = useState<Selection>(new Set([MediaStatus.Success]))
  const [mediaTypeFilter, setMediaTypeFilter] = useState<Selection>(new Set([MediaType.TvShows]))
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set())

  const filteredItems = React.useMemo(() => {
    const hasSearchFilter = Boolean(filterValue)
    let filteredData = [...(data?.items || [])]

    if (hasSearchFilter) {
      filteredData = filteredData.filter(
        (item) =>
          item.sourceFile.toLowerCase().includes(filterValue.toLowerCase()) ||
          (item.destFile && item.destFile.toLowerCase().includes(filterValue.toLowerCase()))
      )
    }

    if (statusFilter !== "all" && statusFilter instanceof Set && statusFilter.size > 0) {
      filteredData = filteredData.filter((item) => statusFilter.has(MediaStatus[item.status]))
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
            <Tooltip
              content={stripFolderPrefix(file.sourceFile, file.mediaType, plexConfig)}
              className="max-w-lg break-all"
              placement="right-end"
              showArrow
              color="primary"
              delay={300}
              closeDelay={300}
            >
              <span className="cursor-help font-medium">{getFileName(file.sourceFile)}</span>
            </Tooltip>
          </div>
        ),
        destFile: (
          <div className="flex flex-col">
            {file.destFile ? (
              <Tooltip
                content={stripFolderPrefix(file.destFile, file.mediaType, plexConfig)}
                className="max-w-lg break-all"
                placement="right-end"
                showArrow
                color="primary"
                delay={300}
                closeDelay={300}
              >
                <span className="cursor-help font-medium">{getFileName(file.destFile)}</span>
              </Tooltip>
            ) : (
              <span>-</span>
            )}
          </div>
        ),
        tmdbId: file.tmdbId || 0,
        imdbId: file.imdbId || "-",
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

  const bottomContent = React.useMemo(() => {
    if (!data) return null

    return (
      <div className="flex w-full justify-center px-2 py-2">
        <Pagination total={data.totalPages} page={page} onChange={onPageChange} showShadow showControls />
      </div>
    )
  }, [data, page, onPageChange])

  const handleDeleteSelected = useCallback(async () => {
    const selectedIds = selectedKeys === "all"
    ? filteredItems.map(item => item.id)
    : Array.from(selectedKeys).map(key => Number(key));
    
    try {
      await mediaApi.deleteScannedFiles(selectedIds)

      const result = await mediaApi.getScannedFiles({
        page,
        pageSize,
        sortBy,
        sortOrder,
        searchTerm: filterValue,
        status: Array.from(statusFilter)[0] as unknown as MediaStatus,
        mediaType: Array.from(mediaTypeFilter)[0] as unknown as MediaType,
      })

      setData(result)
      setSelectedKeys(new Set())
    } catch (error) {
      console.error("Failed to delete files:", error)
    }
  }, [selectedKeys, page, pageSize, sortBy, sortOrder, filterValue, statusFilter, mediaTypeFilter])

  const topContent = React.useMemo(() => {
    const selectedCount = selectedKeys === "all" ? filteredItems.length : Array.from(selectedKeys).length

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-small text-default-400">Total {filteredItems.length} files</span>
          <label className="flex items-center text-small text-default-400">
            Rows per page:
            <select
              className="bg-transparent text-small text-default-400 outline-none"
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Search files..."
            startContent={<Search className="text-default-300" />}
            value={filterValue}
            onClear={() => setFilterValue("")}
            onValueChange={(value) => setFilterValue(value)}
          />
          <div className="flex items-center gap-3">
            <Select
              label="Status"
              className="w-36"
              selectedKeys={statusFilter}
              onSelectionChange={setStatusFilter}
              selectionMode="single"
              items={statusOptions}
              size="sm"
            >
              {(status) => (
                <SelectItem key={status.uid} value={status.uid}>
                  {status.name}
                </SelectItem>
              )}
            </Select>
            <Select
              label="Media Type"
              className="w-36"
              selectedKeys={mediaTypeFilter}
              onSelectionChange={setMediaTypeFilter}
              selectionMode="single"
              items={mediaTypeOptions}
              size="sm"
            >
              {(type) => (
                <SelectItem key={type.uid} value={type.uid}>
                  {type.name}
                </SelectItem>
              )}
            </Select>
            <Button color="primary" endContent={<Edit className="h-4 w-4" />} isDisabled={selectedCount === 0}>
              Edit Selected
            </Button>
            <Button
              color="danger"
              endContent={<Trash2 className="h-4 w-4" />}
              isDisabled={selectedCount === 0}
              onPress={handleDeleteSelected}
            >
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
  ])

  const handleSort = React.useCallback(
    (descriptor: SortDescriptor) => {
      const column = String(descriptor.column)
      if (sortBy === column) {
        onSortOrderChange?.(sortOrder === "asc" ? "desc" : "asc")
      } else {
        onSortByChange?.(column)
        onSortOrderChange?.("asc")
      }
    },
    [sortBy, sortOrder, onSortOrderChange, onSortByChange]
  )

  const handleSelectionChange = useCallback((selection: Selection) => {
    setSelectedKeys(selection)
  }, [])

  const tableComponent = React.useMemo(() => {
    return (
      <DynamicTable
        isHeaderSticky
        aria-label="Scanned files table"
        selectionMode="multiple"
        className="h-[calc(100vh-200px)]"
        classNames={{
          th: "bg-default-200",
          td: "py-3",
          wrapper: "min-h-[400px]",
        }}
        sortDescriptor={{
          column: sortBy,
          direction: sortOrder === "asc" ? "ascending" : "descending",
        }}
        onSortChange={handleSort}
        bottomContent={bottomContent}
        topContent={topContent}
        topContentPlacement="outside"
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
      >
        <TableHeader>
          <TableColumn key="sourceFile" allowsSorting>
            Source File
          </TableColumn>
          <TableColumn key="destFile" allowsSorting>
            Destination
          </TableColumn>
          <TableColumn key="mediaType" allowsSorting>
            Media Type
          </TableColumn>
          <TableColumn key="tmdbId" allowsSorting>
            TMDB ID
          </TableColumn>
          <TableColumn key="imdbId" allowsSorting>
            IMDb ID
          </TableColumn>
          <TableColumn key="episode" allowsSorting>
            Episode
          </TableColumn>
          <TableColumn key="status" allowsSorting>
            Status
          </TableColumn>
          <TableColumn key="createdAt" allowsSorting>
            Created
          </TableColumn>
          <TableColumn key="updatedAt" allowsSorting>
            Updated
          </TableColumn>
        </TableHeader>
        <TableBody
          items={rows}
          isLoading={loading}
          loadingContent={
            <div className="flex justify-center p-4">
              <Spinner size="sm" label="Loading..." />
            </div>
          }
        >
          {(item) => (
            <TableRow key={item.key}>{(columnKey) => <TableCell>{getKeyValue(item, columnKey)}</TableCell>}</TableRow>
          )}
        </TableBody>
      </DynamicTable>
    )
  }, [
    loading,
    error,
    data,
    rows,
    sortBy,
    sortOrder,
    bottomContent,
    handleSort,
    topContent,
    selectedKeys,
    handleSelectionChange,
  ])

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await mediaApi.getPlexConfig()
        setPlexConfig(config as PlexConfig)
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
          status: Array.from(statusFilter)[0] as unknown as MediaStatus,
          mediaType: Array.from(mediaTypeFilter)[0] as unknown as MediaType,
        })
        setData(result)
        setError(null)
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : "Failed to fetch data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [page, pageSize, sortBy, sortOrder, filterValue, statusFilter, mediaTypeFilter])

  return tableComponent
}
