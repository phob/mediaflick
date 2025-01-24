import Image from "next/image"
import { useState } from "react"

interface MediaBackdropProps {
  backdropPath?: string
}

export function MediaBackdrop({ backdropPath }: Readonly<MediaBackdropProps>) {
  const [isLoaded, setIsLoaded] = useState(false)

  if (!backdropPath) return null

  return (
    <div className="fixed inset-0 h-screen">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-t from-background from-10% via-background/95 to-background/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-background/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      </div>
      <Image
        src={`https://image.tmdb.org/t/p/original${backdropPath}`}
        alt="Media backdrop"
        fill
        sizes="100vw"
        className={`object-cover object-center transition-opacity duration-500 ${
          isLoaded ? "opacity-50" : "opacity-0"
        }`}
        priority
        onLoadingComplete={() => setIsLoaded(true)}
      />
    </div>
  )
}
