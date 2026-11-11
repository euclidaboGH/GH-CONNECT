import { offlineQueue, withRetry } from "@/lib/network-resilience"
import { socialDeletePost } from "@/lib/social/client"

export async function flushQueuedDeletes(): Promise<{
  attempted: number
  succeeded: number
  failed: number
}> {
  const pending = offlineQueue.getActionsByType("delete_post")
  let succeeded = 0
  let failed = 0
  for (const action of pending) {
    const id = String((action.payload as { id?: string })?.id || "")
    if (!id) {
      offlineQueue.removeAction(action.id)
      failed++
      continue
    }
    try {
      const result = await withRetry(() => socialDeletePost(id), {
        maxRetries: 2,
        initialDelayMs: 400,
        timeoutMs: 15000,
      })
      if (result?.ok && result.durable !== false) {
        offlineQueue.removeAction(action.id)
        succeeded++
      } else {
        offlineQueue.incrementRetry(action.id)
        failed++
      }
    } catch {
      offlineQueue.incrementRetry(action.id)
      failed++
    }
  }
  return { attempted: pending.length, succeeded, failed }
}
