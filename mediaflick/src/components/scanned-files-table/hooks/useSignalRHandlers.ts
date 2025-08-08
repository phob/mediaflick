import { useCallback, useEffect } from "react"
import { signalr } from "@/lib/api/signalr"
import { ScannedFile, PagedResult, MediaStatus, MediaType } from "@/lib/api/types"

interface SignalRHandlersOptions {
  data: PagedResult<ScannedFile> | null
  pageSize: number
  statusFilter: MediaStatus
  mediaTypeFilter: MediaType
  filterValue: string
  sortBy: string
  sortOrder: string
  setData: React.Dispatch<React.SetStateAction<PagedResult<ScannedFile> | null>>
  setNewEntries: React.Dispatch<React.SetStateAction<Set<number>>>
}

export function useSignalRHandlers({
  data,
  pageSize,
  statusFilter,
  mediaTypeFilter,
  filterValue,
  sortBy,
  sortOrder,
  setData,
  setNewEntries,
}: SignalRHandlersOptions) {
  
  const sortItems = useCallback((items: ScannedFile[], sortBy: string, sortOrder: string): ScannedFile[] => {
    return [...items].sort((a, b) => {
      const aValue = a[sortBy as keyof ScannedFile]
      const bValue = b[sortBy as keyof ScannedFile]
      if (aValue === bValue) return 0
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      const comparison = aValue < bValue ? -1 : 1
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [])

  const handleFileAdded = useCallback((file: ScannedFile, pageSize: number) => {
    setNewEntries((prev) => new Set([...prev, file.id]))
    setData((prevData) => {
      if (!prevData) return null
      const newItems = sortItems([file, ...prevData.items], sortBy, sortOrder).slice(0, pageSize)
      const newTotalItems = prevData.totalItems + 1
      return {
        ...prevData,
        items: newItems,
        totalItems: newTotalItems,
        totalPages: Math.ceil(newTotalItems / pageSize),
      }
    })
  }, [sortBy, sortOrder, sortItems, setData, setNewEntries])

  const handleExistingFileUpdate = useCallback((
    prevData: PagedResult<ScannedFile>,
    file: ScannedFile,
    itemIndex: number,
    matchesFilters: boolean,
    pageSize: number
  ) => {
    if (!matchesFilters) {
      const filteredItems = prevData.items.filter((_, index) => index !== itemIndex)
      return {
        ...prevData,
        items: filteredItems,
        totalItems: prevData.totalItems - 1,
        totalPages: Math.ceil((prevData.totalItems - 1) / pageSize),
      }
    }
    const updatedItems = sortItems([file, ...prevData.items.filter((_, index) => index !== itemIndex)], sortBy, sortOrder).slice(0, pageSize)
    return { ...prevData, items: updatedItems }
  }, [sortItems, sortBy, sortOrder])

  const handleNewFileUpdate = useCallback((
    prevData: PagedResult<ScannedFile>,
    file: ScannedFile,
    pageSize: number
  ) => {
    setNewEntries((prev) => new Set([...prev, file.id]))
    const newItems = sortItems([file, ...prevData.items], sortBy, sortOrder).slice(0, pageSize)
    return {
      ...prevData,
      items: newItems,
      totalItems: prevData.totalItems + 1,
      totalPages: Math.ceil((prevData.totalItems + 1) / pageSize),
    }
  }, [sortItems, sortBy, sortOrder, setNewEntries])

  const handleFileUpdated = useCallback((file: ScannedFile, pageSize: number, shouldIncludeFile: (file: ScannedFile) => boolean) => {
    setData((prevData) => {
      if (!prevData?.items) return null
      const itemIndex = prevData.items.findIndex((item) => item.id === file.id)
      const matchesFilters = shouldIncludeFile(file)

      if (itemIndex !== -1) {
        return handleExistingFileUpdate(prevData, file, itemIndex, matchesFilters, pageSize)
      }
      if (matchesFilters) {
        return handleNewFileUpdate(prevData, file, pageSize)
      }
      return prevData
    })
  }, [handleExistingFileUpdate, handleNewFileUpdate, setData])

  const handleFileRemoved = useCallback((file: ScannedFile, pageSize: number) => {
    setData((prevData) => {
      if (!prevData?.items) return null
      const itemIndex = prevData.items.findIndex((item) => item.id === file.id)
      if (itemIndex === -1) return prevData
      const filteredItems = prevData.items.filter((_, index) => index !== itemIndex)
      const newTotalItems = Math.max(0, prevData.totalItems - 1)
      return {
        ...prevData,
        items: filteredItems,
        totalItems: newTotalItems,
        totalPages: Math.max(1, Math.ceil(newTotalItems / pageSize)),
      }
    })
  }, [setData])

  useEffect(() => {
    if (!data || !statusFilter || !mediaTypeFilter) return

    const shouldIncludeFile = (file: ScannedFile): boolean => {
      const statusMatch = file.status === statusFilter
      const mediaTypeMatch = file.mediaType === mediaTypeFilter
      const searchMatch = !filterValue ||
        file.sourceFile.toLowerCase().includes(filterValue.toLowerCase()) ||
        (file.destFile?.toLowerCase() || "").includes(filterValue.toLowerCase())
      return statusMatch && mediaTypeMatch && searchMatch
    }

    const unsubscribeAdd = signalr.subscribe("OnFileAdded", 
      (file) => handleFileAdded(file, pageSize))
    const unsubscribeUpdate = signalr.subscribe("OnFileUpdated", 
      (file) => handleFileUpdated(file, pageSize, shouldIncludeFile))
    const unsubscribeRemove = signalr.subscribe("OnFileRemoved", 
      (file) => handleFileRemoved(file, pageSize))

    return () => {
      unsubscribeAdd()
      unsubscribeUpdate()
      unsubscribeRemove()
    }
  }, [data, pageSize, statusFilter, mediaTypeFilter, filterValue, handleFileAdded, handleFileUpdated, handleFileRemoved])
}
