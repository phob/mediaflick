import Image from "next/image"
import React, { useState } from "react"
import { Loader2, Search } from "lucide-react"

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
import { Button } from "@/components/ui/button"

import { mediaApi } from "@/lib/api/endpoints"
import { getTMDBImageUrl } from "@/lib/api/tmdb"
import { MediaSearchResult, MediaType } from "@/lib/api/types"

interface MediaSearchProps {
  mediaType: MediaType.Movies | MediaType.TvShows
  onMediaSelect: (tmdbId: number) => void
  className?: string
  label?: string
}

export function MediaSearch({ mediaType, onMediaSelect, className, label = "Search Media" }: Readonly<MediaSearchProps>) {
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState<string>("")

  const handleSearch = async (value: string) => {
    if (!value) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const results = await (mediaType === MediaType.Movies
        ? mediaApi.searchMovies(value)
        : mediaApi.searchTvShows(value))
      setSearchResults(results)
    } catch (error) {
      console.error("Failed to search:", error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleMediaSelect = (tmdbId: number, title: string) => {
    onMediaSelect(tmdbId)
    setSelectedTitle(title)
    setSearchResults([])
    setOpen(false)
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTitle || label}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={`Search ${mediaType === MediaType.Movies ? 'movies' : 'TV shows'}...`}
              onValueChange={handleSearch}
              className="h-9"
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <CommandGroup>
                  {searchResults.length === 0 ? (
                    <CommandEmpty>No results found.</CommandEmpty>
                  ) : (
                    searchResults.map((item) => (
                      <CommandItem
                        key={item.tmdbId}
                        value={item.tmdbId.toString()}
                        onSelect={() => handleMediaSelect(item.tmdbId, item.title)}
                        className="flex items-center gap-2 p-2"
                      >
                        {item.posterPath && (
                          <div className="relative h-[69px] w-[46px] shrink-0">
                            <Image
                              src={getTMDBImageUrl(item.posterPath, "w92") ?? ""}
                              alt={item.title}
                              fill
                              sizes="46px"
                              className="rounded object-cover"
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">{item.title}</span>
                          {item.year && (
                            <span className="text-sm text-muted-foreground">({item.year})</span>
                          )}
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
