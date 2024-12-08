'use client'

import { ScannedFilesTable } from "@/components/scanned-files-table"
import { useState, useEffect } from "react"
import { ScannedFile } from "@/types/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export default function ScannedDataPage() {
  const [files, setFiles] = useState<ScannedFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchFiles = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/ScannedFiles')
      if (!response.ok) throw new Error('Failed to fetch files')
      const data = await response.json()
      
      // Ensure data is an array
      const filesArray = Array.isArray(data) ? data : []
      
      // Type guard and transform the data
      const validFiles = filesArray.filter((file): file is ScannedFile => {
        return file && typeof file === 'object' && 'id' in file
      })

      setFiles(validFiles)
    } catch (error) {
      console.error('Fetch error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch scanned files"
      })
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  // Ensure files is always an array before rendering ScannedFilesTable
  const safeFiles = Array.isArray(files) ? files : []

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Scanned TV Shows</h1>
      <ScannedFilesTable 
        files={safeFiles}
        showOnlyFilenames={true}
        onDataChange={fetchFiles}
      />
    </div>
  )
}
