import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const latestRequestIdRef = useRef(0)

  // Debounce the input to reduce flicker and API spam
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timeoutId)
  }, [query])

  // Trigger search when debounced query changes
  useEffect(() => {
    const handleSearch = async (value: string) => {
      if (!value) {
        setSearchResults([])
        return
      }

      setSearchLoading(true)
      try {
        const requestId = ++latestRequestIdRef.current
        const results = await (mediaType === MediaType.Movies
          ? mediaApi.searchMovies(value)
          : mediaApi.searchTvShows(value))
        // Ignore out-of-order responses
        if (requestId === latestRequestIdRef.current) {
          setSearchResults(results)
        }
      } catch (error) {
        console.error("Failed to search:", error)
        setSearchResults([])
      } finally {
        // Only clear loading if this is the latest request
        setSearchLoading(false)
      }
    }

    if (debouncedQuery !== "") {
      void handleSearch(debouncedQuery)
    } else {
      setSearchResults([])
      setSearchLoading(false)
    }
  }, [debouncedQuery, mediaType])

  const handleMediaSelect = (tmdbId: number, title: string) => {
    onMediaSelect(tmdbId)
    setSelectedTitle(title)
    setSearchResults([])
    setOpen(false)
  }

  return (
    <div className={className}>
      <Button 
        variant="outline" 
        onClick={() => setOpen(true)}
        className="w-full justify-between"
      >
        {selectedTitle || label}
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput 
          placeholder={`Search ${mediaType === MediaType.Movies ? 'movies' : 'TV shows'}...`}
          onValueChange={setQuery}
        />
        <CommandList>
          {searchResults.length === 0 && !searchLoading && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {searchLoading && (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {searchResults.length > 0 && (
            <CommandGroup>
              {searchResults.map((item) => (
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
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
