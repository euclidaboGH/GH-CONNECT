/**
 * Flush queued create_post actions when connectivity returns.
 * Does not invent post content — only retries stored offline payloads.
 */
import { offlineQueue, withRetry } from "@/lib/network-resilience"
import { socialCreatePost } from "@/lib/social/client"

export type FlushPostResult = {
  attempted: number
  succeeded: number
  failed: number
}

export async function flushQueuedPosts(): Promise<FlushPostResult> {
  const pending = offlineQueue.getActionsByType("create_post")
  let succeeded = 0
  let failed = 0

  for (const action of pending) {
    const payload = (action.payload || {}) as Record<string, unknown>
    const content = String(payload.content || "").trim()
    const id = payload.id ? String(payload.id) : undefined
    if (!content && !Array.isArray(payload.images) && !payload.video && !payload.pdf) {
      offlineQueue.removeAction(action.id)
      failed++
      continue
    }

    try {
      const result = await withRetry(
        () =>
          socialCreatePost({
            id,
            content: content || " ",
            images: Array.isArray(payload.images)
              ? (payload.images as string[]).filter((u) => typeof u === "string")
              : [],
            video: typeof payload.video === "string" ? payload.video : null,
            pdf: typeof payload.pdf === "string" ? payload.pdf : null,
            pdfName: typeof payload.pdfName === "string" ? payload.pdfName : null,
            visibility:
              payload.visibility === "followers" ||
              payload.visibility === "mutuals" ||
              payload.visibility === "private"
                ? payload.visibility
                : "public",
            authorName: typeof payload.authorName === "string" ? payload.authorName : undefined,
            authorPhoto: typeof payload.authorPhoto === "string" ? payload.authorPhoto : undefined,
            communityId: typeof payload.communityId === "string" ? payload.communityId : undefined,
            communityName: typeof payload.communityName === "string" ? payload.communityName : undefined,
          }),
        { maxRetries: 2, initialDelayMs: 400, timeoutMs: 20000 }
      )

      if (result?.ok && result.durable !== false) {
        offlineQueue.removeAction(action.id)
        succeeded++
      } else {
        offlineQueue.incrementRetry(action.id)
        const updated = offlineQueue.getQueue().find((a) => a.id === action.id)
        if (!updated || (updated.retries || 0) >= (action.maxRetries || 3)) {
          offlineQueue.removeAction(action.id)
          failed++
        } else {
          failed++
        }
      }
    } catch {
      offlineQueue.incrementRetry(action.id)
      failed++
    }
  }

  return { attempted: pending.length, succeeded, failed }
}
