import Image from "next/image"
import React, { useEffect, useState } from "react"

import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
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
import { getTMDBImageUrl } from "@/lib/api/tmdb"
import { MediaSearchResult, MediaType, ScannedFile } from "@/lib/api/types"
import { getFileName } from "@/lib/files-folders"

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

const mediaTypeOptions = [
  { uid: MediaType.TvShows, name: "TV Shows" },
  { uid: MediaType.Movies, name: "Movies" },
] as const

export function EditModal({ isOpen, onClose, selectedRows, onSave }: EditModalProps) {
  const [editableRows, setEditableRows] = useState<EditableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([])
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType>(MediaType.TvShows)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchValue, setSearchValue] = useState("")

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

  const handleSearch = async (value: string) => {
    setSearchValue(value)

    if (!value) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const results = await (selectedMediaType === MediaType.Movies
        ? mediaApi.searchMovies(value)
        : mediaApi.searchTvShows(value))
      console.log("Search results (detailed):", {
        count: results.length,
        firstResult: results[0],
        hasPosters: results.some((r) => r.posterPath),
        allFields: results[0] ? Object.keys(results[0]) : [],
        posterPaths: results.map((r) => r.posterPath).filter(Boolean),
      })
      setSearchResults(results)
    } catch (error) {
      console.error("Failed to search:", error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleMediaTypeChange = (type: MediaType) => {
    setSelectedMediaType(type)
    setSearchResults([]) // Clear search results when media type changes
    setSearchValue("") // Clear search input when media type changes
  }

  const handleMediaSelect = (key: React.Key | null) => {
    if (!key) return

    const tmdbId = Number(key)
    if (!isNaN(tmdbId)) {
      // Update all selected rows with the new TMDB ID
      setEditableRows((prev) =>
        prev.map((row) => ({
          ...row,
          tmdbId,
          mediaType: selectedMediaType,
        }))
      )
      // Clear search after selection
      //setSearchValue("")
      //setSearchResults([])
    }
  }

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
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Edit Selected Files</ModalHeader>
            <ModalBody>
              <div className="mb-4 flex items-center gap-4">
                <Autocomplete
                  label="Search Media"
                  className="flex-1"
                  size="sm"
                  inputValue={searchValue}
                  onInputChange={handleSearch}
                  isLoading={searchLoading}
                  onSelectionChange={handleMediaSelect}
                  defaultItems={searchResults}
                >
                  {(item) => (
                    <AutocompleteItem key={item.tmdbId} textValue={item.title}>
                      <div className="flex items-center gap-2">
                        {item.posterPath && (
                          <Image
                            src={getTMDBImageUrl(item.posterPath, "w92") || ""}
                            alt={item.title}
                            width={32}
                            height={48}
                            className="rounded object-cover"
                          />
                        )}
                        <div>
                          {item.title} {item.year ? `(${item.year})` : ""}
                        </div>
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <Select
                  label="Media Type"
                  className="w-36"
                  selectedKeys={new Set([selectedMediaType])}
                  onChange={(e) => handleMediaTypeChange(e.target.value as MediaType)}
                  size="sm"
                >
                  {mediaTypeOptions.map((type) => (
                    <SelectItem key={type.uid} value={type.uid}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
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
