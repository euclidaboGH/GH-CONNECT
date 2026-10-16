/**
 * Client-side dedup for attention pings (server remains authoritative).
 * Session-scoped memory only — no aggregate counts, no user id payload.
 */

type EventType = "view" | "qualified_view" | "complete" | "save" | "share"

const sent = new Set<string>()

function key(postId: string, eventType: EventType): string {
  return `${eventType}:${postId}`
}

/** Returns true if this tab has not yet successfully scheduled this event. */
export function shouldSendAttention(postId: string, eventType: EventType): boolean {
  const id = String(postId || "").trim()
  if (!id) return false
  const k = key(id, eventType)
  if (sent.has(k)) return false
  sent.add(k)
  return true
}

/** Allow retry after a soft failure (optional). */
export function clearAttentionSent(postId: string, eventType: EventType): void {
  sent.delete(key(String(postId || "").trim(), eventType))
}
