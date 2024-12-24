import React from "react"

import { Input, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@nextui-org/react"

import type { Row } from "@/components/scanned-files-table/types"
import { getFileName } from "@/lib/files-folders"

interface TvShowEditTableProps {
  loading: boolean
  editableRows: Row[]
  onRowsChange: (rows: Row[]) => void
}

export function TvShowEditTable({ loading, editableRows, onRowsChange }: TvShowEditTableProps) {
  const handleSeasonChange = (index: number, value: string) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      seasonNumber: value === "" ? undefined : Number(value),
    }
    onRowsChange(newRows)
  }

  const handleEpisodeChange = (index: number, value: string) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      episodeNumber: value === "" ? undefined : Number(value),
    }
    onRowsChange(newRows)
  }

  return loading ? (
    <div className="flex justify-center p-4">
      <Spinner size="lg" label="Loading files..." />
    </div>
  ) : (
    <Table aria-label="Selected TV show files table">
      <TableHeader>
        <TableColumn key="sourceFile">Source File</TableColumn>
        <TableColumn key="tmdbId">TMDB ID</TableColumn>
        <TableColumn key="season">Season</TableColumn>
        <TableColumn key="episode">Episode</TableColumn>
        <TableColumn key="status">Status</TableColumn>
      </TableHeader>
      <TableBody items={editableRows}>
        {(item) => (
          <TableRow key={item.key}>
            <TableCell>{getFileName(item.sourceFile as string)}</TableCell>
            <TableCell>{item.tmdbId}</TableCell>
            <TableCell>
              <Input
                type="number"
                size="sm"
                value={item.seasonNumber?.toString() ?? ""}
                onChange={(e) => {
                  const index = editableRows.findIndex((row) => row.key === item.key)
                  if (index !== -1) {
                    handleSeasonChange(index, e.target.value)
                  }
                }}
                className="w-20"
                min={1}
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                size="sm"
                value={item.episodeNumber?.toString() ?? ""}
                onChange={(e) => {
                  const index = editableRows.findIndex((row) => row.key === item.key)
                  if (index !== -1) {
                    handleEpisodeChange(index, e.target.value)
                  }
                }}
                className="w-20"
                min={1}
              />
            </TableCell>
            <TableCell>{item.status}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
