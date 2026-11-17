/**
 * Community Lifecycle & Governance contract
 * Foundation for Human Connection OS — Belong → Participate.
 *
 * Community → Identity → Purpose → Discoverability → Membership → Roles
 *          → Rules → Discussions → Events → Activities → Resources
 *          → Moderation → Notifications → Health → Trust → Lifecycle
 *
 * Financially neutral. No GHC / Pi coupling.
 */

export type CommunityLifecycleState =
  | "draft"
  | "discoverable"
  | "active"
  | "quiet"
  | "archived"

export type CommunityCapability =
  | "view"
  | "post"
  | "comment"
  | "react"
  | "chat"
  | "invite"
  | "request_join"
  | "announce"
  | "events"
  | "resources"
  | "moderate"
  | "pin"
  | "hide"
  | "unhide"
  | "remove_member"
  | "manage_roles"
  | "settings"
  | "view_moderation_log"
  | "report"
  | "transition_lifecycle"
  | "transfer_ownership"

export type CommunityReportTarget = "community" | "post" | "member" | "event" | "resource"

export type CommunityReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "misinformation"
  | "impersonation"
  | "safety"
  | "other"

export interface CommunityModerationLogEntry {
  id: string
  communityId: string
  action: "pin" | "unpin" | "hide" | "unhide" | "report" | "lifecycle" | "role_change" | "remove_member"
  actorId: string
  targetType: "post" | "member" | "community" | "report"
  targetId: string
  metadata?: Record<string, string | number | boolean | null>
  createdAt: number
}

export interface CommunityReportRecord {
  id: string
  communityId: string
  targetType: CommunityReportTarget
  targetId: string
  reporterId: string
  reason: CommunityReportReason
  note?: string
  status: "open" | "reviewing" | "resolved" | "dismissed"
  createdAt: number
}

export interface CommunityHealthSnapshot {
  communityId: string
  lifecycle: CommunityLifecycleState
  memberCount: number
  discussionCount: number
  unansweredDiscussionCount: number
  upcomingEventCount: number
  openReportCount: number
  moderationActionsLast7d: number
  lastActivityAt: number | null
  generatedAt: number
  /** Human-readable, non-financial signals only */
  signals: string[]
}

export interface CommunityGovernanceModel {
  communityId: string
  lifecycle: CommunityLifecycleState
  capabilities: CommunityCapability[]
  role: string
  canModerate: boolean
  canAnnounce: boolean
  canManageRoles: boolean
  health?: CommunityHealthSnapshot
}

/** Valid lifecycle transitions (safe, non-destructive). */
export const LIFECYCLE_TRANSITIONS: Record<
  CommunityLifecycleState,
  CommunityLifecycleState[]
> = {
  draft: ["discoverable", "archived"],
  discoverable: ["active", "quiet", "archived"],
  active: ["quiet", "archived"],
  quiet: ["active", "archived"],
  archived: ["active", "discoverable"], // restore: owner/admin explicit action
}

export function canTransitionLifecycle(
  from: CommunityLifecycleState,
  to: CommunityLifecycleState
): boolean {
  return (LIFECYCLE_TRANSITIONS[from] || []).includes(to)
}

export function lifecycleLabel(state: CommunityLifecycleState): string {
  switch (state) {
    case "draft":
      return "Draft"
    case "discoverable":
      return "Discoverable"
    case "active":
      return "Active"
    case "quiet":
      return "Quiet"
    case "archived":
      return "Archived"
    default:
      return "Unknown"
  }
}

export function isDiscoverableLifecycle(state: CommunityLifecycleState): boolean {
  return state === "discoverable" || state === "active" || state === "quiet"
}


/** Non-financial admin analytics — engagement quality only */
export type CommunityHealthGrade = "healthy" | "needs_attention" | "quiet" | "at_risk" | "archived"

export interface CommunityAdminHealthAnalytics {
  communityId: string
  grade: CommunityHealthGrade
  gradeLabel: string
  memberCount: number
  discussionCount: number
  unansweredCount: number
  unansweredRatio: number
  upcomingEventCount: number
  resourceCount: number
  openReportCount: number
  moderationActionsLast7d: number
  daysSinceLastActivity: number | null
  engagementScore: number // 0–100 informational
  recommendations: string[]
  signals: string[]
  generatedAt: number
}
