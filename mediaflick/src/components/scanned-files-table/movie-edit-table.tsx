import React from "react"

import { Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@nextui-org/react"

import { MediaSearch } from "@/components/media-search/media-search"
import type { Row } from "@/components/scanned-files-table/types"
import { MediaType } from "@/lib/api/types"
import { getFileName } from "@/lib/files-folders"

interface MovieEditTableProps {
  loading: boolean
  editableRows: Row[]
  onRowsChange: (rows: Row[]) => void
}

export function MovieEditTable({ loading, editableRows, onRowsChange }: MovieEditTableProps) {
  const handleMediaSelect = (index: number, tmdbId: number) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      tmdbId,
      mediaType: MediaType.Movies,
    }
    onRowsChange(newRows)
  }

  return loading ? (
    <div className="flex justify-center p-4">
      <Spinner size="lg" label="Loading files..." />
    </div>
  ) : (
    <Table aria-label="Selected movie files table">
      <TableHeader>
        <TableColumn key="sourceFile">Source File</TableColumn>
        <TableColumn key="tmdbId">TMDB ID</TableColumn>
        <TableColumn key="title" className="w-full/2">
          Title
        </TableColumn>
        <TableColumn key="status">Status</TableColumn>
      </TableHeader>
      <TableBody items={editableRows}>
        {(item) => (
          <TableRow key={item.key}>
            <TableCell>{getFileName(item.sourceFile as string)}</TableCell>
            <TableCell>{item.tmdbId}</TableCell>
            <TableCell>
              <MediaSearch
                mediaType={MediaType.Movies}
                onMediaSelect={(tmdbId) => {
                  const index = editableRows.findIndex((row) => row.key === item.key)
                  if (index !== -1) {
                    handleMediaSelect(index, tmdbId)
                  }
                }}
                className="w-full"
                label="Search Movie"
              />
            </TableCell>
            <TableCell>{item.status}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
