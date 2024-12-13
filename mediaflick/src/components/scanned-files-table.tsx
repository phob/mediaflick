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
} from "@nextui-org/react"
import type { Selection, SortDescriptor } from "@nextui-org/react"
import { format } from "date-fns"
import { Edit, Search } from "lucide-react"

import { mediaApi } from "@/lib/api/endpoints"
import { MediaStatus, MediaType, PagedResult, PlexConfig, ScannedFile } from "@/lib/api/types"

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

  const getStatusClass = (status: MediaStatus) => {
    switch (status) {
      case MediaStatus.Processing:
        return "bg-yellow-100 text-yellow-800"
      case MediaStatus.Success:
        return "bg-green-100 text-green-800"
      case MediaStatus.Failed:
        return "bg-red-100 text-red-800"
      case MediaStatus.Duplicate:
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: MediaStatus) => {
    switch (status) {
      case MediaStatus.Processing:
        return "Processing"
      case MediaStatus.Success:
        return "Success"
      case MediaStatus.Failed:
        return "Failed"
      case MediaStatus.Duplicate:
        return "Duplicate"
    }
  }

  const getMediaTypeLabel = (mediaType: MediaType) => {
    switch (mediaType) {
      case MediaType.Movies:
        return "Movies"
      case MediaType.TvShows:
        return "TV Shows"
      case MediaType.Extras:
        return "Extras"
      case MediaType.Unknown:
        return "Unknown"
      default:
        return "Unknown"
    }
  }

  const getFileName = (filePath: string) => {
    return filePath.split(/[\\/]/).pop() || filePath
  }

  const formatEpisodeNumber = (seasonNumber?: number, episodeNumber?: number) => {
    if (seasonNumber === undefined || episodeNumber === undefined) {
      return "-"
    }
    return `S${seasonNumber.toString().padStart(2, "0")}E${episodeNumber.toString().padStart(2, "0")}`
  }

  const stripFolderPrefix = (path: string, mediaType: MediaType) => {
    if (!plexConfig || !path) return path

    const mapping = plexConfig.folderMappings.find((m) => m.mediaType === mediaType)
    if (!mapping) return path

    if (path.startsWith(mapping.sourceFolder)) {
      return path.slice(mapping.sourceFolder.length).replace(/^[/\\]+/, "")
    }

    if (path.startsWith(mapping.destinationFolder)) {
      return path.slice(mapping.destinationFolder.length).replace(/^[/\\]+/, "")
    }

    const lastSlashIndex = path.lastIndexOf("/")
    const lastBackslashIndex = path.lastIndexOf("\\")
    const lastIndex = Math.max(lastSlashIndex, lastBackslashIndex)
    if (lastIndex >= 0) {
      return path.slice(0, lastIndex + 1)
    }

    return path
  }

  const hasSearchFilter = Boolean(filterValue)

  const filteredItems = React.useMemo(() => {
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
          <div className="flex flex-col gap-1">
            <span className="font-medium">{getFileName(file.sourceFile)}</span>
            <span className="break-all text-xs text-gray-500">
              {stripFolderPrefix(file.sourceFile, file.mediaType)}
            </span>
          </div>
        ),
        destFile: (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{file.destFile ? getFileName(file.destFile) : "-"}</span>
            {file.destFile && (
              <span className="break-all text-xs text-gray-500">
                {stripFolderPrefix(file.destFile, file.mediaType)}
              </span>
            )}
          </div>
        ),
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

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
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
            <Button
              color="primary"
              endContent={<Edit className="h-4 w-4" />}
              isDisabled={selectedKeys === "all" || Array.from(selectedKeys).length === 0}
            >
              Edit Selected
            </Button>
          </div>
        </div>
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
      </div>
    )
  }, [filterValue, statusFilter, mediaTypeFilter, selectedKeys, filteredItems.length, onPageSizeChange])

  const handleSort = React.useCallback(
    (descriptor: SortDescriptor) => {
      const column = String(descriptor.column)
      if (sortBy === column) {
        onSortOrderChange?.(descriptor.direction === "ascending" ? "desc" : "asc")
      } else {
        onSortByChange?.(column)
        onSortOrderChange?.("asc")
      }
    },
    [sortBy, onSortOrderChange, onSortByChange]
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
        className="min-w-full"
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
        defaultSelectedKeys={new Set()}
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
            <TableRow key={item.key}>{(columnKey) => <TableCell>{item[columnKey as keyof Row]}</TableCell>}</TableRow>
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
        console.log("API Response:", result)
        console.log("Status Filter:", Array.from(statusFilter)[0])
        console.log("Media Type Filter:", Array.from(mediaTypeFilter)[0])
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
