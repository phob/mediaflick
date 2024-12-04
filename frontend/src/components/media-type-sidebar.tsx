import { MediaType } from '@/types/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Film, Tv } from 'lucide-react'

interface MediaTypeSidebarProps {
  selectedMediaType: MediaType | undefined
  onMediaTypeChange: (mediaType: MediaType) => void
}

export function MediaTypeSidebar({
  selectedMediaType,
  onMediaTypeChange,
}: MediaTypeSidebarProps) {
  return (
    <div className="pb-12 w-full">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Media Types</h2>
          <div className="space-y-1">
            <Button
              variant={selectedMediaType === MediaType.Movies ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => onMediaTypeChange(MediaType.Movies)}
            >
              <Film className="mr-2 h-4 w-4" />
              Movies
            </Button>
            <Button
              variant={selectedMediaType === MediaType.TvShows ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => onMediaTypeChange(MediaType.TvShows)}
            >
              <Tv className="mr-2 h-4 w-4" />
              TV Shows
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 