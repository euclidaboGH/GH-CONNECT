/**
 * Phase 6 — Flush queued send_message actions when connectivity returns.
 * Does not invent message content; only retries payloads already stored offline.
 */

import { offlineQueue, withRetry } from "@/lib/network-resilience"

export type FlushSendMessageFn = (input: {
  conversationId: string
  text: string
  messageId?: string
  replyToMessageId?: string
  sharedPostId?: string
}) => Promise<{ ok: boolean; error?: string; permanent?: boolean }>

export type FlushResult = {
  attempted: number
  succeeded: number
  failed: number
  failedItems: Array<{ conversationId: string; messageId?: string; error: string }>
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
  const failedItems: FlushResult["failedItems"] = []

  for (const action of pending) {
    const payload = (action.payload || {}) as {
      conversationId?: string
      text?: string
      messageId?: string
      replyToMessageId?: string
      sharedPostId?: string
    }
    const conversationId = String(payload.conversationId || "").trim()
    const text = String(payload.text || "").trim()
    if (!conversationId || !text) {
      offlineQueue.removeAction(action.id)
      if (conversationId && payload.messageId) failedItems.push({ conversationId, messageId: payload.messageId, error: "INVALID_QUEUED_MESSAGE" })
      failed++
      continue
    }

    try {
      const result = await withRetry(
        () =>
          send({
            conversationId,
            text,
            messageId: payload.messageId || `offline-${action.id}`,
            replyToMessageId: payload.replyToMessageId,
            sharedPostId: payload.sharedPostId,
          }),
        { maxRetries: 2, initialDelayMs: 400, timeoutMs: 15000 },
      )
      if (result?.ok) {
        offlineQueue.removeAction(action.id)
        succeeded++
      } else if (result?.permanent) {
        offlineQueue.removeAction(action.id)
        failedItems.push({ conversationId, messageId: payload.messageId || `offline-${action.id}`, error: result.error || "MESSAGE_REJECTED" })
        failed++
      } else {
        offlineQueue.incrementRetry(action.id)
        const updated = offlineQueue.getQueue().find((a) => a.id === action.id)
        if (updated && updated.retries >= (updated.maxRetries || 3)) {
          offlineQueue.removeAction(action.id)
          failedItems.push({ conversationId, messageId: payload.messageId || `offline-${action.id}`, error: result.error || "RETRY_LIMIT_REACHED" })
        }
        failed++
      }
    } catch {
      offlineQueue.incrementRetry(action.id)
      const updated = offlineQueue.getQueue().find((a) => a.id === action.id)
      if (updated && updated.retries >= (updated.maxRetries || 3)) {
        offlineQueue.removeAction(action.id)
        failedItems.push({ conversationId, messageId: payload.messageId || `offline-${action.id}`, error: "RETRY_LIMIT_REACHED" })
      }
      failed++
    }
  }

  return { attempted: pending.length, succeeded, failed, failedItems }
}
