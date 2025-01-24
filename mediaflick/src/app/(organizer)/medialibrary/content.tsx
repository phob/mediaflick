"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ScannedFilesTable } from '@/components/scanned-files-table'
import { MediaStatus, MediaType } from '@/lib/api/types'

const STORAGE_KEY = 'mediaLibraryState'

export function MediaLibraryContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    
    // Load saved state or use URL params or defaults
    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEY)
        if (!savedState && !searchParams.toString()) {
            // No saved state and no URL params, use defaults
            return
        }

        if (!searchParams.toString() && savedState) {
            // No URL params but we have saved state, restore it
            router.push(`/medialibrary?${savedState}`)
            return
        }

        // Save current state
        localStorage.setItem(STORAGE_KEY, searchParams.toString())
    }, [searchParams, router])

    // Get values from URL
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 50
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const status = (searchParams.get('status') as MediaStatus) || MediaStatus.Success
    const mediaType = (searchParams.get('mediaType') as MediaType) || MediaType.TvShows
    const search = searchParams.get('search') || ''

    // Update URL helper
    const updateUrl = (updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams)
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value)
            } else {
                params.delete(key)
            }
        })
        const newParams = params.toString()
        localStorage.setItem(STORAGE_KEY, newParams)
        router.push(`/medialibrary?${newParams}`)
    }

    return (
        <ScannedFilesTable
            page={page}
            pageSize={pageSize}
            sortBy={sortBy}
            sortOrder={sortOrder}
            initialStatus={status}
            initialMediaType={mediaType}
            initialSearch={search}
            onPageChange={(newPage: number) => updateUrl({ page: newPage.toString() })}
            onPageSizeChange={(newSize: number) => updateUrl({ pageSize: newSize.toString() })}
            onSortByChange={(newSort: string) => updateUrl({ sortBy: newSort })}
            onSortOrderChange={(newOrder: string) => updateUrl({ sortOrder: newOrder })}
            onStatusChange={(newStatus: MediaStatus) => updateUrl({ status: newStatus })}
            onMediaTypeChange={(newType: MediaType) => updateUrl({ mediaType: newType })}
            onSearchChange={(newSearch: string) => updateUrl({ search: newSearch || '' })}
        />
    )
} 