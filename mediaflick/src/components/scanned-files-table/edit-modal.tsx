"use client"

import React, { useEffect, useState } from "react"

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react"

import type { Row } from "@/components/scanned-files-table/types"
import { mediaApi } from "@/lib/api/endpoints"
import { ScannedFile } from "@/lib/api/types"

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRows: Row[]
  onSave: (updatedRows: Row[]) => void
}

interface EditableRow extends Row {
  seasonNumber?: number
  episodeNumber?: number
}

export function EditModal({ isOpen, onClose, selectedRows, onSave }: EditModalProps) {
  const [editableRows, setEditableRows] = useState<EditableRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchSelectedFiles = async () => {
      if (!isOpen || selectedRows.length === 0) return

      setLoading(true)
      try {
        const selectedIds = selectedRows.map((row) => row.key)
        const result = await mediaApi.getScannedFiles({
          ids: selectedIds,
          pageSize: selectedIds.length,
        })

        // Transform ScannedFiles to EditableRows
        const transformedRows = result.items.map((file: ScannedFile): EditableRow => {
          // Parse the episode field which is in format "S01E02" or empty
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

  const handleSeasonChange = (index: number, value: string) => {
    setEditableRows((prev) => {
      const newRows = [...prev]
      newRows[index] = {
        ...newRows[index],
        seasonNumber: value === "" ? undefined : Number(value),
      }
      return newRows
    })
  }

  const handleEpisodeChange = (index: number, value: string) => {
    setEditableRows((prev) => {
      const newRows = [...prev]
      newRows[index] = {
        ...newRows[index],
        episodeNumber: value === "" ? undefined : Number(value),
      }
      return newRows
    })
  }

  const handleSave = () => {
    const updatedRows = editableRows.map((row) => ({
      ...row,
      episode:
        row.seasonNumber && row.episodeNumber
          ? `S${row.seasonNumber.toString().padStart(2, "0")}E${row.episodeNumber.toString().padStart(2, "0")}`
          : "",
    }))
    onSave(updatedRows)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Edit Selected Files</ModalHeader>
            <ModalBody>
              {loading ? (
                <div className="flex justify-center p-4">
                  <Spinner size="lg" label="Loading files..." />
                </div>
              ) : (
                <Table aria-label="Selected files table">
                  <TableHeader>
                    <TableColumn key="sourceFile">Source File</TableColumn>
                    <TableColumn key="tmdbId">TMDB ID</TableColumn>
                    <TableColumn key="season">Season</TableColumn>
                    <TableColumn key="episode">Episode</TableColumn>
                    <TableColumn key="status">Status</TableColumn>
                  </TableHeader>
                  <TableBody items={editableRows}>
                    {(item: EditableRow) => (
                      <TableRow key={item.key}>
                        <TableCell>{item.sourceFile}</TableCell>
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
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
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
