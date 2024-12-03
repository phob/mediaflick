"use client"

import { useEffect, useState, useCallback } from 'react'
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
import { Settings2, Trash2, Loader2 } from 'lucide-react'
import { FileStatus, MediaType, PagedResult, ScannedFile } from '@/types/api'
import { useToast } from "@/hooks/use-toast"
import { ScannedFilesTable } from '@/components/scanned-files-table'

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
  const [status, setStatus] = useState<FileStatus | undefined>(FileStatus.Failed)
  const [mediaType, setMediaType] = useState<MediaType | undefined>()
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  
  const { toast } = useToast()

  // Load preferences from localStorage on component mount
  useEffect(() => {
    const loadedPrefs = loadPreferences()
    setPreferences(loadedPrefs)
  }, [])

  // Save preferences whenever they change
  useEffect(() => {
    savePreferences(preferences)
  }, [preferences])

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: preferences.pageSize.toString(),
      sortBy: 'sourcefile',
      sortDirection: 'asc',
      ...(searchTerm && { searchTerm }),
      ...(status !== undefined && { status: status.toString() }),
      ...(mediaType !== undefined && { mediaType: mediaType.toString() }),
    })

    const response = await fetch(`/api/ScannedFiles?${params.toString()}`)
    const result = await response.json()
    setData(result)
  }, [page, preferences.pageSize, searchTerm, status, mediaType])

  useEffect(() => {
    fetchData()
  }, [page, preferences.pageSize, searchTerm, status, mediaType, fetchData])

  const handlePageSizeChange = (newSize: string) => {
    setPreferences(prev => ({ ...prev, pageSize: Number(newSize) }))
    setPage(1) // Reset to first page when changing page size
  }

  const handleShowOnlyFilenamesChange = (checked: boolean) => {
    setPreferences(prev => ({ ...prev, showOnlyFilenames: checked }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      <div className="container mx-auto py-10 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Scanned Files
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="transition-all hover:scale-105 shadow-lg hover:shadow-primary/20"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md backdrop-blur-sm bg-card/80">
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Search Files</label>
            <div className="relative">
              <Input
                placeholder="Search by filename..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="transition-all focus-visible:ring-primary/30 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/20 to-secondary/20 blur-xl opacity-20" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Filter by Status</label>
            <Select
              value={status?.toString() ?? 'all'}
              onValueChange={(value) => setStatus(value === 'all' ? undefined : parseInt(value) as FileStatus)}
            >
              <SelectTrigger className="transition-all focus-visible:ring-primary/30 focus-visible:ring-offset-2 shadow-sm hover:shadow-md">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="backdrop-blur-sm bg-card/80">
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
              <SelectTrigger className="transition-all focus-visible:ring-primary/30 focus-visible:ring-offset-2 shadow-sm hover:shadow-md">
                <SelectValue placeholder="Select Media Type" />
              </SelectTrigger>
              <SelectContent className="backdrop-blur-sm bg-card/80">
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

        {data && (
          <ScannedFilesTable
            files={data.items}
            showOnlyFilenames={preferences.showOnlyFilenames}
            onDataChange={fetchData}
          />
        )}

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
                  <SelectTrigger className="w-[80px] transition-all focus-visible:ring-primary/30 focus-visible:ring-offset-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-sm bg-card/80">
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
                className="transition-all hover:scale-105 shadow-sm hover:shadow-md"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= data.totalPages}
                className="transition-all hover:scale-105 shadow-sm hover:shadow-md"
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
