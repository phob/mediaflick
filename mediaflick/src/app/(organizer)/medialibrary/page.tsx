"use client"

import { useState } from 'react'

import { ScannedFilesTable } from '@/components/scanned-files-table'

export default function MediaLibrary() {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [sortBy, setSortBy] = useState('createdAt')
    const [sortOrder, setSortOrder] = useState('desc')

    return (
        <div className="container mx-auto py-6 motion-blur-in-md motion-opacity-in-0 motion-duration-500">
            <h1 className="mb-6 text-2xl font-bold motion-translate-y-in-100 motion-delay-400">Media Library</h1>
            <ScannedFilesTable
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortByChange={setSortBy}
                onSortOrderChange={setSortOrder}
            />
        </div>
    )
}
