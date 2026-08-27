"use client"

/**
 * Skeleton design system — consistent loading placeholders across modules.
 */

export function ImageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-full w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] ${className}`}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="w-full space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
          <div className="h-2.5 w-1/4 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-gray-100" />
    </div>
  )
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3.5 animate-pulse rounded bg-gradient-to-r from-gray-200 to-gray-100 ${
            i === lines - 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  )
}

export function AvatarSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8", md: "h-12 w-12", lg: "h-16 w-16" }
  return <div className={`${sizes[size]} animate-pulse rounded-full bg-gray-200`} />
}

export function DiscoverCardSkeleton() {
  return (
    <div className="w-full space-y-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-full bg-gray-100" />
        <div className="h-9 flex-1 animate-pulse rounded-full bg-gray-100" />
      </div>
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="h-11 w-11 animate-pulse rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 px-3 py-3" aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-50" aria-busy="true" aria-label="Loading messages">
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading profile">
      <div className="h-36 bg-gray-200 sm:h-44" />
      <div className="relative mx-auto -mt-12 max-w-2xl px-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-end gap-4">
            <div className="h-20 w-20 rounded-full bg-gray-200 ring-4 ring-white" />
            <div className="flex-1 space-y-2 pb-2">
              <div className="h-5 w-40 rounded bg-gray-200" />
              <div className="h-3 w-28 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CommunityCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="h-14 w-14 animate-pulse rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}


/** Feed placeholder rows for incremental loading on mobile */
export function FeedSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-2 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="mb-2 h-3 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  )
}
