/**
 * Phase 6 — Flush queued send_message actions when connectivity returns.
 * Does not invent message content; only retries payloads already stored offline.
 */

import { offlineQueue, withRetry } from "@/lib/network-resilience"

export type FlushSendMessageFn = (input: {
  conversationId: string
  text: string
  messageId?: string
}) => Promise<{ ok: boolean; error?: string }>

export type FlushResult = {
  attempted: number
  succeeded: number
  failed: number
}

/**
 * Process offlineQueue entries of type `send_message`.
 * Removes successful items; increments retry and drops after maxRetries.
 */
export async function flushQueuedMessages(
  send: FlushSendMessageFn,
): Promise<FlushResult> {
  const pending = offlineQueue.getActionsByType("send_message")
  let succeeded = 0
  let failed = 0

  for (const action of pending) {
    const payload = (action.payload || {}) as {
      conversationId?: string
      text?: string
      messageId?: string
    }
    const conversationId = String(payload.conversationId || "").trim()
    const text = String(payload.text || "").trim()
    if (!conversationId || !text) {
      offlineQueue.removeAction(action.id)
      continue
    }

    try {
      const result = await withRetry(
        () =>
          send({
            conversationId,
            text,
            messageId: payload.messageId,
          }),
        { maxRetries: 2, initialDelayMs: 400, timeoutMs: 15000 },
      )
      if (result?.ok) {
        offlineQueue.removeAction(action.id)
        succeeded++
      } else {
        offlineQueue.incrementRetry(action.id)
        const updated = offlineQueue.getQueue().find((a) => a.id === action.id)
        if (updated && updated.retries >= (updated.maxRetries || 3)) {
          offlineQueue.removeAction(action.id)
        }
        failed++
      }
    } catch {
      offlineQueue.incrementRetry(action.id)
      const updated = offlineQueue.getQueue().find((a) => a.id === action.id)
      if (updated && updated.retries >= (updated.maxRetries || 3)) {
        offlineQueue.removeAction(action.id)
      }
      failed++
    }
  }

  return { attempted: pending.length, succeeded, failed }
}
