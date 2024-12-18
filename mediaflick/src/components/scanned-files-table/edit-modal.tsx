"use client"

import React from "react"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  getKeyValue,
} from "@nextui-org/react"
import type { Row } from "@/components/scanned-files-table/types"

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRows: Row[]
  onSave: () => void
}

export function EditModal({ isOpen, onClose, selectedRows, onSave }: EditModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Edit Selected Files
            </ModalHeader>
            <ModalBody>
              <Table aria-label="Selected files table">
                <TableHeader>
                  <TableColumn key="sourceFile">Source File</TableColumn>
                  <TableColumn key="destFile">Destination</TableColumn>
                  <TableColumn key="mediaType">Media Type</TableColumn>
                  <TableColumn key="tmdbId">TMDB ID</TableColumn>
                  <TableColumn key="imdbId">IMDb ID</TableColumn>
                  <TableColumn key="episode">Episode</TableColumn>
                  <TableColumn key="status">Status</TableColumn>
                </TableHeader>
                <TableBody items={selectedRows}>
                  {(item) => (
                    <TableRow key={item.key}>
                      {(columnKey) => <TableCell>{getKeyValue(item, columnKey)}</TableCell>}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={onSave}>
                Save Changes
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
} 