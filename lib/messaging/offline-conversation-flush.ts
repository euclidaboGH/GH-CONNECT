/**
 * Flush queued create_conversation actions when connectivity returns.
 */
import { offlineQueue, withRetry } from "@/lib/network-resilience"
import { apiCreateDirectConversation } from "@/lib/messaging/server-messaging-sync"

export async function flushQueuedConversations(): Promise<{
  attempted: number
  succeeded: number
  failed: number
  idMap: Record<string, string>
}> {
  const pending = offlineQueue.getActionsByType("create_conversation")
  let succeeded = 0
  let failed = 0
  const idMap: Record<string, string> = {}

  for (const action of pending) {
    const payload = (action.payload || {}) as {
      userId?: string
      localId?: string
    }
    const userId = String(payload.userId || "")
    if (!userId) {
      offlineQueue.removeAction(action.id)
      failed++
      continue
    }
    try {
      const result = await withRetry(() => apiCreateDirectConversation(userId), {
        maxRetries: 2,
        initialDelayMs: 400,
        timeoutMs: 15000,
      })
      if (result?.ok && result.durable !== false && result.conversation?.id) {
        const remoteId = String(result.conversation.id)
        if (payload.localId && payload.localId !== remoteId) {
          idMap[payload.localId] = remoteId
        }
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

  return { attempted: pending.length, succeeded, failed, idMap }
}
