/**
 * Cross-module consistency audit — relationship + economy signals.
 * Run read-only against session + bound domains; repair at domain level only.
 */

import { getBoundDomainServices } from "./compat"
import type { DomainServices } from "./create-domains"

export type ConsistencySeverity = "ok" | "warn" | "fail"

export interface ConsistencyFinding {
  id: string
  severity: ConsistencySeverity
  module: string
  message: string
}

export interface SessionSliceForAudit {
  following?: string[]
  friends?: string[]
  friendRequests?: { fromUserId: string; toUserId: string; status?: string }[]
  matches?: { userId: string }[]
  blockedUsers?: string[]
  mutedUsers?: string[]
  restrictedUsers?: string[]
  settings?: {
    blockedUsers?: string[]
    mutedUsers?: string[]
    restrictedUsers?: string[]
  }
}

/** Block must suppress normal social edges for the same pair */
export function auditRelationshipConsistency(session: SessionSliceForAudit): ConsistencyFinding[] {
  const findings: ConsistencyFinding[] = []
  const blocked = new Set([
    ...(session.blockedUsers || []),
    ...(session.settings?.blockedUsers || []),
  ])
  const following = new Set(session.following || [])
  const friends = new Set(session.friends || [])
  const matches = new Set((session.matches || []).map((m) => m.userId))
  const muted = new Set([
    ...(session.mutedUsers || []),
    ...(session.settings?.mutedUsers || []),
  ])
  const restricted = new Set([
    ...(session.restrictedUsers || []),
    ...(session.settings?.restrictedUsers || []),
  ])

  for (const id of blocked) {
    if (following.has(id)) {
      findings.push({
        id: `block-follow-${id}`,
        severity: "fail",
        module: "graph",
        message: `Blocked user ${id} still in following — block should clear follow`,
      })
    }
    if (friends.has(id)) {
      findings.push({
        id: `block-friend-${id}`,
        severity: "fail",
        module: "graph",
        message: `Blocked user ${id} still in friends`,
      })
    }
    if (matches.has(id)) {
      findings.push({
        id: `block-match-${id}`,
        severity: "warn",
        module: "matching",
        message: `Blocked user ${id} still listed in matches (should be filtered in UI)`,
      })
    }
  }

  // Mute ≠ block
  for (const id of muted) {
    if (blocked.has(id)) {
      findings.push({
        id: `mute-block-overlap-${id}`,
        severity: "warn",
        module: "graph",
        message: `User ${id} is both muted and blocked — block alone is sufficient`,
      })
    }
  }

  // Settings dual lists should not diverge permanently
  const sBlocked = new Set(session.settings?.blockedUsers || [])
  for (const id of blocked) {
    if (session.blockedUsers?.includes(id) && session.settings?.blockedUsers && !sBlocked.has(id)) {
      findings.push({
        id: `settings-block-desync-${id}`,
        severity: "warn",
        module: "settings",
        message: `blockedUsers state has ${id} but settings.blockedUsers does not`,
      })
    }
  }

  if (!findings.length) {
    findings.push({
      id: "relationship-ok",
      severity: "ok",
      module: "graph",
      message: "No relationship consistency failures in session snapshot",
    })
  }
  return findings
}

export function auditDomainSurface(services: DomainServices | null): ConsistencyFinding[] {
  const findings: ConsistencyFinding[] = []
  if (!services) {
    return [
      {
        id: "domains-unbound",
        severity: "fail",
        module: "compat",
        message: "Domain services not bound — GHCProvider must call bindDomainServices",
      },
    ]
  }

  const required: (keyof DomainServices)[] = [
    "graph",
    "messaging",
    "feed",
    "matching",
    "profile",
    "economy",
    "membership",
    "verification",
    "reputation",
    "marketplace",
    "notifications",
  ]

  for (const key of required) {
    if (!(services as any)[key]) {
      findings.push({
        id: `missing-${String(key)}`,
        severity: "fail",
        module: "create-domains",
        message: `DomainServices missing ${String(key)}`,
      })
    }
  }

  // Graph operations required for cross-module actions
  const graphOps = [
    "toggleFollow",
    "sendFriendRequest",
    "acceptFriendRequest",
    "removeFriend",
    "applyBlock",
    "removeBlock",
    "muteUser",
    "unmuteUser",
    "restrictUser",
    "unrestrictUser",
  ]
  for (const op of graphOps) {
    if (typeof (services.graph as any)?.[op] !== "function") {
      findings.push({
        id: `graph-op-${op}`,
        severity: "fail",
        module: "graph",
        message: `graph.${op} is not a function`,
      })
    }
  }

  // Economy integrity surface
  if (typeof (services.economy as any)?.recordTransaction !== "function") {
    findings.push({
      id: "economy-record",
      severity: "fail",
      module: "economy",
      message: "economy.recordTransaction missing",
    })
  }
  if (typeof (services.economy as any)?.auditIntegrity !== "function") {
    findings.push({
      id: "economy-audit",
      severity: "warn",
      module: "economy",
      message: "economy.auditIntegrity missing — run anti-abuse patch",
    })
  }

  // Membership entitlements
  if (typeof (services.membership as any)?.hasEntitlement !== "function") {
    findings.push({
      id: "membership-entitlement",
      severity: "fail",
      module: "membership",
      message: "hasEntitlement missing — VIP/VVIP checks will diverge",
    })
  }

  if (!findings.length) {
    findings.push({
      id: "domains-ok",
      severity: "ok",
      module: "create-domains",
      message: "Required domains and graph operations present",
    })
  }
  return findings
}

export function runFullConsistencyAudit(session: SessionSliceForAudit) {
  const services = getBoundDomainServices()
  const findings = [
    ...auditDomainSurface(services),
    ...auditRelationshipConsistency(session),
  ]
  if (services?.economy && typeof (services.economy as any).auditIntegrity === "function") {
    const eco = (services.economy as any).auditIntegrity()
    if (eco && !eco.ok) {
      findings.push({
        id: "economy-integrity",
        severity: "fail",
        module: "economy",
        message: `Economy integrity fails=${eco.fails} warns=${eco.warns}`,
      })
    }
  }
  return {
    ok: findings.every((f) => f.severity !== "fail"),
    fails: findings.filter((f) => f.severity === "fail").length,
    warns: findings.filter((f) => f.severity === "warn").length,
    findings,
  }
}
