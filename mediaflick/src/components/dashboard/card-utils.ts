import { type CardSize, cardSizeConfig } from "@/hooks/use-card-size"

export const getImageUrl = (path: string, size: CardSize = "medium"): string => {
  if (!path) return "/placeholder-image.jpg"
  const imageSize = cardSizeConfig[size].imageSize
  return `https://image.tmdb.org/t/p/${imageSize}${path}`
}

export const CARD_BASE_CLASSES = [
  "group relative overflow-hidden cursor-pointer",
  "border border-transparent ring-1 ring-white/10",
  "transition-transform duration-200",
  "[background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(to_bottom_right,rgba(255,255,255,0.2),transparent_50%)_border-box]",
  "[box-shadow:inset_-1px_-1px_1px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.1)]",
  "before:absolute before:inset-0 before:z-10 before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-black/30",
  "after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/5 after:via-transparent after:to-white/10",
  "hover:scale-[1.02] hover:shadow-xl",
].join(" ")

export const CARD_HEADER_CLASSES = "absolute z-20 flex flex-col items-start space-y-2"

export const CARD_CONTENT_CLASSES =
  "absolute bottom-0 z-20 w-full overflow-y-auto border-t border-border/50 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm"
