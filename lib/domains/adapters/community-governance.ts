/**
 * Community governance adapter.
 * Capabilities map over community-domain role matrix.
 * Moderation log / reports: session-memory with durable proposal (NOT APPLIED).
 */

import type {
  CommunityCapability,
  CommunityGovernanceModel,
  CommunityHealthSnapshot,
  CommunityLifecycleState,
  CommunityModerationLogEntry,
  CommunityReportReason,
  CommunityReportRecord,
  CommunityReportTarget,
} from "@/lib/domains/contracts/community-governance"
import {
  canTransitionLifecycle,
  isDiscoverableLifecycle,
  lifecycleLabel,
} from "@/lib/domains/contracts/community-governance"
import {
  canPerform,
  normalizeRole,
  type CommunityRole,
  type CommunityAction,
} from "@/lib/domains/community-domain"
import {
  sessionAppendLog,
  sessionListLogs,
  sessionAppendReport,
  sessionListReports,
  sessionUpdateReport,
  getGovernanceDurability,
  governanceDurabilityLabel,
  tryServerMirror,
  type GovernanceWriteResult,
} from "@/lib/domains/adapters/community-governance-store"

/** Map domain actions → product capabilities */
const ACTION_TO_CAPS: Partial<Record<CommunityAction, CommunityCapability[]>> = {
  view: ["view"],
  post: ["post"],
  comment: ["comment", "react"],
  chat: ["chat"],
  invite: ["invite"],
  announce: ["announce"],
  events: ["events"],
  moderate: ["moderate", "pin", "hide", "unhide", "view_moderation_log"],
  remove_member: ["remove_member"],
  manage_roles: ["manage_roles"],
  settings: ["settings", "transition_lifecycle"],
}

export function capabilitiesForRole(role: string | undefined | null): CommunityCapability[] {
  const r = normalizeRole(role)
  const caps = new Set<CommunityCapability>(["report", "request_join"])
  const actions: CommunityAction[] = [
    "view",
    "post",
    "comment",
    "chat",
    "invite",
    "announce",
    "events",
    "moderate",
    "remove_member",
    "manage_roles",
    "settings",
  ]
  for (const a of actions) {
    if (canPerform(r, a)) {
      for (const c of ACTION_TO_CAPS[a] || []) caps.add(c)
    }
  }
  if (r === "owner") {
    caps.add("transfer_ownership")
    caps.add("resources")
  }
  if (r === "admin" || r === "moderator") {
    caps.add("resources")
  }
  return Array.from(caps)
}

export function buildGovernanceModel(input: {
  communityId: string
  role?: string | null
  lifecycle?: CommunityLifecycleState
  health?: CommunityHealthSnapshot
}): CommunityGovernanceModel {
  const role = normalizeRole(input.role)
  const capabilities = capabilitiesForRole(role)
  return {
    communityId: input.communityId,
    lifecycle: input.lifecycle || "active",
    capabilities,
    role,
    canModerate: capabilities.includes("moderate"),
    canAnnounce: capabilities.includes("announce"),
    canManageRoles: capabilities.includes("manage_roles"),
    health: input.health,
  }
}

// --- Governance store (session default; optional server mirror) ---

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export { getGovernanceDurability, governanceDurabilityLabel }
export type { GovernanceWriteResult }

export function appendModerationLog(
  entry: Omit<CommunityModerationLogEntry, "id" | "createdAt"> & { createdAt?: number }
): CommunityModerationLogEntry {
  const full: CommunityModerationLogEntry = {
    id: uid("mlog"),
    createdAt: entry.createdAt ?? Date.now(),
    communityId: entry.communityId,
    action: entry.action,
    actorId: entry.actorId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: {
      ...entry.metadata,
      durability: getGovernanceDurability(),
    },
  }
  sessionAppendLog(full)
  // Fire-and-forget server mirror — never claim durable on session-only success
  void tryServerMirror("/api/governance/moderation-log", { entry: full })
  return full
}

