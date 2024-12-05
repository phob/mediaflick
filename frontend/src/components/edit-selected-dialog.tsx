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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface TvShowSearchResult {
  tmdbId: number;
  title: string;
  year?: number;
}

interface EditSelectedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFiles: ScannedFile[]
  onDataChange: () => Promise<void>
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<F>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function EditSelectedDialog({
  open,
  onOpenChange,
  selectedFiles,
  onDataChange,
}: EditSelectedDialogProps) {
  const [editedFiles, setEditedFiles] = React.useState<ScannedFile[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<TvShowSearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    setEditedFiles([...selectedFiles])
  }, [selectedFiles])

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/MediaLookup/tvshows/search?title=${encodeURIComponent(value)}`)
      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`)
      }
      
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to search TV shows",
      })
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const debouncedSearch = React.useCallback(
    debounce(handleSearch, 300),
    []
  )

  const handleTvShowSelect = (show: TvShowSearchResult) => {
    const newFiles = editedFiles.map(file => ({
      ...file,
      tmdbId: show.tmdbId
    }))
    setEditedFiles(newFiles)
    setSearchValue(show.title)
    setSearchOpen(false)
  }

  const handleInputChange = (index: number, field: keyof ScannedFile, value: string) => {
    console.log(`Handling input change: field=${field}, value=${value}, index=${index}`)
    
    const newFiles = editedFiles.map(f => ({ ...f }))
    const file = newFiles[index]
    const parsedValue = value ? parseInt(value) : undefined

    if (field === 'tmdbId') {
      file.tmdbId = parsedValue
    } else if (field === 'seasonNumber') {
      console.log('Handling season number change')
      file.seasonNumber = parsedValue
      
      if (parsedValue !== undefined) {
        console.log('Filling subsequent season numbers with:', parsedValue)
        let foundCurrent = false
        
        newFiles.forEach((f) => {
          if (f === file) {
            foundCurrent = true
          } else if (foundCurrent) {
            f.seasonNumber = parsedValue
          }
        })
      }
    } else if (field === 'episodeNumber') {
      console.log('Handling episode number change')
      file.episodeNumber = parsedValue
      
      if (parsedValue !== undefined && file.seasonNumber) {
        console.log('Filling subsequent empty episodes starting from:', parsedValue)
        let nextEpisode = parsedValue + 1
        let foundCurrent = false
        let currentSeason = file.seasonNumber
        
        newFiles.forEach((f) => {
          if (f === file) {
            foundCurrent = true
          } else if (foundCurrent) {
            if (f.seasonNumber && f.seasonNumber !== currentSeason) {
              // Reset episode counter for new season
              nextEpisode = 1
              currentSeason = f.seasonNumber
            }
            
            if (!f.episodeNumber) {
              console.log(`Setting episode ${nextEpisode} for file:`, f.sourceFile)
              f.episodeNumber = nextEpisode
              nextEpisode++
            }
          }
        })
      }
    }

    console.log('Updated files:', newFiles)
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

        <div className="flex items-center space-x-4 mb-4">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={searchOpen}
                className="w-[400px] justify-between"
              >
                {searchValue || "Search TV Shows..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search TV shows..."
                  value={searchValue}
                  onValueChange={(value) => {
                    setSearchValue(value)
                    debouncedSearch(value)
                  }}
                />
                <CommandList>
                  <CommandEmpty>
                    {isSearching ? "Searching..." : "No TV shows found"}
                  </CommandEmpty>
                  <CommandGroup>
                    {searchResults.map((show) => (
                      <CommandItem
                        key={show.tmdbId}
                        value={show.title}
                        onSelect={() => handleTvShowSelect(show)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            searchValue === show.title ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{show.title}</span>
                        <span className="ml-2 text-muted-foreground">ID: {show.tmdbId} Year: {show.year}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

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