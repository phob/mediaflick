import React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MediaType, Row } from "@/lib/api/types"

interface TableComponentProps {
  loading: boolean
  rows: Row[]
  sortBy: string
  sortOrder: string
  selectedKeys: Set<number>
  newEntries: Set<number>
  mediaTypeFilter: MediaType
  visibleColumns: {
    sourceFile: boolean
    destFile: boolean
    genres: boolean
    mediaType: boolean
    tmdbId: boolean
    imdbId: boolean
    episode: boolean
    status: boolean
    createdAt: boolean
    updatedAt: boolean
  }
  density: "comfortable" | "compact"
  onSort: (column: string) => void
  onSelectAll: (checked: boolean) => void
  onCheckboxChange: (itemKey: number, checked: boolean) => void
  onMouseDown: (e: React.MouseEvent, itemKey: number) => void
  onMouseEnter: (itemKey: number) => void
  onRowClick: (e: React.MouseEvent, key: number) => void
  didDragRef: React.MutableRefObject<boolean>
}

export function TableComponent({
  loading,
  rows,
  sortBy,
  sortOrder,
  selectedKeys,
  newEntries,
  mediaTypeFilter,
  visibleColumns,
  density,
  onSort,
  onSelectAll,
  onCheckboxChange,
  onMouseDown,
  onMouseEnter,
  onRowClick,
  didDragRef,
}: TableComponentProps) {
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
      <div className="rounded-md border">
        <Table
          className={cn(
            "whitespace-nowrap table-fixed",
            density === "compact"
              ? "[&_td]:py-1 [&_th]:h-8 [&_td]:text-xs [&_th]:text-xs"
              : "[&_td]:py-2 [&_th]:h-10"
          )}
        >
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky top-0 left-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Checkbox
                  checked={selectedKeys.size > 0 && selectedKeys.size === rows.length}
                  onCheckedChange={onSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              {visibleColumns.sourceFile && (
                <TableHead
                  onClick={() => onSort("sourceFile")}
                  className="cursor-pointer min-w-[24rem] sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                >
                  Source File {sortBy === "sourceFile" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.destFile && (
                <TableHead
                  onClick={() => onSort("destFile")}
                  className="cursor-pointer min-w-[20rem] sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                >
                  Destination {sortBy === "destFile" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.genres && (
                <TableHead onClick={() => onSort("genres")} className="cursor-pointer w-[16rem] sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  Genres {sortBy === "genres" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.mediaType && (
                <TableHead onClick={() => onSort("mediaType")} className="cursor-pointer w-[10rem] sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  Media Type {sortBy === "mediaType" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.tmdbId && (
                <TableHead onClick={() => onSort("tmdbId")} className="cursor-pointer w-[6rem] text-right sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  TMDB ID {sortBy === "tmdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.imdbId && (
                <TableHead onClick={() => onSort("imdbId")} className="cursor-pointer w-[7rem] text-right sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  IMDb ID {sortBy === "imdbId" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {mediaTypeFilter === MediaType.TvShows && visibleColumns.episode && (
                <TableHead onClick={() => onSort("episode")} className="cursor-pointer w-[7rem] text-center sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  Episode {sortBy === "episode" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead onClick={() => onSort("status")} className="cursor-pointer w-[8rem] text-center sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.createdAt && (
                <TableHead onClick={() => onSort("createdAt")} className="cursor-pointer w-[9rem] text-right sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  Created {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
              )}
              {visibleColumns.updatedAt && (
                <TableHead onClick={() => onSort("updatedAt")} className="cursor-pointer w-[9rem] text-right sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleHeadersCount} className="h-24 text-center text-muted-foreground">
                  No results. Try adjusting filters or search.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item) => (
                <TableRow
                  key={item.key}
                  className={cn(
                    "transition-colors cursor-pointer select-none odd:bg-muted/20",
                    newEntries.has(item.key) ? "animate-new-row" : "",
                    selectedKeys.has(item.key) ? "bg-muted/40 ring-1 ring-primary/20" : "",
                    "hover:bg-muted/30"
                  )}
                  data-selected={selectedKeys.has(item.key)}
                  onMouseDown={(e) => onMouseDown(e, item.key)}
                  onMouseEnter={() => onMouseEnter(item.key)}
                  onClick={(e) => {
                    // Don't trigger row selection if clicking the checkbox
                    if (e.target instanceof HTMLElement && 
                        (e.target.closest('button') || // For checkbox
                        e.target.closest('a'))) { // For any links
                      return
                    }
                    onRowClick(e, item.key)
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="sticky left-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <Checkbox
                      checked={selectedKeys.has(item.key)}
                      onCheckedChange={(checked) => onCheckboxChange(item.key, !!checked)}
                      aria-label={`Select row ${item.key}`}
                    />
                  </TableCell>
                  {visibleColumns.sourceFile && (<TableCell className="min-w-[24rem]">{item.sourceFile}</TableCell>)}
                  {visibleColumns.destFile && (<TableCell className="min-w-[20rem]">{item.destFile}</TableCell>)}
                  {visibleColumns.genres && (<TableCell className="w-[16rem]">{item.genres}</TableCell>)}
                  {visibleColumns.mediaType && (<TableCell className="w-[10rem]">{item.mediaType}</TableCell>)}
                  {visibleColumns.tmdbId && (<TableCell className="w-[6rem] text-right font-mono">{item.tmdbId}</TableCell>)}
                  {visibleColumns.imdbId && (<TableCell className="w-[7rem] text-right font-mono">{item.imdbId}</TableCell>)}
                  {mediaTypeFilter === MediaType.TvShows && visibleColumns.episode && (
                    <TableCell className="w-[7rem] text-center">{item.episode}</TableCell>
                  )}
                  {visibleColumns.status && (<TableCell className="w-[8rem] text-center">{item.status}</TableCell>)}
                  {visibleColumns.createdAt && (<TableCell className="w-[9rem] text-right">{item.createdAt}</TableCell>)}
                  {visibleColumns.updatedAt && (<TableCell className="w-[9rem] text-right">{item.updatedAt}</TableCell>)}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
