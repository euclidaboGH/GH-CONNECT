/**
 * Client-side dedup for attention pings (server remains authoritative).
 * Views are remembered across sessions in localStorage so the same browser
 * does not re-fire view for the same post. Server still enforces once-per-user.
 */

type EventType = "view" | "qualified_view" | "complete" | "save" | "share"

const sent = new Set<string>()
const VIEW_STORE_KEY = "ghc.attention.views.v1"

function key(postId: string, eventType: EventType): string {
  return `${eventType}:${postId}`
}

function loadViewStore(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(VIEW_STORE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x) => typeof x === "string").slice(-500))
  } catch {
    return new Set()
  }
}

function persistView(postId: string) {
  if (typeof window === "undefined") return
  try {
    const s = loadViewStore()
    s.add(postId)
    window.localStorage.setItem(VIEW_STORE_KEY, JSON.stringify([...s].slice(-500)))
  } catch {
    /* */
  }
}

/** Returns true if this client should schedule the event. */
export function shouldSendAttention(postId: string, eventType: EventType): boolean {
  const id = String(postId || "").trim()
  if (!id) return false
  const k = key(id, eventType)
  if (sent.has(k)) return false
  if (eventType === "view") {
    const stored = loadViewStore()
    if (stored.has(id)) {
      sent.add(k)
      return false
    }
  }
  sent.add(k)
  if (eventType === "view") persistView(id)
  return true
}

/** Allow retry after a soft failure (optional). */
export function clearAttentionSent(postId: string, eventType: EventType): void {
  sent.delete(key(String(postId || "").trim(), eventType))
}
