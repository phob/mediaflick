"use client"

import { useEffect, useState } from "react"
import { ColumnKey } from "@/lib/api/types"

const STORAGE_KEY = "scannedFilesTable.visibleColumns"

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  sourceFile: true,
  destFile: true,
  fileSize: true,
  fileHash: false,
  genres: false,
  mediaType: true,
  tmdbId: false,
  imdbId: false,
  episode: true,
  status: true,
  createdAt: false,
  updatedAt: false,
}

export function useColumnVisibility() {
  // Initialize state from localStorage
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          return { ...DEFAULT_VISIBLE_COLUMNS, ...parsed }
        }
      }
    } catch {
      // Ignore errors
    }
    return DEFAULT_VISIBLE_COLUMNS
  })

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns))
      }
    } catch {}
  }, [visibleColumns])

  return { visibleColumns, setVisibleColumns }
}


