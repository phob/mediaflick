'use client'

import { ThemeToggle } from "@/components/theme-toggle"
import { MediaTypeSidebar } from "@/components/media-type-sidebar"
import { useState } from "react"
import { MediaType } from "@/types/api"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | undefined>(undefined)

  const handleMediaTypeChange = (mediaType: MediaType) => {
    setSelectedMediaType(mediaType)
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="flex h-screen">
        <aside className="w-64 border-r">
          <MediaTypeSidebar 
            selectedMediaType={selectedMediaType} 
            onMediaTypeChange={handleMediaTypeChange} 
          />
        </aside>
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </>
  )
} 