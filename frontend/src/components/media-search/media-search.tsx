import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"

import { Command as CommandPrimitive } from "cmdk"
import { Clipboard, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { mediaApi } from "@/lib/api/endpoints"
import { getTMDBImageUrl } from "@/lib/api/tmdb"
import { MediaSearchResult, MediaType } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface MediaSearchProps {
  mediaType: MediaType.Movies | MediaType.TvShows
  onMediaSelect: (tmdbId: number) => void
  className?: string
  label?: string
}

export function MediaSearch({
  mediaType,
  onMediaSelect,
  className,
  label = "Search Media",
}: Readonly<MediaSearchProps>) {
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState<string>("")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [autoPasteEnabled, setAutoPasteEnabled] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("mediaSearchAutoPaste") === "true"
  })
  const latestRequestIdRef = useRef(0)

  // Debounce the input to reduce flicker and API spam
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timeoutId)
  }, [query])

  // Persist auto-paste setting to localStorage
  useEffect(() => {
    localStorage.setItem("mediaSearchAutoPaste", autoPasteEnabled.toString())
  }, [autoPasteEnabled])

  // Auto-paste clipboard content when dialog opens
  useEffect(() => {
    if (open && autoPasteEnabled) {
      // Small delay to ensure dialog is fully mounted and focused
      const timeoutId = setTimeout(() => {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (text && typeof text === "string") {
              setQuery(text.trim())
            }
          })
          .catch(() => {
            // Clipboard access denied or not available - silently ignore
          })
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [open, autoPasteEnabled])

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
        // Normalize search query by replacing dots and underscores with spaces
        const normalizedQuery = value.replace(/[._]/g, " ")
        const results = await (mediaType === MediaType.Movies
          ? mediaApi.searchMovies(normalizedQuery)
          : mediaApi.searchTvShows(normalizedQuery))
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
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full justify-between">
        {selectedTitle || label}
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <div className="flex h-12 items-center gap-2 border-b px-3 pr-12">
          <Search className="size-4 shrink-0 opacity-50" />
          <CommandPrimitive.Input
            placeholder={`Search ${mediaType === MediaType.Movies ? "movies" : "TV shows"}...`}
            value={query}
            onValueChange={setQuery}
            className="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setAutoPasteEnabled(!autoPasteEnabled)}
                className={cn(
                  "rounded-sm p-1 transition-all duration-200",
                  autoPasteEnabled ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={autoPasteEnabled ? "Disable auto-paste" : "Enable auto-paste"}
              >
                <Clipboard className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{autoPasteEnabled ? "Auto-paste enabled" : "Auto-paste disabled"}</TooltipContent>
          </Tooltip>
        </div>
        <CommandList>
          {searchResults.length === 0 && !searchLoading && <CommandEmpty>No results found.</CommandEmpty>}

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
                    {item.year && <span className="text-muted-foreground text-sm">({item.year})</span>}
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
