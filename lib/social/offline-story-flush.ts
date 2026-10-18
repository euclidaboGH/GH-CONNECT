/**
 * Flush queued create_story actions when connectivity returns.
 */
import { offlineQueue, withRetry } from "@/lib/network-resilience"
import { socialCreateStory } from "@/lib/social/client"

export type FlushStoryResult = {
  attempted: number
  succeeded: number
  failed: number
}

export async function flushQueuedStories(): Promise<FlushStoryResult> {
  const pending = offlineQueue.getActionsByType("create_story")
  let succeeded = 0
  let failed = 0

  for (const action of pending) {
    const payload = (action.payload || {}) as Record<string, unknown>
    const id = payload.id ? String(payload.id) : undefined
    const rawMedia = payload.media
    const media =
      rawMedia === null
        ? null
        : typeof rawMedia === "object" &&
            rawMedia !== null &&
            !Array.isArray(rawMedia) &&
            ((rawMedia as Record<string, unknown>).type === "image" ||
              (rawMedia as Record<string, unknown>).type === "video") &&
            typeof (rawMedia as Record<string, unknown>).url === "string"
          ? {
              type: (rawMedia as { type: "image" | "video" }).type,
              url: (rawMedia as { url: string }).url,
            }
          : undefined
    try {
      const result = await withRetry(
        () =>
          socialCreateStory({
            id,
            ownerId: typeof payload.ownerId === "string" ? payload.ownerId : undefined,
            name: typeof payload.name === "string" ? payload.name : undefined,
            photo: typeof payload.photo === "string" ? payload.photo : undefined,
            text: typeof payload.text === "string" ? payload.text : "",
            media,
            background: typeof payload.background === "string" ? payload.background : undefined,
            audience: typeof payload.audience === "string" ? payload.audience : undefined,
            expiresAt:
              typeof payload.expiresAt === "number"
                ? payload.expiresAt
                : Date.now() + 24 * 60 * 60 * 1000,
            createdAt: typeof payload.createdAt === "number" ? payload.createdAt : Date.now(),
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
        }
        failed++
      }
    } catch {
      offlineQueue.incrementRetry(action.id)
      failed++
    }
  }

  return { attempted: pending.length, succeeded, failed }
}