/** Explicit result including durability flag for admin UI */
export function appendModerationLogWithMeta(
  entry: Omit<CommunityModerationLogEntry, "id" | "createdAt"> & { createdAt?: number }
): GovernanceWriteResult<CommunityModerationLogEntry> {
  const data = appendModerationLog(entry)
  const durability = getGovernanceDurability()
  return {
    data,
    durability,
    // Session write is never durable; server confirm is async — honest default false
    durable: false,
  }
}

export function listModerationLog(communityId: string): CommunityModerationLogEntry[] {
  return sessionListLogs(communityId)
}

export function createCommunityReport(input: {
  communityId: string
  targetType: CommunityReportTarget
  targetId: string
  reporterId: string
  reason: CommunityReportReason
  note?: string
}): CommunityReportRecord {
  const rec: CommunityReportRecord = {
    id: uid("crep"),
    communityId: input.communityId,
    targetType: input.targetType,
    targetId: input.targetId,
    reporterId: input.reporterId,
    reason: input.reason,
    note: input.note,
    status: "open",
    createdAt: Date.now(),
  }
  sessionAppendReport(rec)
  void tryServerMirror("/api/governance/reports", { report: rec })
  appendModerationLog({
    communityId: input.communityId,
    action: "report",
    actorId: input.reporterId,
    targetType: "report",
    targetId: rec.id,
    metadata: { targetType: input.targetType, targetId: input.targetId, reason: input.reason },
  })
  return rec
}

export function listCommunityReports(communityId: string): CommunityReportRecord[] {
  return sessionListReports(communityId)
}

export function buildHealthSnapshot(input: {
  communityId: string
  lifecycle: CommunityLifecycleState
  memberCount: number
  boardPosts?: Array<{ id: string; comments?: number; replies?: unknown[]; createdAt?: number; hidden?: boolean }>
  events?: Array<{ startsAt?: number; startAt?: number; date?: number }>
  openReportCount?: number
}): CommunityHealthSnapshot {
  const now = Date.now()
  const posts = (input.boardPosts || []).filter((p) => !p.hidden)
  const unanswered = posts.filter((p) => {
    const n = p.comments ?? (Array.isArray(p.replies) ? p.replies.length : 0)
    return n === 0
  }).length
  const upcoming = (input.events || []).filter((e) => {
    const t = Number(e.startsAt || e.startAt || e.date) || 0
    return t >= now
  }).length
  const lastActivityAt =
    posts.reduce((max, p) => Math.max(max, Number(p.createdAt) || 0), 0) || null

  const logs = listModerationLog(input.communityId)
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const moderationActionsLast7d = logs.filter((l) => l.createdAt >= weekAgo).length

  const signals: string[] = []
  if (input.lifecycle === "archived") signals.push("Archived — new participation closed")
  if (input.lifecycle === "quiet") signals.push("Quiet — low recent activity")
  if (input.memberCount < 3) signals.push("Small membership")
  if (unanswered > 3) signals.push(`${unanswered} unanswered discussions`)
  if (upcoming > 0) signals.push(`${upcoming} upcoming event${upcoming === 1 ? "" : "s"}`)
  if ((input.openReportCount || 0) > 0) signals.push("Open safety reports need review")
  if (moderationActionsLast7d > 0) signals.push(`${moderationActionsLast7d} moderation actions (7d)`)
  if (!signals.length) signals.push("Healthy baseline activity")

  return {
    communityId: input.communityId,
    lifecycle: input.lifecycle,
    memberCount: input.memberCount,
    discussionCount: posts.length,
    unansweredDiscussionCount: unanswered,
    upcomingEventCount: upcoming,
    openReportCount: input.openReportCount || listCommunityReports(input.communityId).filter((r) => r.status === "open").length,
    moderationActionsLast7d,
    lastActivityAt,
    generatedAt: now,
    signals,
  }
}


export function resolveCommunityReport(
  communityId: string,
  reportId: string,
  status: "resolved" | "dismissed" | "reviewing",
  actorId: string
): CommunityReportRecord | null {
  const updated = sessionUpdateReport(communityId, reportId, { status })
  if (!updated) return null
  void tryServerMirror("/api/governance/reports", {
    report: updated,
    action: "resolve",
  })
  appendModerationLog({
    communityId,
    action: "report",
    actorId,
    targetType: "report",
    targetId: reportId,
    metadata: { status, durability: getGovernanceDurability() },
  })
  return updated
}

