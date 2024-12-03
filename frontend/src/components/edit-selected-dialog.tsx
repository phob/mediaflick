"use client"

import * as React from "react"
import { ScannedFile, MediaType } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

interface EditSelectedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFiles: ScannedFile[]
  onDataChange: () => Promise<void>
}

export function EditSelectedDialog({
  open,
  onOpenChange,
  selectedFiles,
  onDataChange,
}: EditSelectedDialogProps) {
  const [editedFiles, setEditedFiles] = React.useState<ScannedFile[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    setEditedFiles([...selectedFiles])
  }, [selectedFiles])

  const handleInputChange = (index: number, field: keyof ScannedFile, value: string) => {
    const newFiles = [...editedFiles]
    const file = { ...newFiles[index] }

    if (field === 'tmdbId') {
      file[field] = value ? parseInt(value) : undefined
    } else if (field === 'seasonNumber' || field === 'episodeNumber') {
      file[field] = value ? parseInt(value) : undefined
    }

    newFiles[index] = file
    setEditedFiles(newFiles)
  }

  const getFilename = (path: string | null) => {
    if (!path) return null
    return path.split(/[/\\]/).pop()
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // Save each file
      for (const file of editedFiles) {
        const response = await fetch(`/api/ScannedFiles/${file.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(file),
        })

        if (!response.ok) {
          throw new Error(`Failed to update file ${file.sourceFile}`)
        }
      }

      await onDataChange()
      onOpenChange(false)
      toast({
        title: "Success",
        description: "Files updated successfully",
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update files",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Selected Files</DialogTitle>
          <DialogDescription>
            Edit TMDb ID and episode information for selected files.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Filename</TableHead>
                <TableHead className="w-[100px]">TMDb ID</TableHead>
                <TableHead className="w-[100px]">Season</TableHead>
                <TableHead className="w-[100px]">Episode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editedFiles.map((file, index) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    {getFilename(file.sourceFile)}
                    <div className="text-xs text-muted-foreground truncate max-w-[480px]" title={file.sourceFile}>
                      {file.sourceFile} - {file.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={file.tmdbId || ''}
                      onChange={(e) => handleInputChange(index, 'tmdbId', e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    {file.mediaType === MediaType.TvShows && (
                      <Input
                        type="number"
                        value={file.seasonNumber || ''}
                        onChange={(e) => handleInputChange(index, 'seasonNumber', e.target.value)}
                        className="w-24"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {file.mediaType === MediaType.TvShows && (
                      <Input
                        type="number"
                        value={file.episodeNumber || ''}
                        onChange={(e) => handleInputChange(index, 'episodeNumber', e.target.value)}
                        className="w-24"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 