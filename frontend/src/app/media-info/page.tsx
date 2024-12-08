'use client'

import { MediaInfoDialog } from "@/components/media-info-dialog"
import { MediaType } from "@/types/api"
import { useState } from "react"

export default function MediaInfoPage() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Movie Information</h1>
      <div className="grid gap-6">
        <MediaInfoDialog 
          open={isOpen}
          onOpenChange={setIsOpen}
          mediaType={MediaType.Movies}
        />
      </div>
    </div>
  )
}
