import Image from "next/image"
import React, { useState } from "react"

import { Autocomplete, AutocompleteItem, AutocompleteProps } from "@nextui-org/react"

import { mediaApi } from "@/lib/api/endpoints"
import { getTMDBImageUrl } from "@/lib/api/tmdb"
import { MediaSearchResult, MediaType } from "@/lib/api/types"

type BaseAutocompleteProps = Omit<AutocompleteProps<MediaSearchResult>, "children">

interface MediaSearchProps extends Partial<BaseAutocompleteProps> {
  mediaType: MediaType.Movies | MediaType.TvShows
  onMediaSelect: (tmdbId: number) => void
  className?: string
}

export function MediaSearch({ mediaType, onMediaSelect, className, ...props }: MediaSearchProps) {
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const handleSearch = async (value: string) => {
    setSearchValue(value)

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

  const handleMediaSelect = (key: React.Key | null) => {
    if (!key) return

    const tmdbId = Number(key)
    if (!isNaN(tmdbId)) {
      onMediaSelect(tmdbId)
      // Clear search after selection
      setSearchValue("")
      setSearchResults([])
    }
  }

  return (
    <Autocomplete
      label="Search Media"
      className={className}
      size="sm"
      inputValue={searchValue}
      onInputChange={handleSearch}
      isLoading={searchLoading}
      onSelectionChange={handleMediaSelect}
      defaultItems={searchResults}
      listboxProps={{
        className: "max-h-[250px] overflow-y-auto",
      }}
      {...props}
    >
      {(item: MediaSearchResult) => (
        <AutocompleteItem key={item.tmdbId} textValue={item.title}>
          <div className="flex items-center gap-2">
            {item.posterPath && (
              <Image
                src={getTMDBImageUrl(item.posterPath, "w92") || ""}
                alt={item.title}
                width={92}
                height={138}
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
  )
}
