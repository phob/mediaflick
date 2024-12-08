import { MediaType } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Film, Tv, Info } from 'lucide-react'
import { useState } from 'react'
import { MediaInfoDialog } from '@/components/media-info-dialog'
import { Separator } from '@/components/ui/separator'
import { useRouter, usePathname } from 'next/navigation'

interface MediaTypeSidebarProps {
  selectedMediaType: MediaType | undefined
  onMediaTypeChange: (mediaType: MediaType) => void
}

export function MediaTypeSidebar({
  selectedMediaType,
  onMediaTypeChange,
}: MediaTypeSidebarProps) {
  const [showMovieInfo, setShowMovieInfo] = useState(false)
  const [showTvShowInfo, setShowTvShowInfo] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleMediaTypeChange = (mediaType: MediaType) => {
    onMediaTypeChange(mediaType)
    if (mediaType === MediaType.Movies) {
      router.push('/media-info')
    } else {
      router.push('/scanned-data')
    }
  }

  return (
    <div className="pb-12 w-full">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Information</h2>
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowMovieInfo(true)}
            >
              <Info className="mr-2 h-4 w-4" />
              Movie Details
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowTvShowInfo(true)}
            >
              <Info className="mr-2 h-4 w-4" />
              TV Show Details
            </Button>
          </div>

          <Separator className="my-4" />

          <h2 className="mb-2 px-4 text-lg font-semibold">Media Types</h2>
          <div className="space-y-1">
            <Button
              variant={pathname === '/media-info' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleMediaTypeChange(MediaType.Movies)}
            >
              <Film className="mr-2 h-4 w-4" />
              Movies
            </Button>
            <Button
              variant={pathname === '/scanned-data' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleMediaTypeChange(MediaType.TvShows)}
            >
              <Tv className="mr-2 h-4 w-4" />
              TV Shows
            </Button>
          </div>
        </div>
      </div>

      <MediaInfoDialog 
        open={showMovieInfo} 
        onOpenChange={setShowMovieInfo}
        mediaType={MediaType.Movies}
      />

      <MediaInfoDialog 
        open={showTvShowInfo} 
        onOpenChange={setShowTvShowInfo}
        mediaType={MediaType.TvShows}
      />
    </div>
  )
} 