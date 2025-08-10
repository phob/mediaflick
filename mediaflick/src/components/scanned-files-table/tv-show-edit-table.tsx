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
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

import { Row } from "@/lib/api/types"
import { getFileName } from "@/lib/files-folders"

interface TvShowEditTableProps {
  loading: boolean
  editableRows: Row[]
  onRowsChange: (rows: Row[]) => void
}

export function TvShowEditTable({ loading, editableRows, onRowsChange }: Readonly<TvShowEditTableProps>) {
  const handleSeasonChange = (index: number, value: string) => {
    const newRows = [...editableRows]
    const seasonNumber = value === "" ? undefined : Number(value)
    
    newRows[index] = {
      ...newRows[index],
      seasonNumber,
    }
    
    // Update all subsequent rows to have the same season number
    for (let i = index + 1; i < newRows.length; i++) {
      newRows[i] = {
        ...newRows[i],
        seasonNumber,
      }
    }
    
    onRowsChange(newRows)
  }

  const handleEpisodeChange = (index: number, value: string) => {
    const newRows = [...editableRows]
    const episodeNumber = value === "" ? undefined : Number(value)
    
    newRows[index] = {
      ...newRows[index],
      episodeNumber,
    }
    
    // If episode number is set, increment episode numbers for subsequent rows in same season that don't have ignore checkbox checked
    if (episodeNumber !== undefined) {
      const currentSeason = newRows[index].seasonNumber
      let nextEpisode = episodeNumber + 1
      
      for (let i = index + 1; i < newRows.length; i++) {
        // Only update if same season and ignore checkbox is not checked
        if (newRows[i].seasonNumber === currentSeason && !newRows[i].ignoreEpisodeIncrement) {
          newRows[i] = {
            ...newRows[i],
            episodeNumber: nextEpisode,
          }
          nextEpisode++
        }
      }
    }
    
    onRowsChange(newRows)
  }

  const handleEpisode2Change = (index: number, value: string) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      episodeNumber2: value === "" ? undefined : Number(value),
    }
    onRowsChange(newRows)
  }

  const handleIgnoreChange = (index: number, checked: boolean) => {
    const newRows = [...editableRows]
    newRows[index] = {
      ...newRows[index],
      ignoreEpisodeIncrement: checked,
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
            <TableHead>Episode 2</TableHead>
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.ignoreEpisodeIncrement ?? false}
                    onCheckedChange={(checked) => handleIgnoreChange(index, checked as boolean)}
                  />
                  <Input
                    type="number"
                    className="w-20"
                    value={item.episodeNumber?.toString() ?? ""}
                    onChange={(e) => handleEpisodeChange(index, e.target.value)}
                    min={1}
                  />
                </div>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-20"
                  value={item.episodeNumber2?.toString() ?? ""}
                  onChange={(e) => handleEpisode2Change(index, e.target.value)}
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
