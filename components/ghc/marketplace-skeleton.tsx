"use client"

/** Phase 1 — stable-height placeholder cards so browse never shows a blank spinner. */
export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-border/50 bg-card">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted/60 motion-reduce:animate-none" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-4 w-2/5 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted/50 motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  const n = Math.max(1, Math.min(12, Math.floor(count)))
  return (
    <div role="status" aria-live="polite" aria-label="Loading listings" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: n }, (_, i) => <ListingCardSkeleton key={i} />)}
      <span className="sr-only">Loading listings…</span>
    </div>
  )
}
