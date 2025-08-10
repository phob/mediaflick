import React from "react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination"

interface TablePaginationProps {
  readonly currentPage: number
  readonly totalPages: number
  readonly onPageChange?: (page: number) => void
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
}: TablePaginationProps) {
  // Helper function to generate pagination items
  const generatePaginationItems = React.useCallback((currentPage: number, totalPages: number) => {
    const items: React.ReactNode[] = []
    const maxVisiblePages = 5 // Show up to 5 page numbers
    
    // Always show first page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink
            onClick={() => onPageChange?.(1)}
            isActive={currentPage === 1}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      )
    }
    
    // Add ellipsis if there's a gap after first page
    if (currentPage > 4) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      )
    }
    
    // Calculate the range of pages to show around current page
    let startPage = Math.max(2, currentPage - 1)
    let endPage = Math.min(totalPages - 1, currentPage + 1)
    
    // Adjust range if we're near the beginning or end
    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, 4)
    }
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - 3)
    }
    
    // Add the pages in the middle range
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      if (pageNum !== 1 && pageNum !== totalPages) {
        items.push(
          <PaginationItem key={pageNum}>
            <PaginationLink
              onClick={() => onPageChange?.(pageNum)}
              isActive={currentPage === pageNum}
              className="cursor-pointer"
            >
              {pageNum}
            </PaginationLink>
          </PaginationItem>
        )
      }
    }
    
    // Add ellipsis if there's a gap before last page
    if (currentPage < totalPages - 3) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      )
    }
    
    // Always show last page (if it's not the same as first page)
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink
            onClick={() => onPageChange?.(totalPages)}
            isActive={currentPage === totalPages}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      )
    }
    
    return items
  }, [onPageChange])

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="mt-4 flex justify-center">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {generatePaginationItems(currentPage, totalPages)}
          <PaginationItem>
            <PaginationNext 
              onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
