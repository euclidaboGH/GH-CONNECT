/**
 * Notifications domain contract — deep-link targets, not Settings dump.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export type NotificationBucket = "all" | "social" | "messages" | "ghc" | "rewards" | "system"

export interface NotificationItem {
  id: string
  bucket: NotificationBucket
  title: string
  body: string
  createdAt: string
  read: boolean
  /** Deep link — never force Settings for social/GHC items */
  open?: {
    surface: "feed" | "chat" | "wallet" | "rewards" | "profile" | "discover" | "community"
    id?: string
  }
}

export interface NotificationsDomainContract {
  list(bucket?: NotificationBucket, limit?: number): DomainResult<NotificationItem[]>
  emptyState(bucket?: NotificationBucket): DomainEmptyState
}

export function notificationsEmptyState(bucket: NotificationBucket = "all"): DomainEmptyState {
  return {
    title: bucket === "all" ? "No notifications" : `No ${bucket} notifications`,
    description: "Updates about people, messages, and GreenHaven activity will appear here.",
  }
}
