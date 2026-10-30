"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  itemsPerPage?: number
  totalItems?: number
}

export function Pagination({ currentPage, totalPages, onPageChange, itemsPerPage, totalItems }: PaginationProps) {
  const pageNumbers = []
  const maxVisible = 5

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pageNumbers.push(i)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/70">
      <div className="text-sm text-muted-foreground">
        {itemsPerPage && totalItems && (
          <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="min-h-11 min-w-11 rounded-2xl p-2 transition hover:bg-muted disabled:opacity-50"
        >
          <ChevronLeft size={18} />
        </button>

        {start > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="min-h-11 min-w-11 rounded-2xl px-3 py-2 transition hover:bg-muted">
              1
            </button>
            {start > 2 && <span className="px-2">...</span>}
          </>
        )}

        {pageNumbers.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-h-11 min-w-11 rounded-2xl px-3 py-2 transition ${
              page === currentPage ? "bg-primary text-white" : "hover:bg-muted"
            }`}
          >
            {page}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-2">...</span>}
            <button onClick={() => onPageChange(totalPages)} className="min-h-11 min-w-11 rounded-2xl px-3 py-2 transition hover:bg-muted">
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="min-h-11 min-w-11 rounded-2xl p-2 transition hover:bg-muted disabled:opacity-50"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
