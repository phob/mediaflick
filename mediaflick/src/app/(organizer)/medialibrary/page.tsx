// eslint-disable-next-line check-file/folder-naming-convention
'use client'

import { useState } from 'react'

import { ScannedFilesTable } from '@/components/scanned-files-table'

export default function MediaLibrary() {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [sortBy, setSortBy] = useState('createdAt')
    const [sortOrder, setSortOrder] = useState('desc')

    return (
        <div className="mx-auto py-6">
            <h1 className="mb-6 text-2xl font-bold">Media Library</h1>
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
