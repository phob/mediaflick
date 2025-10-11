"use client"

import { useState } from "react"

export type CardSize = "small" | "medium" | "large"

const CARD_SIZE_STORAGE_KEY = "mediaflick-card-size"
const DEFAULT_CARD_SIZE: CardSize = "medium"

export function useCardSize() {
  // Initialize state from localStorage on client side
  const [cardSize, setCardSize] = useState<CardSize>(() => {
    if (typeof window !== 'undefined') {
      const savedSize = localStorage.getItem(CARD_SIZE_STORAGE_KEY) as CardSize
      if (savedSize && ["small", "medium", "large"].includes(savedSize)) {
        return savedSize
      }
    }
    return DEFAULT_CARD_SIZE
  })
  // isLoaded is simply whether we're on the client side
  const isLoaded = typeof window !== 'undefined'

  const updateCardSize = (newSize: CardSize) => {
    setCardSize(newSize)
    localStorage.setItem(CARD_SIZE_STORAGE_KEY, newSize)
  }

  return {
    cardSize,
    setCardSize: updateCardSize,
    isLoaded,
  }
}

export const cardSizeConfig = {
  small: {
    height: "h-[300px]",
    gridCols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
    imageSize: "w300",
    titleSize: "text-lg",
    contentMaxHeight: "max-h-[120px]",
  },
  medium: {
    height: "h-[400px]",
    gridCols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    imageSize: "w500",
    titleSize: "text-xl",
    contentMaxHeight: "max-h-[200px]",
  },
  large: {
    height: "h-[500px]",
    gridCols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    imageSize: "w780",
    titleSize: "text-2xl",
    contentMaxHeight: "max-h-[250px]",
  },
} as const
