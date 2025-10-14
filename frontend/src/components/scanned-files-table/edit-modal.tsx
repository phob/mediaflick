import React, { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { MediaSearch } from "@/components/media-search/media-search"
import { MovieEditTable } from "@/components/scanned-files-table/movie-edit-table"
import { TvShowEditTable } from "@/components/scanned-files-table/tv-show-edit-table"
import { MediaType, ScannedFile, Row } from "@/lib/api/types"
import { mediaApi } from "@/lib/api/endpoints"
import { useToast } from "@/hooks/use-toast"

interface EditModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly selectedRows: Row[]
  readonly onSave: (updatedRows: Row[]) => void
  readonly initialMediaType: MediaType.Movies | MediaType.TvShows
}

interface EditableRow extends Row {
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  title?: string
  year?: number
}

const mediaTypeOptions = [
  { uid: MediaType.TvShows, name: "TV Shows" },
  { uid: MediaType.Movies, name: "Movies" },
] as const

export function EditModal({ isOpen, onClose, selectedRows, onSave, initialMediaType }: EditModalProps) {
  const [editableRows, setEditableRows] = useState<EditableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType.Movies | MediaType.TvShows>(initialMediaType)
  const [showMediaTypeWarning, setShowMediaTypeWarning] = useState(false)
  const [pendingMediaType, setPendingMediaType] = useState<MediaType.Movies | MediaType.TvShows | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setSelectedMediaType(initialMediaType)
  }, [initialMediaType])

  useEffect(() => {
    const fetchSelectedFiles = async () => {
      if (!isOpen || selectedRows.length === 0) return

      setLoading(true)
      try {
        const selectedIds = selectedRows.map((row) => row.key)
        const result = await mediaApi.getScannedFiles({
          ids: selectedIds,
          pageSize: selectedIds.length,
          sortBy: "sourceFile",
          sortOrder: "asc",
        })

        // Transform ScannedFiles to EditableRows
        const transformedRows = result.items.map(transformScannedFileToEditableRow)

        setEditableRows(transformedRows)
      } catch (error) {
        console.error("Failed to fetch selected files:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSelectedFiles()
  }, [isOpen, selectedRows])

  const handleMediaTypeChange = (type: string) => {
    const newType = type as MediaType.Movies | MediaType.TvShows
    if (newType !== selectedMediaType) {
      setPendingMediaType(newType)
      setShowMediaTypeWarning(true)
    }
  }

  const handleConfirmMediaTypeChange = () => {
    if (!pendingMediaType) return

    setEditableRows((prev) =>
      prev.map((row) => ({
        ...row,
        tmdbId: 0,
        seasonNumber: undefined,
        episodeNumber: undefined,
        episodeNumber2: undefined,
        mediaType: pendingMediaType,
      }))
    )

    setSelectedMediaType(pendingMediaType)
    setShowMediaTypeWarning(false)
    setPendingMediaType(null)

    toast({
      title: "Media type changed",
      description: "All metadata has been cleared.",
    })
  }

  const handleMediaSelect = (tmdbId: number) => {
    // Update all selected rows with the new TMDB ID
    setEditableRows((prev) =>
      prev.map((row) => ({
        ...row,
        tmdbId,
        mediaType: selectedMediaType,
      }))
    )
  }

  const handleSave = () => {
    onSave([...editableRows])
  }

  const handleClearRows = () => {
    setEditableRows((prev) =>
      prev.map((row) => ({
        ...row,
        tmdbId: 0,
        seasonNumber: undefined,
        episodeNumber: undefined,
        episodeNumber2: undefined,
      }))
    )
  }

  const transformScannedFileToEditableRow = (file: ScannedFile): EditableRow => ({
    key: file.id,
    sourceFile: file.sourceFile,
    destFile: file.destFile ?? "",
    tmdbId: file.tmdbId ?? 0,
    imdbId: file.imdbId ?? "",
    mediaType: file.mediaType,
    status: file.status,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    seasonNumber: file.seasonNumber,
    episodeNumber: file.episodeNumber,
    episodeNumber2: file.episodeNumber2,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl w-[min(1200px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Selected Files</DialogTitle>
        </DialogHeader>
        <div className="mb-4 flex items-center gap-4">
          {selectedMediaType === MediaType.TvShows ? (
            <MediaSearch className="flex-1" mediaType={selectedMediaType} onMediaSelect={handleMediaSelect} />
          ) : (
            <div className="flex-1">
              <p>Movies are searched by their respective Table row.</p>
            </div>
          )}

          <Select
            value={selectedMediaType}
            onValueChange={handleMediaTypeChange}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Media Type" />
            </SelectTrigger>
            <SelectContent>
              {mediaTypeOptions.map((type) => (
                <SelectItem key={type.uid} value={type.uid}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {selectedMediaType === MediaType.Movies ? (
            <MovieEditTable loading={loading} editableRows={editableRows} onRowsChange={setEditableRows} />
          ) : (
            <TvShowEditTable loading={loading} editableRows={editableRows} onRowsChange={setEditableRows} />
          )}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleClearRows}>
            Clear
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={showMediaTypeWarning} onOpenChange={setShowMediaTypeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Media Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching media type will clear all metadata (TMDb ID, season, episode numbers). 
              This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowMediaTypeWarning(false)
              setPendingMediaType(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMediaTypeChange}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
