/**
 * Flush queued create_listing actions when connectivity returns.
 */
import { offlineQueue, withRetry } from "@/lib/network-resilience"
import { socialCreateMarketplaceListing } from "@/lib/social/client"

export async function flushQueuedListings(): Promise<{
  attempted: number
  succeeded: number
  failed: number
}> {
  const pending = offlineQueue.getActionsByType("create_listing")
  let succeeded = 0
  let failed = 0

  for (const action of pending) {
    const payload = (action.payload || {}) as Record<string, unknown>
    const title = String(payload.title || "").trim()
    if (!title) {
      offlineQueue.removeAction(action.id)
      failed++
      continue
    }
    try {
      const result = await withRetry(
        () =>
          socialCreateMarketplaceListing({
            id: payload.id ? String(payload.id) : undefined,
            title,
            description: String(payload.description || title),
            price: Number(payload.price) || 0,
            currency: typeof payload.currency === "string" ? payload.currency : "GHC",
            status: typeof payload.status === "string" ? payload.status : "active",
            kind: typeof payload.kind === "string" ? payload.kind : "product",
            availability:
              typeof payload.availability === "number" ? payload.availability : 1,
          }),
        { maxRetries: 2, initialDelayMs: 400, timeoutMs: 20000 }
      )
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