export function buildAdminHealthAnalytics(input: {
  communityId: string
  lifecycle: CommunityLifecycleState
  memberCount: number
  boardPosts?: Array<{ id: string; comments?: number; replies?: unknown[]; createdAt?: number; hidden?: boolean }>
  events?: Array<{ startsAt?: number; startAt?: number; date?: number }>
  resourceCount?: number
}): import("@/lib/domains/contracts/community-governance").CommunityAdminHealthAnalytics {
  const snap = buildHealthSnapshot({
    communityId: input.communityId,
    lifecycle: input.lifecycle,
    memberCount: input.memberCount,
    boardPosts: input.boardPosts,
    events: input.events,
  })
  const posts = (input.boardPosts || []).filter((p) => !p.hidden)
  const unansweredRatio =
    posts.length > 0 ? snap.unansweredDiscussionCount / posts.length : 0
  let daysSinceLastActivity: number | null = null
  if (snap.lastActivityAt) {
    daysSinceLastActivity = Math.floor((Date.now() - snap.lastActivityAt) / (24 * 60 * 60 * 1000))
  }

  // Informational engagement score (0–100) — NOT a reputation or GHC signal
  let engagementScore = 40
  if (input.memberCount >= 5) engagementScore += 10
  if (input.memberCount >= 20) engagementScore += 5
  if (posts.length >= 3) engagementScore += 15
  if (posts.length >= 10) engagementScore += 10
  if (unansweredRatio < 0.3) engagementScore += 10
  if (unansweredRatio > 0.7 && posts.length > 2) engagementScore -= 15
  if (snap.upcomingEventCount > 0) engagementScore += 10
  if ((input.resourceCount || 0) > 0) engagementScore += 5
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) engagementScore -= 20
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 30) engagementScore -= 15
  if (snap.openReportCount > 0) engagementScore -= 10
  engagementScore = Math.max(0, Math.min(100, engagementScore))

  let grade: import("@/lib/domains/contracts/community-governance").CommunityHealthGrade = "healthy"
  const recommendations: string[] = []

  if (input.lifecycle === "archived") {
    grade = "archived"
  } else if (snap.openReportCount >= 3 || (daysSinceLastActivity !== null && daysSinceLastActivity > 45)) {
    grade = "at_risk"
    if (snap.openReportCount >= 3) recommendations.push("Review open safety reports")
    if (daysSinceLastActivity !== null && daysSinceLastActivity > 45) {
      recommendations.push("Consider marking Quiet or Archiving if the community is inactive")
    }
  } else if (
    (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    input.lifecycle === "quiet" ||
    (posts.length === 0 && input.memberCount < 3)
  ) {
    grade = "quiet"
    recommendations.push("Share an event or discussion prompt to re-engage members")
  } else if (unansweredRatio > 0.5 && posts.length >= 3) {
    grade = "needs_attention"
    recommendations.push("Reply to unanswered discussions or pin a FAQ resource")
  } else {
    grade = "healthy"
  }

  if (snap.upcomingEventCount === 0 && grade === "healthy") {
    recommendations.push("Schedule an event to deepen participation")
  }
  if ((input.resourceCount || 0) === 0) {
    recommendations.push("Pin a starter guide or FAQ in the knowledge hub")
  }

  const gradeLabel: Record<string, string> = {
    healthy: "Healthy",
    needs_attention: "Needs attention",
    quiet: "Quiet",
    at_risk: "At risk",
    archived: "Archived",
  }

  return {
    communityId: input.communityId,
    grade,
    gradeLabel: gradeLabel[grade] || grade,
    memberCount: input.memberCount,
    discussionCount: snap.discussionCount,
    unansweredCount: snap.unansweredDiscussionCount,
    unansweredRatio: Math.round(unansweredRatio * 100) / 100,
    upcomingEventCount: snap.upcomingEventCount,
    resourceCount: input.resourceCount || 0,
    openReportCount: snap.openReportCount,
    moderationActionsLast7d: snap.moderationActionsLast7d,
    daysSinceLastActivity,
    engagementScore,
    recommendations: recommendations.slice(0, 4),
    signals: snap.signals,
    generatedAt: Date.now(),
  }
}



