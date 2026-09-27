/**
 * Canonical reputation event catalog + point contributions.
 * Server-only authority — clients cannot redefine values.
 * No financial / reward semantics.
 */
import {
  REPUTATION_LEVELS,
  levelFromPoints,
  type ReputationLevelDef,
} from "@/lib/social-economy/reputation-levels"

export type ReputationEventType =
  | "profile_complete"
  | "first_post"
  | "community_join"
  | "marketplace_order_complete"
  | "report_resolved_helpful"
  | "manual_adjustment_credit"

/** Fixed non-negative contributions (points). */
export const REPUTATION_EVENT_POINTS: Record<ReputationEventType, number> = {
  profile_complete: 25,
  first_post: 15,
  community_join: 10,
  marketplace_order_complete: 20,
  report_resolved_helpful: 5,
  /** Reserved for privileged server tools only — never client-callable */
  manual_adjustment_credit: 0,
}

/** Client-awardable only after server proof (see verify.ts). */
export const ALLOWED_PUBLIC_EVENT_TYPES: readonly ReputationEventType[] = [
  "profile_complete",
  "first_post",
] as const

export function isReputationEventType(v: unknown): v is ReputationEventType {
  return typeof v === "string" && v in REPUTATION_EVENT_POINTS
}

export function pointsForEvent(type: ReputationEventType): number {
  return REPUTATION_EVENT_POINTS[type] ?? 0
}

export function progressTowardNext(points: number): {
  level: ReputationLevelDef
  next: ReputationLevelDef | null
  pointsToNext: number | null
  progressRatio: number
} {
  const level = levelFromPoints(points)
  const idx = REPUTATION_LEVELS.findIndex((r) => r.level === level.level)
  const next = idx >= 0 && idx < REPUTATION_LEVELS.length - 1 ? REPUTATION_LEVELS[idx + 1] : null
  if (!next) {
    return { level, next: null, pointsToNext: null, progressRatio: 1 }
  }
  const span = next.minPoints - level.minPoints
  const gained = Math.max(0, points - level.minPoints)
  const ratio = span > 0 ? Math.min(1, gained / span) : 1
  return {
    level,
    next,
    pointsToNext: Math.max(0, next.minPoints - points),
    progressRatio: ratio,
  }
}

export { REPUTATION_LEVELS, levelFromPoints }
