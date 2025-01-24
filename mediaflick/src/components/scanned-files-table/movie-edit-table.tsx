import React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"

import { MediaSearch } from "@/components/media-search/media-search"
import type { Row } from "@/components/scanned-files-table/types"
import { MediaType } from "@/lib/api/types"
import { getFileName } from "@/lib/files-folders"

interface MovieEditTableProps {
  loading: boolean
  editableRows: Row[]
  onRowsChange: (rows: Row[]) => void
}

export function MovieEditTable({ loading, editableRows, onRowsChange }: Readonly<MovieEditTableProps>) {
  const handleMediaSelect = (index: number, tmdbId: number) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      tmdbId,
      mediaType: MediaType.Movies,
    }
    onRowsChange(newRows)
  }

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source File</TableHead>
            <TableHead>TMDB ID</TableHead>
            <TableHead className="w-full/2">Title</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableRows.map((item, index) => (
            <TableRow key={item.key}>
              <TableCell>{getFileName(item.sourceFile as string)}</TableCell>
              <TableCell>{item.tmdbId}</TableCell>
              <TableCell>
                <div>
                  <MediaSearch
                    mediaType={MediaType.Movies}
                    onMediaSelect={(tmdbId) => handleMediaSelect(index, tmdbId)}
                    className="w-full relative"
                    label="Search Movie"
                  />
                </div>
              </TableCell>
              <TableCell>{item.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
