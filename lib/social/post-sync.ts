/**
 * Phase 24 — canonical cross-surface post synchronization.
 * This is a UI coherence bus only: it never creates durable state or economic value.
 * Server APIs remain authoritative; consumers patch/remove already-loaded records and
 * can refetch when the event does not contain enough information.
 */
export const POST_SYNC_EVENT = "ghc:post-sync" as const

export type PostSyncOperation = "upsert" | "edit" | "archive" | "restore" | "delete" | "engagement"

export type PostSyncDetail = {
  version: 1
  postId: string
  operation: PostSyncOperation
  authorId?: string
  communityId?: string
  patch?: Record<string, unknown>
  source?: string
  occurredAt: number
}

export function broadcastPostSync(input: Omit<PostSyncDetail, "version" | "occurredAt"> & { occurredAt?: number }): void {
  if (typeof window === "undefined") return
  const postId = String(input.postId || "").trim()
  if (!postId) return
  try {
    window.dispatchEvent(new CustomEvent<PostSyncDetail>(POST_SYNC_EVENT, {
      detail: {
        ...input,
        postId,
        version: 1,
        occurredAt: Number(input.occurredAt) || Date.now(),
      },
    }))
  } catch { /* fail-soft: durable server state is authoritative */ }
}

export function readPostSyncDetail(event: Event): PostSyncDetail | null {
  const detail = (event as CustomEvent<Partial<PostSyncDetail>>).detail
  if (!detail || detail.version !== 1) return null
  const postId = String(detail.postId || "").trim()
  const operation = String(detail.operation || "") as PostSyncOperation
  if (!postId || !["upsert", "edit", "archive", "restore", "delete", "engagement"].includes(operation)) return null
  return { ...detail, postId, operation, version: 1, occurredAt: Number(detail.occurredAt) || Date.now() } as PostSyncDetail
}
