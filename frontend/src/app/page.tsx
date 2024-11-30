'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Settings2 } from 'lucide-react'
import { FileStatus, MediaType, PagedResult, ScannedFile } from '@/types/api'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const STORAGE_KEY = 'plexLocalScan_preferences'

interface UserPreferences {
  showOnlyFilenames: boolean
  pageSize: number
}

const defaultPreferences: UserPreferences = {
  showOnlyFilenames: true,
  pageSize: 10
}

function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return defaultPreferences
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return defaultPreferences

  try {
    return JSON.parse(stored)
  } catch {
    return defaultPreferences
  }
}

function savePreferences(prefs: UserPreferences) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export default function Home() {
  const [data, setData] = useState<PagedResult<ScannedFile> | null>(null)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState<FileStatus | undefined>()
  const [mediaType, setMediaType] = useState<MediaType | undefined>()
  
  // Initialize with default values
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  
  // Load preferences from localStorage on component mount
  useEffect(() => {
    const loadedPrefs = loadPreferences()
    setPreferences(loadedPrefs)
  }, [])

  // Save preferences whenever they change
  useEffect(() => {
    savePreferences(preferences)
  }, [preferences])

  const fetchData = async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: preferences.pageSize.toString(),
      ...(searchTerm && { searchTerm }),
      ...(status !== undefined && { status: status.toString() }),
      ...(mediaType !== undefined && { mediaType: mediaType.toString() }),
    })

    const response = await fetch(`/api/ScannedFiles?${params.toString()}`)
    const result = await response.json()
    setData(result)
  }

  useEffect(() => {
    fetchData()
  }, [page, preferences.pageSize, searchTerm, status, mediaType])

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

  const handlePageSizeChange = (newSize: string) => {
    setPreferences(prev => ({ ...prev, pageSize: Number(newSize) }))
    setPage(1) // Reset to first page when changing page size
  }

  const handleShowOnlyFilenamesChange = (checked: boolean) => {
    setPreferences(prev => ({ ...prev, showOnlyFilenames: checked }))
  }

  const getFilename = (path: string | null) => {
    if (!path) return null
    return path.split(/[/\\]/).pop()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Scanned Files</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Display Options</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-between py-4">
                <label className="text-sm font-medium text-muted-foreground">
                  Show only filenames
                </label>
                <Switch
                  checked={preferences.showOnlyFilenames}
                  onCheckedChange={handleShowOnlyFilenamesChange}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Search Files</label>
            <Input
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Filter by Status</label>
            <Select
              value={status?.toString() ?? 'all'}
              onValueChange={(value) => setStatus(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(FileStatus)
                  .filter(([key]) => isNaN(Number(key)))
                  .map(([key, value]) => (
                    <SelectItem key={value} value={value.toString()}>
                      {key}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Filter by Media Type</label>
            <Select
              value={mediaType?.toString() ?? 'all'}
              onValueChange={(value) => setMediaType(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Media Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(MediaType)
                  .filter(([key]) => isNaN(Number(key)))
                  .map(([key, value]) => (
                    <SelectItem key={value} value={value.toString()}>
                      {key}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/5">
                <TableHead>Source File</TableHead>
                <TableHead>Destination File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Media Type</TableHead>
                <TableHead>TMDb ID</TableHead>
                <TableHead>Episode Info</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((file) => (
                <TableRow key={file.id} className="hover:bg-muted/5">
                  <TableCell className="font-medium">
                    <div className="group relative">
                      {preferences.showOnlyFilenames ? getFilename(file.sourceFile) : file.sourceFile}
                      {preferences.showOnlyFilenames && (
                        <div className="absolute left-0 top-full z-50 hidden group-hover:block bg-popover text-popover-foreground p-2 rounded shadow-lg text-sm">
                          {file.sourceFile}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="group relative">
                      {preferences.showOnlyFilenames ? getFilename(file.destFile) : file.destFile}
                      {preferences.showOnlyFilenames && file.destFile && (
                        <div className="absolute left-0 top-full z-50 hidden group-hover:block bg-popover text-popover-foreground p-2 rounded shadow-lg text-sm">
                          {file.destFile}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-sm ${getStatusBadgeColor(file.status)}`}>
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
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {file.tmdbId}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{formatEpisodeInfo(file)}</TableCell>
                  <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * preferences.pageSize + 1} to {Math.min(page * preferences.pageSize, data.totalItems)} of{' '}
                {data.totalItems} results
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show</span>
                <Select
                  value={preferences.pageSize.toString()}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">entries</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
