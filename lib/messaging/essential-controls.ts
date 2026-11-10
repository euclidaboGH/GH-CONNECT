/**
 * Section 3 — Messaging & Notifications essential controls (0.338.15)
 */

export const MESSAGE_BODY_MAX = 8000
export const CLIENT_MESSAGE_ID_MAX = 80
export const CONVERSATION_ID_MAX = 180
export const MESSAGE_ATTACHMENTS_MAX = 4
export const OFFLINE_RETRY_MAX = 5

export function isValidClientMessageId(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  const id = raw.trim()
  if (!id || id.length > CLIENT_MESSAGE_ID_MAX) return false
  if (/[\u0000-\u001f\u007f]/.test(id)) return false
  return true
}

export function isValidConversationId(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  const id = raw.trim()
  if (!id || id.length > CONVERSATION_ID_MAX) return false
  if (/[\u0000-\u001f\u007f]/.test(id)) return false
  return true
}

/** Permanent client failures that should be dropped from offline queue. */
export function isPermanentMessageFailure(status: number | undefined, code?: string): boolean {
  if (status === 400 || status === 403 || status === 404 || status === 409 || status === 422) return true
  const c = String(code || "").toUpperCase()
  return c === "NOT_MEMBER" || c === "BLOCKED" || c === "EMPTY_BODY" || c === "INVALID_ATTACHMENT"
}

export const NOTIFICATION_CHANNELS = ["in_app", "browser_alert", "remote_push"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/** Remote push remains disabled until provider + worker acceptance. */
export const REMOTE_PUSH_PRODUCTION_ENABLED = false
