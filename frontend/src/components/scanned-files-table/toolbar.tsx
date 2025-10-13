"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Columns3, Edit, Search, Trash2 } from "lucide-react"
import type { MediaStatus, MediaType, ColumnKey } from "@/lib/api/types"

type ToolbarProps = {
  totalResults: number
  filterValue: string
  onChangeFilterValue: (v: string) => void
  pageSize: number
  onPageSizeChange?: (n: number) => void
  statusFilter: MediaStatus
  statusOptions: readonly { uid: string; name: string }[]
  onStatusChange?: (s: MediaStatus) => void
  mediaTypeFilter: MediaType
  mediaTypeOptions: readonly { uid: string; name: string }[]
  onMediaTypeChange?: (m: MediaType) => void
  selectedCount: number
  onEditSelected: () => void
  onDeleteSelected: () => void
  onConvertToExtras: () => void
  onConvertToMovie: () => void
  onConvertToTvShow: () => void
  canConvertToExtras: boolean
  canConvertFromExtras: boolean
  columnsPopoverOpen: boolean
  setColumnsPopoverOpen: (b: boolean) => void
  visibleColumns: Record<ColumnKey, boolean>
  setVisibleColumns: React.Dispatch<React.SetStateAction<Record<ColumnKey, boolean>>>
}

export function ScannedFilesToolbar(props: ToolbarProps) {
  const {
    totalResults,
    filterValue,
    onChangeFilterValue,
    pageSize,
    onPageSizeChange,
    statusFilter,
    statusOptions,
    onStatusChange,
    mediaTypeFilter,
    mediaTypeOptions,
    onMediaTypeChange,
    selectedCount,
    onEditSelected,
    onDeleteSelected,
    onConvertToExtras,
    onConvertToMovie,
    onConvertToTvShow,
    canConvertToExtras,
    canConvertFromExtras,
    columnsPopoverOpen,
    setColumnsPopoverOpen,
    visibleColumns,
    setVisibleColumns,
  } = props

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total {totalResults} files</span>
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
                {([
                  { key: 'sourceFile', label: 'Source File' },
                  { key: 'destFile', label: 'Destination' },
                  { key: 'fileSize', label: 'Size' },
                  { key: 'fileHash', label: 'Hash' },
                  { key: 'genres', label: 'Genres' },
                  { key: 'mediaType', label: 'Media Type' },
                  { key: 'tmdbId', label: 'TMDB ID' },
                  { key: 'imdbId', label: 'IMDb ID' },
                  { key: 'episode', label: 'Episode (TV Shows)' },
                  { key: 'status', label: 'Status' },
                  { key: 'createdAt', label: 'Created' },
                  { key: 'updatedAt', label: 'Updated' },
                ] as { key: ColumnKey; label: string }[]).map(({ key, label }) => (
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
              onChangeFilterValue(e.target.value)
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              onStatusChange?.(value as MediaStatus)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={mediaTypeFilter}
            onValueChange={(value) => {
              onMediaTypeChange?.(value as MediaType)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Media Type" />
            </SelectTrigger>
            <SelectContent>
              {mediaTypeOptions.map((m) => (
                <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={selectedCount === 0}
            onClick={onEditSelected}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Selected
          </Button>
          <Button
            variant="destructive"
            disabled={selectedCount === 0}
            onClick={onDeleteSelected}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
          {canConvertToExtras && (
            <Button
              variant="outline"
              disabled={selectedCount === 0}
              onClick={onConvertToExtras}
            >
              Mark as Extra
            </Button>
          )}
          {canConvertFromExtras && (
            <>
              <Button
                variant="outline"
                disabled={selectedCount === 0}
                onClick={onConvertToMovie}
              >
                Convert to Movie
              </Button>
              <Button
                variant="outline"
                disabled={selectedCount === 0}
                onClick={onConvertToTvShow}
              >
                Convert to TV Show
              </Button>
            </>
          )}
        </div>
      </div>
      <Separator className="my-4" />
    </div>
  )
}