export interface LifecycleSuggestion {
  current: CommunityLifecycleState
  suggested: CommunityLifecycleState | null
  reason: string
  /** Never auto-applied — requires human confirmation */
  autoApply: false
  severity: "info" | "warning"
}

/**
 * Heuristic lifecycle suggestion from health signals.
 * NEVER mutates state — UI must call transitionLifecycle after confirm.
 */
export function suggestLifecycleTransition(input: {
  lifecycle: CommunityLifecycleState
  daysSinceLastActivity: number | null
  memberCount: number
  discussionCount: number
  openReportCount: number
  grade?: string
}): LifecycleSuggestion {
  const current = input.lifecycle
  const days = input.daysSinceLastActivity

  if (current === "archived") {
    return {
      current,
      suggested: null,
      reason: "Archived until an owner restores them (see suggestRestoreFromArchived).",
      autoApply: false,
      severity: "info",
    }
  }

  if (current === "draft") {
    return {
      current,
      suggested: "discoverable",
      reason: "Publish when the purpose, rules, and cover are ready.",
      autoApply: false,
      severity: "info",
    }
  }

  // At-risk inactivity → suggest archive (human confirm)
  if (
    days !== null &&
    days >= 60 &&
    input.discussionCount === 0 &&
    current !== "archived"
  ) {
    return {
      current,
      suggested: "archived",
      reason: "No discussion activity for 60+ days. Archiving preserves history and removes the community from discovery.",
      autoApply: false,
      severity: "warning",
    }
  }

  // Quiet: 14–59 days low activity
  if (
    days !== null &&
    days >= 14 &&
    current === "active"
  ) {
    return {
      current,
      suggested: "quiet",
      reason: `Last activity ${days} days ago. Marking Quiet signals lower activity without deleting the community.`,
      autoApply: false,
      severity: "info",
    }
  }

  // Re-activate quiet communities that became active again
  if (current === "quiet" && days !== null && days <= 3 && input.discussionCount > 0) {
    return {
      current,
      suggested: "active",
      reason: "Recent activity detected. You can mark the community Active again.",
      autoApply: false,
      severity: "info",
    }
  }

  // Discoverable → active when membership grows
  if (current === "discoverable" && input.memberCount >= 5 && input.discussionCount >= 2) {
    return {
      current,
      suggested: "active",
      reason: "Enough members and discussions to mark as Active.",
      autoApply: false,
      severity: "info",
    }
  }

  return {
    current,
    suggested: null,
    reason: "No lifecycle change suggested.",
    autoApply: false,
    severity: "info",
  }
}

export function resolveLifecycle(
  raw: string | undefined | null,
  fallback: CommunityLifecycleState = "active"
): CommunityLifecycleState {
  const v = String(raw || "").toLowerCase()
  if (v === "draft" || v === "discoverable" || v === "active" || v === "quiet" || v === "archived") {
    return v
  }
  return fallback
}

export { canTransitionLifecycle, isDiscoverableLifecycle, lifecycleLabel }
export type { CommunityRole }


/** Owner/admin explicit restore from archived → active (or discoverable). */
export function suggestRestoreFromArchived(input: {
  current: CommunityLifecycleState
  hasOwnerApproval: boolean
}): { allowed: boolean; suggested: CommunityLifecycleState | null; reason: string } {
  if (input.current !== "archived") {
    return { allowed: false, suggested: null, reason: "Community is not archived." }
  }
  if (!input.hasOwnerApproval) {
    return {
      allowed: false,
      suggested: null,
      reason: "Only an owner or admin can restore an archived community.",
    }
  }
  return {
    allowed: true,
    suggested: "active",
    reason: "Restore re-opens participation. Prefer active for previously live communities.",
  }
}
