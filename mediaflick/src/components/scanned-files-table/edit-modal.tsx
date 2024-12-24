import React, { useEffect, useState } from "react"

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@nextui-org/react"

import { MediaSearch } from "@/components/media-search/media-search"
import { MovieEditTable } from "@/components/scanned-files-table/movie-edit-table"
import { TvShowEditTable } from "@/components/scanned-files-table/tv-show-edit-table"
import type { Row } from "@/components/scanned-files-table/types"
import { mediaApi } from "@/lib/api/endpoints"
import { MediaType, ScannedFile } from "@/lib/api/types"

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRows: Row[]
  onSave: (updatedRows: Row[]) => void
  initialMediaType: MediaType.Movies | MediaType.TvShows
}

interface EditableRow extends Row {
  seasonNumber?: number
  episodeNumber?: number
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
        const transformedRows = result.items.map((file: ScannedFile): EditableRow => {
          return {
            key: file.id,
            sourceFile: file.sourceFile,
            destFile: file.destFile || "",
            tmdbId: file.tmdbId || 0,
            imdbId: file.imdbId || "",
            mediaType: file.mediaType,
            status: file.status,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            seasonNumber: file.seasonNumber,
            episodeNumber: file.episodeNumber,
          }
        })

        setEditableRows(transformedRows)
      } catch (error) {
        console.error("Failed to fetch selected files:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSelectedFiles()
  }, [isOpen, selectedRows])

  const handleMediaTypeChange = (type: MediaType.Movies | MediaType.TvShows) => {
    setSelectedMediaType(type)
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
    onSave(editableRows)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Edit Selected Files</ModalHeader>
            <ModalBody>
              <div className="mb-4 flex items-center gap-4">
                {selectedMediaType === MediaType.TvShows ? (
                  <MediaSearch className="flex-1" mediaType={selectedMediaType} onMediaSelect={handleMediaSelect} />
                ) : (
                  <div className="flex-1">
                    <p>Movies are searched by their respective Table row.</p>
                  </div>
                )}

                <Select
                  label="Media Type"
                  className="w-36"
                  selectedKeys={new Set([selectedMediaType])}
                  onChange={(e) => handleMediaTypeChange(e.target.value as MediaType.Movies | MediaType.TvShows)}
                  size="sm"
                >
                  {mediaTypeOptions.map((type) => (
                    <SelectItem key={type.uid} value={type.uid}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              {selectedMediaType === MediaType.Movies ? (
                <MovieEditTable loading={loading} editableRows={editableRows} onRowsChange={setEditableRows} />
              ) : (
                <TvShowEditTable loading={loading} editableRows={editableRows} onRowsChange={setEditableRows} />
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave} isDisabled={loading}>
                Save Changes
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
