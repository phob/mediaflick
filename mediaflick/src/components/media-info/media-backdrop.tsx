import Image from "next/image"

interface MediaBackdropProps {
  backdropPath?: string
}

export function MediaBackdrop({ backdropPath }: MediaBackdropProps) {
  if (!backdropPath) return null

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-background/80 to-background/20" />
      <Image
        src={`https://image.tmdb.org/t/p/original${backdropPath}`}
        alt="Media backdrop"
        fill
        sizes="100vw"
        className="object-cover object-center opacity-50"
        priority
      />
    </div>
  )
}
