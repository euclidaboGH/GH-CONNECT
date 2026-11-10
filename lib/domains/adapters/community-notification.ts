/**
 * Community notification category + subtypes + canonical constructors.
 * Payloads are navigation/context only — never authorization.
 */

import type { Notification } from "@/lib/notifications"
import { notificationSystem } from "@/lib/notifications"

export type CommunityNotificationSubtype =
  | "invitation"
  | "join_request"
  | "join_accepted"
  | "join_declined"
  | "invitation_accepted"
  | "announcement"
  | "generic"

export interface CommunityNotificationInput {
  subtype: Exclude<CommunityNotificationSubtype, "generic">
  communityId: string
  communityName?: string
  userId?: string
  actorName?: string
  referenceId?: string
  messageOverride?: string
}

export function isCommunityNotification(n: Notification): boolean {
  const data = (n.data || {}) as Record<string, unknown>
  const cat = String(data.category || data.bucket || "").toLowerCase()
  const open = String(data.open || "").toLowerCase()
  const subtype = String(data.subtype || data.communitySubtype || "").toLowerCase()
  const blob = `${n.title || ""} ${n.message || ""}`.toLowerCase()

  if (cat === "community" || cat === "communities") return true
  if (open === "communities" || open === "community") return true
  if (data.communityId != null || data.groupId != null) return true
  if (
    subtype === "invitation" ||
    subtype === "join_request" ||
    subtype === "join_accepted" ||
    subtype === "join_declined" ||
    subtype === "invitation_accepted" ||
    subtype === "announcement"
  ) {
    return true
  }
  if (
    /community invite|join request|community announcement|invited you to|accepted your join/i.test(
      blob
    )
  ) {
    return true
  }
  return false
}

export function communityNotificationSubtype(n: Notification): CommunityNotificationSubtype {
  const data = (n.data || {}) as Record<string, unknown>
  const raw = String(data.subtype || data.communitySubtype || "").toLowerCase()
  const map: Record<string, CommunityNotificationSubtype> = {
    invitation: "invitation",
    community_invite: "invitation",
    invite: "invitation",
    join_request: "join_request",
    join_request_pending: "join_request",
    join_accepted: "join_accepted",
    join_request_accepted: "join_accepted",
    join_declined: "join_declined",
    join_request_declined: "join_declined",
    invitation_accepted: "invitation_accepted",
    invite_accepted: "invitation_accepted",
    announcement: "announcement",
  }
  if (map[raw]) return map[raw]

  const blob = `${n.title || ""} ${n.message || ""}`.toLowerCase()
  if (/declined your join|join request declined/i.test(blob)) return "join_declined"
  if (/accepted your join|join request accepted/i.test(blob)) return "join_accepted"
  if (/accepted your invitation|joined via your invite/i.test(blob)) return "invitation_accepted"
  if (/community announcement|announced in/i.test(blob)) return "announcement"
  if (/join request|wants to join/i.test(blob)) return "join_request"
  if (/invited you|community invite/i.test(blob)) return "invitation"
  return "generic"
}

export function communityNotificationLabel(n: Notification): string {
  switch (communityNotificationSubtype(n)) {
    case "invitation":
      return "Community invitation"
    case "join_request":
      return "Join request"
    case "join_accepted":
      return "Join request accepted"
    case "join_declined":
      return "Join request declined"
    case "invitation_accepted":
      return "Invitation accepted"
    case "announcement":
      return "Community announcement"
    default:
      return "Community"
  }
}

export function communityNotificationDedupeKey(input: CommunityNotificationInput): string {
  const ref =
    input.referenceId ||
    `${input.subtype}:${input.communityId}:${input.userId || "none"}`
  return `community:${ref}`
}

export function buildCommunityNotificationData(
  input: CommunityNotificationInput
): Record<string, unknown> {
  const name = input.communityName || "a community"
  return {
    category: "community",
    bucket: "community",
    subtype: input.subtype,
    communitySubtype: input.subtype,
    communityId: input.communityId,
    groupId: input.communityId,
    userId: input.userId,
    referenceId: communityNotificationDedupeKey(input),
    open: "communities",
    tab: "communities",
    section:
      input.subtype === "invitation" ||
      input.subtype === "invitation_accepted" ||
      input.subtype === "join_request" ||
      input.subtype === "join_accepted" ||
      input.subtype === "join_declined"
        ? "group-request"
        : "conversation",
    invite: input.subtype === "invitation",
    communityName: name,
  }
}

export function communityNotificationCopy(input: CommunityNotificationInput): {
  title: string
  message: string
  icon: string
} {
  const name = input.communityName || "a community"
  const actor = input.actorName || "Someone"
  switch (input.subtype) {
    case "invitation":
      return {
        title: "Community invitation",
        message: input.messageOverride || `${actor} invited you to ${name}`,
        icon: "👥",
      }
    case "join_request":
      return {
        title: "Join request",
        message: input.messageOverride || `${actor} requested to join ${name}`,
        icon: "✉️",
      }
    case "join_accepted":
      return {
        title: "Join request accepted",
        message: input.messageOverride || `Your request to join ${name} was accepted`,
        icon: "✓",
      }
    case "join_declined":
      return {
        title: "Join request declined",
        message: input.messageOverride || `Your request to join ${name} was declined`,
        icon: "—",
      }
    case "invitation_accepted":
      return {
        title: "Invitation accepted",
        message: input.messageOverride || `${actor} joined ${name}`,
        icon: "✓",
      }
    case "announcement":
      return {
        title: "Community announcement",
        message: input.messageOverride || `New announcement in ${name}`,
        icon: "📢",
      }
  }
}

export function shouldSkipDuplicateCommunityNotification(
  input: CommunityNotificationInput,
  existing?: Notification[]
): boolean {
  const key = communityNotificationDedupeKey(input)
  let list = existing
  if (!list && typeof (notificationSystem as any).getNotifications === "function") {
    list = (notificationSystem as any).getNotifications()
  }
  if (!Array.isArray(list)) return false
  return list.some((n) => {
    const data = (n.data || {}) as Record<string, unknown>
    return String(data.referenceId || "") === key
  })
}

export function emitCommunityNotification(
  input: CommunityNotificationInput
): Notification | null {
  if (shouldSkipDuplicateCommunityNotification(input)) {
    return null
  }
  const copy = communityNotificationCopy(input)
  const data = buildCommunityNotificationData(input)
  return notificationSystem.addNotification(
    "group",
    copy.title,
    copy.message,
    copy.icon,
    data
  )
}
