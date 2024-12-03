import { useState, useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit, Loader2, Trash2, ArrowUpDown } from 'lucide-react'
import { FileStatus, MediaType, ScannedFile } from '@/types/api'
import { useToast } from "@/hooks/use-toast"

type SortField = 'sourceFile' | 'destFile' | 'status' | 'mediaType' | 'tmdbId' | 'createdAt'
type SortDirection = 'asc' | 'desc'

interface ScannedFilesTableProps {
  files: ScannedFile[]
  showOnlyFilenames: boolean
  onDataChange: () => Promise<void>
}

export function ScannedFilesTable({
  files,
  showOnlyFilenames,
  onDataChange,
}: ScannedFilesTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const currentDragEndIndex = useRef<number | null>(null)

  const { toast } = useToast()

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(files.map(file => file.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleDelete = async (ids: number[]) => {
    if (!ids.length) return

    try {
      setIsDeleting(true)
      const response = await fetch('/api/ScannedFiles/batch', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ids),
      })

      if (!response.ok) {
        throw new Error('Failed to delete files')
      }

      setSelectedIds(new Set())
      await onDataChange()
      toast({
        title: "Success",
        description: `Successfully deleted ${ids.length} file${ids.length === 1 ? '' : 's'}`
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete files"
      })
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteOne = async (id: number) => {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/ScannedFiles/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      await onDataChange()
      toast({
        title: "Success",
        description: "File deleted successfully"
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete file"
      })
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusBadgeColor = (status: FileStatus) => {
    switch (status) {
      case FileStatus.Success:
        return 'bg-green-500/20 text-green-400'
      case FileStatus.Failed:
        return 'bg-red-500/20 text-red-400'
      case FileStatus.Processing:
        return 'bg-blue-500/20 text-blue-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const formatEpisodeInfo = (file: ScannedFile) => {
    if (
      file.mediaType === MediaType.TvShows && 
      typeof file.seasonNumber === 'number' && 
      typeof file.episodeNumber === 'number'
    ) {
      return `S${file.seasonNumber.toString().padStart(2, '0')}E${file.episodeNumber.toString().padStart(2, '0')}`
    }
    return '-'
  }

  const getFilename = (path: string | null) => {
    if (!path) return null
    return path.split(/[/\\]/).pop()
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (file: ScannedFile, index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)

      const newSelected = new Set(selectedIds)
      
      for (let i = start; i <= end; i++) {
        const fileInRange = files[i]
        if (fileInRange) {
          newSelected.add(fileInRange.id)
        }
      }

      setSelectedIds(newSelected)
    } else {
      handleSelectOne(file.id, !selectedIds.has(file.id))
      setLastSelectedIndex(index)
    }
  }


  const handleMouseDown = (index: number, event: React.MouseEvent) => {
    if (event.button !== 0) return // Only handle left click
    
    console.log('Mouse down at index:', index)
    setIsDragging(true)
    setDragStartIndex(index)
    setDragEndIndex(index)
    currentDragEndIndex.current = index
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!tableRef.current) return

      const rows = tableRef.current.querySelectorAll('tbody tr')
      const mouseY = e.clientY

      rows.forEach((row, idx) => {
        const rowRect = row.getBoundingClientRect()
        if (mouseY >= rowRect.top && mouseY <= rowRect.bottom) {
          console.log('Mouse moved to index:', idx)
          setDragEndIndex(idx)
          currentDragEndIndex.current = idx
        }
      })
    }

    const handleMouseUp = () => {
      const start = Math.min(index, currentDragEndIndex.current ?? index)
      const end = Math.max(index, currentDragEndIndex.current ?? index)
      
      console.log('Mouse up - Selection range:', { start, end })

      // Create a single update for the parent's Set
      const newSelectedIds = new Set(selectedIds)
      
      // First clear any existing selections
      if(!event.ctrlKey) {
        selectedIds.forEach(id => {
          newSelectedIds.delete(id)
        })
      }

      // Add all IDs in the range
      files.slice(start, end + 1).forEach(file => {
        newSelectedIds.add(file.id)
      })

      setSelectedIds(newSelectedIds)

      setIsDragging(false)
      setDragStartIndex(null)
      setDragEndIndex(null)
      currentDragEndIndex.current = null
      
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    event.preventDefault()
  }

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0
    
    switch (sortField) {
      case 'sourceFile':
        comparison = (a.sourceFile ?? '').localeCompare(b.sourceFile ?? '')
        break
      case 'destFile':
        comparison = (a.destFile ?? '').localeCompare(b.destFile ?? '')
        break
      case 'status':
        comparison = a.status - b.status
        break
      case 'mediaType':
        comparison = (a.mediaType ?? 0) - (b.mediaType ?? 0)
        break
      case 'tmdbId':
        comparison = (a.tmdbId ?? 0) - (b.tmdbId ?? 0)
        break
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const SortButton = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="h-8 px-2 hover:bg-muted/20"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="destructive"
          onClick={() => handleDelete(Array.from(selectedIds))}
          disabled={selectedIds.size === 0 || isDeleting}
          className="flex items-center gap-2 transition-all hover:scale-105 shadow-lg hover:shadow-red-500/20"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete Selected ({selectedIds.size})
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card/30 backdrop-blur-sm shadow-xl">
        <Table ref={tableRef}>
          <TableHeader>
            <TableRow className="hover:bg-muted/5 border-b border-border/50">
              <TableHead className="w-12">
                <Checkbox 
                  checked={files.length === selectedIds.size && files.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <SortButton field="sourceFile">Source File</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="destFile">Destination File</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="status">Status</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="mediaType">Media Type</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="tmdbId">TMDb ID</SortButton>
              </TableHead>
              <TableHead>Episode Info</TableHead>
              <TableHead>
                <SortButton field="createdAt">Created At</SortButton>
              </TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFiles.map((file, index) => (
              <TableRow 
                key={file.id} 
                className={`
                  transition-colors
                  hover:bg-muted/10 
                  cursor-pointer 
                  border-b border-border/50
                  ${isDragging && 
                    dragStartIndex !== null && 
                    dragEndIndex !== null && 
                    index >= Math.min(dragStartIndex, dragEndIndex) && 
                    index <= Math.max(dragStartIndex, dragEndIndex)
                      ? 'bg-primary/10'
                      : ''
                  }
                  ${selectedIds.has(file.id) ? 'bg-primary/5' : ''}
                `}
                onMouseDown={(e) => handleMouseDown(index, e)}
                onClick={(e) => {
                  if (!isDragging) {
                    handleRowClick(file, index, e)
                  }
                }}
                style={{ userSelect: 'none' }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.has(file.id)}
                    onCheckedChange={(checked) => handleSelectOne(file.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="group relative">
                    {showOnlyFilenames ? getFilename(file.sourceFile) : file.sourceFile}
                    {showOnlyFilenames && (
                      <div className="
                        absolute left-0 top-full z-50 
                        hidden group-hover:block 
                        bg-popover 
                        text-popover-foreground 
                        p-3 rounded-lg
                        text-sm
                        border border-border
                        transition-all duration-200
                        translate-y-1
                        shadow-[0_0_30px_rgba(0,0,0,0.2)]
                        backdrop-blur-xl
                        animate-in
                        fade-in-0
                        zoom-in-95
                        slide-in-from-top-2
                      ">
                        <div className="font-medium">{file.sourceFile}</div>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="group relative">
                    {showOnlyFilenames ? getFilename(file.destFile) : file.destFile}
                    {showOnlyFilenames && file.destFile && (
                      <div className="
                        absolute left-0 top-full z-50 
                        hidden group-hover:block 
                        bg-popover 
                        text-popover-foreground 
                        p-3 rounded-lg
                        text-sm
                        border border-border
                        transition-all duration-200
                        translate-y-1
                        shadow-[0_0_30px_rgba(0,0,0,0.2)]
                        backdrop-blur-xl
                        animate-in
                        fade-in-0
                        zoom-in-95
                        slide-in-from-top-2
                      ">
                        <div className="font-medium">{file.destFile}</div>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`
                    px-2 py-1 rounded-full text-sm
                    transition-all duration-200
                    ${getStatusBadgeColor(file.status)}
                    shadow-sm hover:shadow-md
                    hover:scale-105
                  `}>
                    {FileStatus[file.status]}
                  </span>
                </TableCell>
                <TableCell>{file.mediaType !== null ? MediaType[file.mediaType] : 'Unknown'}</TableCell>
                <TableCell>
                  {file.tmdbId ? (
                    <a 
                      href={`https://www.themoviedb.org/${file.mediaType === MediaType.Movies ? 'movie' : 'tv'}/${file.tmdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        text-blue-400 hover:text-blue-300 
                        hover:underline
                        transition-colors
                        flex items-center gap-1
                      "
                      onClick={(e) => e.stopPropagation()}
                    >
                      {file.tmdbId}
                      <svg
                        className="h-3 w-3 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ) : '-'}
                </TableCell>
                <TableCell>{formatEpisodeInfo(file)}</TableCell>
                <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {}}
                      className="h-8 w-8 transition-all hover:scale-110"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteOne(file.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive transition-all hover:scale-110"
                      disabled={isDeleting}
                      title="Delete"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 