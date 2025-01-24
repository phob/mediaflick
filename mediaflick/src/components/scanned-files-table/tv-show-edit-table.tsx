import React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

import type { Row } from "@/components/scanned-files-table/types"
import { getFileName } from "@/lib/files-folders"

interface TvShowEditTableProps {
  loading: boolean
  editableRows: Row[]
  onRowsChange: (rows: Row[]) => void
}

export function TvShowEditTable({ loading, editableRows, onRowsChange }: Readonly<TvShowEditTableProps>) {
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
            <TableHead>Season</TableHead>
            <TableHead>Episode</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableRows.map((item, index) => (
            <TableRow key={item.key}>
              <TableCell>{getFileName(item.sourceFile as string)}</TableCell>
              <TableCell>{item.tmdbId}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-20"
                  value={item.seasonNumber?.toString() ?? ""}
                  onChange={(e) => handleSeasonChange(index, e.target.value)}
                  min={1}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-20"
                  value={item.episodeNumber?.toString() ?? ""}
                  onChange={(e) => handleEpisodeChange(index, e.target.value)}
                  min={1}
                />
              </TableCell>
              <TableCell>{item.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
