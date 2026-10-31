/**
 * Single-flight reconnect flush coordinator.
 * Prevents stampeding parallel flushes when online/focus fire together.
 * Does not invent success — each flush module remains authoritative for its queue.
 */

let inFlight: Promise<ReconnectFlushSummary> | null = null
let lastFinishedAt = 0

export type ReconnectFlushSummary = {
  messages: number
  conversations: number
  stories: number
  listings: number
  posts: number
  deletes: number
  skipped: boolean
  reason?: string
}

export async function runReconnectFlush(options?: {
  /** Minimum ms between full flushes (default 8s). */
  minIntervalMs?: number
}): Promise<ReconnectFlushSummary> {
  const minInterval = options?.minIntervalMs ?? 8_000
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      messages: 0,
      conversations: 0,
      stories: 0,
      listings: 0,
      posts: 0,
      deletes: 0,
      skipped: true,
      reason: "offline",
    }
  }
  if (inFlight) return inFlight
  if (Date.now() - lastFinishedAt < minInterval) {
    return {
      messages: 0,
      conversations: 0,
      stories: 0,
      listings: 0,
      posts: 0,
      deletes: 0,
      skipped: true,
      reason: "throttled",
    }
  }

  inFlight = (async () => {
    const summary: ReconnectFlushSummary = {
      messages: 0,
      conversations: 0,
      stories: 0,
      listings: 0,
      posts: 0,
      deletes: 0,
      skipped: false,
    }
    try {
      const { flushQueuedStories } = await import("@/lib/social/offline-story-flush")
      const stories = await flushQueuedStories()
      summary.stories = Number((stories as { succeeded?: number })?.succeeded || 0)
    } catch { /* */ }
    try {
      const { flushQueuedListings } = await import("@/lib/social/offline-listing-flush")
      const listings = await flushQueuedListings()
      summary.listings = Number((listings as { succeeded?: number })?.succeeded || 0)
    } catch { /* */ }
    try {
      const { flushQueuedPosts } = await import("@/lib/social/offline-post-flush")
      const posts = await flushQueuedPosts()
      summary.posts = Number((posts as { succeeded?: number })?.succeeded || 0)
    } catch { /* */ }
    try {
      const { flushQueuedDeletes } = await import("@/lib/social/offline-delete-flush")
      const deletes = await flushQueuedDeletes()
      summary.deletes = Number((deletes as { succeeded?: number })?.succeeded || 0)
    } catch { /* */ }
    // Messages / conversations need domain send callbacks — left to ghc-context
    // which already wires flushQueuedMessages with apiSendMessageWithRetry.
    lastFinishedAt = Date.now()
    try {
      window.dispatchEvent(
        new CustomEvent("ghc:reconnect-flush", { detail: summary }),
      )
    } catch { /* */ }
    return summary
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}
