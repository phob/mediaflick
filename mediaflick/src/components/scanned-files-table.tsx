import React, { useEffect, useState } from 'react'

import { format } from 'date-fns'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'

import {
    Pagination,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip
} from '@nextui-org/react'

import { mediaApi } from '@/lib/api/endpoints'
import { MediaStatus, MediaType, PagedResult, ScannedFile } from '@/lib/api/types'
import type { SortDescriptor } from '@nextui-org/react'

interface ScannedFilesTableProps {
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: string
    onPageChange?: (page: number) => void
    onPageSizeChange?: (pageSize: number) => void
    onSortByChange?: (sortBy: string) => void
    onSortOrderChange?: (sortOrder: string) => void
}

type Row = {
    key: number
    sourceFile: React.ReactNode
    destFile: React.ReactNode
    mediaType: string
    episode: string
    status: React.ReactNode
    createdAt: string
    updatedAt: string
    actions: React.ReactNode
}

export function ScannedFilesTable({
    page = 1,
    pageSize = 100,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    onPageChange,
    onSortByChange,
    onSortOrderChange,
}: ScannedFilesTableProps) {
    const [data, setData] = useState<PagedResult<ScannedFile> | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const result = await mediaApi.getScannedFiles({ page, pageSize, sortBy, sortOrder })
                setData(result)
                setError(null)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [page, pageSize, sortBy, sortOrder])

    if (loading) {
        return <div>Loading...</div>
    }

    if (error) {
        return <div>Error: {error}</div>
    }

    if (!data || !data.items.length) {
        return <div>No files found</div>
    }

    const getStatusClass = (status: MediaStatus) => {
        switch (status) {
            case MediaStatus.Processing:
                return 'bg-yellow-100 text-yellow-800'
            case MediaStatus.Success:
                return 'bg-green-100 text-green-800'
            case MediaStatus.Failed:
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status: MediaStatus) => {
        switch (status) {
            case MediaStatus.Processing:
                return 'Processing'
            case MediaStatus.Success:
                return 'Success'
            case MediaStatus.Failed:
                return 'Failed'
        }
    }

    const getMediaTypeLabel = (mediaType: MediaType) => {
        switch (mediaType) {
            case MediaType.Movies:
                return 'Movies'
            case MediaType.TvShows:
                return 'TV Shows'
            case MediaType.Unknown:
                return 'Unknown'
            default:
                return 'Unknown'
        }
    }

    const getFileName = (filePath: string) => {
        return filePath.split(/[\\/]/).pop() || filePath
    }

    const formatEpisodeNumber = (seasonNumber?: number, episodeNumber?: number) => {
        if (seasonNumber === undefined || episodeNumber === undefined) {
            return '-'
        }
        return `S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`
    }

    const handleSort = (descriptor: SortDescriptor) => {
        const column = String(descriptor.column)
        if (sortBy === column) {
            onSortOrderChange?.(descriptor.direction === 'ascending' ? 'desc' : 'asc')
        } else {
            onSortByChange?.(column)
            onSortOrderChange?.('asc')
        }
    }

    const rows = data.items.map((file): Row => ({
        key: file.id,
        sourceFile: (
            <Tooltip content={file.sourceFile}>
                <span>{getFileName(file.sourceFile)}</span>
            </Tooltip>
        ),
        destFile: (
            <Tooltip content={file.destFile || '-'}>
                <span>
                    {file.destFile ? getFileName(file.destFile) : '-'}
                </span>
            </Tooltip>
        ),
        mediaType: getMediaTypeLabel(file.mediaType),
        episode: formatEpisodeNumber(file.seasonNumber, file.episodeNumber),
        status: (
            <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                    file.status
                )}`}
            >
                {getStatusLabel(file.status)}
            </span>
        ),
        createdAt: format(new Date(file.createdAt), 'MMM d, yyyy HH:mm'),
        updatedAt: format(new Date(file.updatedAt), 'MMM d, yyyy HH:mm'),
        actions: (
            <div className="flex justify-end gap-2">
                <button
                    className="rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                    onClick={() => {}}
                    title="Edit"
                >
                    <Pencil className="h-4 w-4" />
                </button>
                <button
                    className="rounded-full p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
                    onClick={() => {}}
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
                <button
                    className="rounded-full p-2 text-green-600 transition-colors hover:bg-green-50 hover:text-green-800"
                    onClick={() => {}}
                    title="Recreate Symlink"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>
        )
    }))

    return (
        <div className="w-full">
            <Table
                aria-label="Scanned files table"
                selectionMode="none"
                className="min-w-full"
                classNames={{
                    th: "bg-default-200",
                    td: "py-3"
                }}
                sortDescriptor={{
                    column: sortBy,
                    direction: sortOrder === 'asc' ? 'ascending' : 'descending'
                }}
                onSortChange={handleSort}
            >
                <TableHeader>
                    <TableColumn key="sourceFile" allowsSorting>Source File</TableColumn>
                    <TableColumn key="destFile" allowsSorting>Destination</TableColumn>
                    <TableColumn key="mediaType" allowsSorting>Media Type</TableColumn>
                    <TableColumn key="episode" allowsSorting>Episode</TableColumn>
                    <TableColumn key="status" allowsSorting>Status</TableColumn>
                    <TableColumn key="createdAt" allowsSorting>Created</TableColumn>
                    <TableColumn key="updatedAt" allowsSorting>Updated</TableColumn>
                    <TableColumn key="actions">Actions</TableColumn>
                </TableHeader>
                <TableBody items={rows}>
                    {(item) => (
                        <TableRow key={item.key}>
                            {(columnKey) => <TableCell>{item[columnKey as keyof Row]}</TableCell>}
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {data.items.length} of {data.totalItems} items
                </div>
                <Pagination
                    total={data.totalPages}
                    page={page}
                    onChange={onPageChange}
                    showControls
                    className="gap-2"
                />
            </div>
        </div>
    )
}
