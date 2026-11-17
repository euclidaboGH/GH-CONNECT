import type { Notification } from "./notifications"

export type NotificationActionId = "open" | "mark_read" | "dismiss" | "retry"

export interface NotificationActionDescriptor {
  id: NotificationActionId
  label: string
  description: string
  emphasis: "primary" | "secondary" | "danger"
}

/**
 * Single presentation contract for notification actions. It derives labels
 * from the already-resolved, allow-listed notification destination fields.
 * It never authorizes or performs server-side work.
 */
export function resolveNotificationActions(
  notification: Notification,
  options: { retryAvailable?: boolean } = {}
): NotificationActionDescriptor[] {
  const data = (notification.data || {}) as Record<string, unknown>
  const nested = data.deepLink && typeof data.deepLink === "object"
    ? data.deepLink as Record<string, unknown>
    : {}
  const open = String(nested.open || data.open || "").toLowerCase()
  const section = String(nested.section || data.section || "").toLowerCase()
  const contextualLabel =
    section === "transaction" ? "View transaction" :
    section === "transfer-request" ? "Review transfer" :
    ["friend-request", "connection_requests", "group-request"].includes(section) ? "Review request" :
    ["chat", "messages"].includes(open) ? "Open message" :
    open === "marketplace" ? "View marketplace item" :
    open === "wallet" ? "Open wallet" :
    open === "rewards" ? "View rewards" :
    open === "communities" ? "Open community" :
    open === "feed" && Boolean(nested.postId || data.postId) ? "View post" :
    open === "settings" ? "Review account notice" : "Open"

  const actions: NotificationActionDescriptor[] = [
    { id: "open", label: contextualLabel, description: "Open the related GreenHaven destination", emphasis: "primary" },
  ]
  if (!notification.read) {
    actions.push({ id: "mark_read", label: "Mark read", description: "Mark this notification as read", emphasis: "secondary" })
  }
  if (options.retryAvailable) {
    actions.push({ id: "retry", label: "Retry", description: "Retry the last notification action that did not save", emphasis: "secondary" })
  }
  actions.push({ id: "dismiss", label: "Dismiss", description: "Hide this notification on this device", emphasis: "danger" })
  return actions
}
