/**
 * Messaging UX helpers — presentation only.
 * Never invents messages, receipts, or conversation membership.
 */

export const MAX_MESSAGE_LENGTH = 4000
export const MESSAGE_DRAFT_PREFIX = "ghc-msg-draft:"
export const MESSAGE_WINDOW_DEFAULT = 40
export const MESSAGE_WINDOW_STEP = 30

export function clipMessageText(text: string, max = MAX_MESSAGE_LENGTH): string {
  return String(text || "").slice(0, max)
}

export function loadConversationDraft(conversationId: string): string {
  if (typeof window === "undefined" || !conversationId) return ""
  try {
    return String(window.localStorage.getItem(MESSAGE_DRAFT_PREFIX + conversationId) || "")
  } catch {
    return ""
  }
}

export function saveConversationDraft(conversationId: string, text: string): void {
  if (typeof window === "undefined" || !conversationId) return
  try {
    const t = String(text || "")
    if (!t.trim()) {
      window.localStorage.removeItem(MESSAGE_DRAFT_PREFIX + conversationId)
    } else {
      window.localStorage.setItem(MESSAGE_DRAFT_PREFIX + conversationId, t.slice(0, MAX_MESSAGE_LENGTH))
    }
  } catch {
    /* */
  }
}

export function clearConversationDraft(conversationId: string): void {
  if (typeof window === "undefined" || !conversationId) return
  try {
    window.localStorage.removeItem(MESSAGE_DRAFT_PREFIX + conversationId)
  } catch {
    /* */
  }
}

/** Group consecutive messages from same sender within 5 minutes */
export function shouldGroupWithPrevious(
  prev: { senderId?: string; createdAt?: number } | null | undefined,
  curr: { senderId?: string; createdAt?: number }
): boolean {
  if (!prev || !prev.senderId || !curr.senderId) return false
  if (prev.senderId !== curr.senderId) return false
  const a = Number(prev.createdAt || 0)
  const b = Number(curr.createdAt || 0)
  if (!a || !b) return false
  return Math.abs(b - a) < 5 * 60 * 1000
}

export function formatMessageDayDivider(ts?: number): string {
  if (!ts) return ""
  try {
    const d = new Date(ts)
    const today = new Date()
    const yday = new Date()
    yday.setDate(today.getDate() - 1)
    const sameDay = (x: Date, y: Date) =>
      x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
    if (sameDay(d, today)) return "Today"
    if (sameDay(d, yday)) return "Yesterday"
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function dayKey(ts?: number): string {
  if (!ts) return ""
  try {
    const d = new Date(ts)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  } catch {
    return ""
  }
}
