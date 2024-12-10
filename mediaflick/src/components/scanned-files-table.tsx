import React, { useEffect, useState } from 'react';
import { mediaApi } from '@/lib/api/endpoints';
import { ScannedFile, PagedResult, MediaType, MediaStatus } from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface ScannedFilesTableProps {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortByChange?: (sortBy: string) => void;
  onSortOrderChange?: (sortOrder: string) => void;
}

export function ScannedFilesTable({
  page = 1,
  pageSize = 100,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onPageChange,
  onPageSizeChange,
  onSortByChange,
  onSortOrderChange,
}: ScannedFilesTableProps) {
  const [data, setData] = useState<PagedResult<ScannedFile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await mediaApi.getScannedFiles({ page, pageSize, sortBy, sortOrder});
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize, sortBy, sortOrder]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!data || !data.items.length) {
    return <div>No files found</div>;
  }

  const getStatusClass = (status: MediaStatus) => {
    switch (status) {
      case MediaStatus.Processing:
        return 'bg-yellow-100 text-yellow-800';
      case MediaStatus.Success:
        return 'bg-green-100 text-green-800';
      case MediaStatus.Failed:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: MediaStatus) => {
    switch (status) {
      case MediaStatus.Processing:
        return 'Processing';
      case MediaStatus.Success:
        return 'Success';
      case MediaStatus.Failed:
        return 'Failed';
    }
  };

  const getMediaTypeLabel = (mediaType: MediaType) => {
    switch (mediaType) {
      case MediaType.Movies:
        return 'Movies';
      case MediaType.TvShows:
        return 'TV Shows';
      case MediaType.Unknown:
        return 'Unknown';
      default:
        return 'Unknown';
    }
  };

  const getFileName = (filePath: string) => {
    return filePath.split(/[\\/]/).pop() || filePath;
  };

  const formatEpisodeNumber = (seasonNumber?: number, episodeNumber?: number) => {
    if (seasonNumber === undefined || episodeNumber === undefined) {
      return '-';
    }
    return `S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`;
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      onSortOrderChange?.(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortByChange?.(column);
      onSortOrderChange?.('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('sourceFile')}
            >
              Source File {sortBy === 'sourceFile' && getSortIcon('sourceFile')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('destFile')}
            >
              Destination {sortBy === 'destFile' && getSortIcon('destFile')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('mediaType')}
            >
              Media Type {sortBy === 'mediaType' && getSortIcon('mediaType')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('episodeNumber')}
            >
              Episode {sortBy === 'episodeNumber' && getSortIcon('episodeNumber')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('status')}
            >
              Status {sortBy === 'status' && getSortIcon('status')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('createdAt')}
            >
              Created {sortBy === 'createdAt' && getSortIcon('createdAt')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-800 hover:text-white"
              onClick={() => handleSort('updatedAt')}
            >
              Updated {sortBy === 'updatedAt' && getSortIcon('updatedAt')}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((file) => (
            <TableRow key={file.id}>
              <TableCell title={file.sourceFile}>
                {getFileName(file.sourceFile)}
              </TableCell>
              <TableCell className="font-medium" title={file.destFile}>
                {file.destFile ? getFileName(file.destFile) : '-'}
              </TableCell>
              <TableCell>{getMediaTypeLabel(file.mediaType)}</TableCell>
              <TableCell>
                {formatEpisodeNumber(file.seasonNumber, file.episodeNumber)}
              </TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(file.status)}`}>
                {getStatusLabel(file.status)}
                </span>
              </TableCell>
              <TableCell>
                {format(new Date(file.createdAt), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                {format(new Date(file.updatedAt), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <button 
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                    onClick={() => {}}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                    onClick={() => {}}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button 
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-full transition-colors"
                    onClick={() => {}}
                    title="Recreate Symlink"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data.items.length} of {data.totalItems} items
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => onPageChange?.(page - 1)}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                href="#"
              />
            </PaginationItem>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === data.totalPages || Math.abs(p - page) <= 2)
              .map((p, i, arr) => (
                <React.Fragment key={p}>
                  {i > 0 && arr[i - 1] !== p - 1 && (
                    <PaginationItem>
                      <PaginationLink href="#">...</PaginationLink>
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      isActive={page === p}
                      onClick={(e) => {
                        e.preventDefault();
                        onPageChange?.(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                </React.Fragment>
              ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange?.(page + 1)}
                className={page >= data.totalPages ? 'pointer-events-none opacity-50' : ''}
                href="#"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
} 