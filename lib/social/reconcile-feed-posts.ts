import type { Post } from "@/lib/ghc-types"

export type FeedReconcileMode = "replace" | "append"

/**
 * Reconcile canonical server posts with already-loaded client records.
 *
 * replace: server rows lead and local-only, non-deleted records remain available
 *          for optimistic/offline continuity. A successful empty response is
 *          intentionally represented by the local-only set, not by stale remote
 *          duplicates.
 * append: existing rows retain precedence; only unseen server rows are appended.
 *
 * Both modes enforce unique, non-empty IDs and stable newest-first ordering.
 * This is presentation-state reconciliation only; it never persists data.
 */
export function reconcileFeedPosts(
  current: readonly Post[],
  remote: readonly Post[],
  mode: FeedReconcileMode = "replace",
): Post[] {
  const currentById = new Map<string, Post>()
  for (const post of current) {
    const id = String(post?.id || "").trim()
    if (!id || post.deletedAt) continue
    if (!currentById.has(id)) currentById.set(id, post.id === id ? post : { ...post, id })
  }

  const remoteById = new Map<string, Post>()
  for (const post of remote) {
    const id = String(post?.id || "").trim()
    if (!id || post.deletedAt) continue
    // Keep the first server occurrence; API ordering is already authoritative.
    if (!remoteById.has(id)) remoteById.set(id, post.id === id ? post : { ...post, id })
  }

  const merged = new Map<string, Post>()
  if (mode === "append") {
    for (const [id, post] of currentById) merged.set(id, post)
    for (const [id, post] of remoteById) {
      if (!merged.has(id)) merged.set(id, post)
    }
  } else {
    for (const [id, post] of remoteById) merged.set(id, post)
    for (const [id, post] of currentById) {
      if (!remoteById.has(id)) merged.set(id, post)
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const timeDelta = (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
    return timeDelta || String(a.id).localeCompare(String(b.id))
  })
}
