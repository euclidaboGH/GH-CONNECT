/**
 * Configurable reward challenges — eligibility, window, completion rules,
 * reward amount, validation, anti-abuse. Not artificial engagement farming.
 *
 * Progress can be synced from real domain signals (profile completeness,
 * communities joined). GHC credit still goes through economy validation.
 */

export type ChallengeId = string

export type ChallengeStatus =
  | "available"
  | "in_progress"
  | "pending_validation"
  | "completed"
  | "expired"
  | "locked"

export interface RewardChallenge {
  id: ChallengeId
  title: string
  description: string
  /** Why this earns GHC — shown in UI */
  why: string
  category: "onboarding" | "community" | "social" | "marketplace" | "referral" | "achievement"
  rewardAmount: number
  startsAt: number | null
  endsAt: number | null
  maxCompletions: number
  requiresValidation: boolean
  sourceEvent?: string
  completionRule: string
  antiAbuse: {
    blockSelf: boolean
    cooldownMs: number
    oncePerUser: boolean
  }
  enabled: boolean
  /** Optional CTA route hint for UI */
  ctaHint?: "profile" | "communities" | "feed" | "marketplace" | "find"
}

export interface ChallengeProgress {
  challengeId: ChallengeId
  userId: string
  status: ChallengeStatus
  progress: number
  target: number
  completedAt?: number
  rewardTxId?: string
  note?: string
}

/** Signals used to derive live progress without rewarding spam */
export interface ChallengeContextSignals {
  profileCompletionPct: number
  communitiesJoined: number
  qualityPostsOrComments: number
  marketplaceOrdersCompleted: number
  verifiedReferrals: number
  communityActivities: number
}

export interface QualityStreak {
  /** ISO week key YYYY-Www */
  weekKey: string
  /** Count of distinct quality days this week (max 7) */
  qualityDays: number
  lastQualityDayKey: string | null
  /** Never increments for raw likes / self-interaction */
  note: string
}

export const DEFAULT_CHALLENGES: RewardChallenge[] = [
  {
    id: "challenge_profile_complete",
    title: "Complete your profile",
    description: "Add photo, bio, interests and location so others can know you.",
    why: "Rewards genuine identity setup — not empty accounts.",
    category: "onboarding",
    rewardAmount: 25,
    startsAt: null,
    endsAt: null,
    maxCompletions: 1,
    requiresValidation: false,
    sourceEvent: "ONBOARDING_COMPLETED",
    completionRule: "Profile completion reaches 100% (or onboarding finished).",
    antiAbuse: { blockSelf: true, cooldownMs: 0, oncePerUser: true },
    enabled: true,
    ctaHint: "profile",
  },
  {
    id: "challenge_join_community",
    title: "Join a community",
    description: "Become a member of a public or invited community.",
    why: "Encourages real belonging, not drive-by clicks.",
    category: "community",
    rewardAmount: 8,
    startsAt: null,
    endsAt: null,
    maxCompletions: 1,
    requiresValidation: false,
    sourceEvent: "GROUP_JOINED",
    completionRule: "Join at least one community as a member.",
    antiAbuse: { blockSelf: true, cooldownMs: 3_600_000, oncePerUser: true },
    enabled: true,
    ctaHint: "communities",
  },
  {
    id: "challenge_meaningful_contribution",
    title: "Make a meaningful contribution",
    description: "Post or comment that adds value — not spam or one-word replies.",
    why: "Quality over volume; daily caps and cooldowns apply.",
    category: "social",
    rewardAmount: 10,
    startsAt: null,
    endsAt: null,
    maxCompletions: 3,
    requiresValidation: true,
    sourceEvent: "COMMENT_CREATED",
    completionRule: "Submit a helpful post or comment that passes quality checks.",
    antiAbuse: { blockSelf: true, cooldownMs: 86_400_000, oncePerUser: false },
    enabled: true,
    ctaHint: "feed",
  },
  {
    id: "challenge_marketplace_sale",
    title: "Complete a verified marketplace transaction",
    description: "Finish an order as buyer or seller with completion status.",
    why: "Only completed orders count — not listing spam or fake carts.",
    category: "marketplace",
    rewardAmount: 20,
    startsAt: null,
    endsAt: null,
    maxCompletions: 5,
    requiresValidation: true,
    sourceEvent: "MARKETPLACE_ORDER_COMPLETED",
    completionRule: "Order status reaches completed for a real counterparty.",
    antiAbuse: { blockSelf: true, cooldownMs: 3_600_000, oncePerUser: false },
    enabled: true,
    ctaHint: "marketplace",
  },
  {
    id: "challenge_community_activity",
    title: "Participate in community activity",
    description: "Join an approved event, poll, or moderated discussion.",
    why: "Rewards participation moderators already recognize as real.",
    category: "community",
    rewardAmount: 12,
    startsAt: null,
    endsAt: null,
    maxCompletions: 3,
    requiresValidation: true,
    sourceEvent: "COMMUNITY_ACTIVITY",
    completionRule: "Attend event or vote in an active community poll.",
    antiAbuse: { blockSelf: true, cooldownMs: 86_400_000, oncePerUser: false },
    enabled: true,
    ctaHint: "communities",
  },
  {
    id: "challenge_genuine_invite",
    title: "Invite genuine users",
    description: "Refer people who complete onboarding — not fake accounts.",
    why: "Referrals only credit after verification; abuse is blocked.",
    category: "referral",
    rewardAmount: 40,
    startsAt: null,
    endsAt: null,
    maxCompletions: 10,
    requiresValidation: true,
    sourceEvent: "REFERRAL_VERIFIED",
    completionRule: "Invitee verifies and finishes onboarding.",
    antiAbuse: { blockSelf: true, cooldownMs: 86_400_000, oncePerUser: false },
    enabled: true,
    ctaHint: "find",
  },
]

const PROGRESS_KEY = "ghc_challenge_progress_v1"
const STREAK_KEY = "ghc_quality_streak_v1"

function loadProgress(userId: string): Record<string, ChallengeProgress> {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const all = JSON.parse(raw) as Record<string, Record<string, ChallengeProgress>>
    return all[userId] || {}
  } catch {
    return {}
  }
}

function saveProgress(userId: string, map: Record<string, ChallengeProgress>) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(PROGRESS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = map
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function loadStreak(userId: string): QualityStreak {
  const empty: QualityStreak = {
    weekKey: weekKey(),
    qualityDays: 0,
    lastQualityDayKey: null,
    note: "Quality days only — not likes or self-interaction",
  }
  try {
    if (typeof localStorage === "undefined") return empty
    const raw = localStorage.getItem(STREAK_KEY)
    if (!raw) return empty
    const all = JSON.parse(raw) as Record<string, QualityStreak>
    const s = all[userId]
    if (!s) return empty
    if (s.weekKey !== weekKey()) {
      return { ...empty, weekKey: weekKey() }
    }
    return s
  } catch {
    return empty
  }
}

function saveStreak(userId: string, streak: QualityStreak) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STREAK_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = streak
    localStorage.setItem(STREAK_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function isChallengeOpen(c: RewardChallenge, now = Date.now()): boolean {
  if (!c.enabled) return false
  if (c.startsAt != null && now < c.startsAt) return false
  if (c.endsAt != null && now > c.endsAt) return false
  return true
}

/** Derive 0–100 profile completion from common fields */
export function computeProfileCompletionPct(profile: Record<string, unknown> | null | undefined): number {
  if (!profile) return 0
  const checks: boolean[] = [
    !!(profile.displayName || profile.name),
    !!(Array.isArray(profile.photos) ? profile.photos.length > 0 : profile.photo),
    !!(profile.bio && String(profile.bio).trim().length >= 20),
    !!(Array.isArray(profile.interests) ? profile.interests.length >= 3 : false),
    !!(profile.location || profile.homeLocation || profile.city || profile.country),
    !!(profile.profession || profile.occupation),
    !!(profile.education || profile.school),
    !!(profile.coverPhoto || profile.cover),
  ]
  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}

function progressFromSignals(
  c: RewardChallenge,
  signals: ChallengeContextSignals
): { progress: number; target: number } {
  switch (c.id) {
    case "challenge_profile_complete":
      return { progress: Math.min(100, signals.profileCompletionPct), target: 100 }
    case "challenge_join_community":
      return { progress: Math.min(1, signals.communitiesJoined), target: 1 }
    case "challenge_meaningful_contribution":
      return {
        progress: Math.min(c.maxCompletions, signals.qualityPostsOrComments),
        target: c.maxCompletions,
      }
    case "challenge_marketplace_sale":
      return {
        progress: Math.min(c.maxCompletions, signals.marketplaceOrdersCompleted),
        target: c.maxCompletions,
      }
    case "challenge_community_activity":
      return {
        progress: Math.min(c.maxCompletions, signals.communityActivities),
        target: c.maxCompletions,
      }
    case "challenge_genuine_invite":
      return {
        progress: Math.min(c.maxCompletions, signals.verifiedReferrals),
        target: c.maxCompletions,
      }
    default:
      return { progress: 0, target: c.maxCompletions }
  }
}

export type ChallengeCard = {
  challenge: RewardChallenge
  progress: ChallengeProgress
  status: ChallengeStatus
  /** 0–100 for UI bar */
  percent: number
  nextStep: string
  recommended: boolean
}

export function createChallengeEngine(userId: string) {
  return {
    listChallenges(): RewardChallenge[] {
      return DEFAULT_CHALLENGES.filter((c) => c.enabled)
    },

    getProgress(challengeId: string): ChallengeProgress | undefined {
      return loadProgress(userId)[challengeId]
    },

    listProgress(): ChallengeProgress[] {
      return Object.values(loadProgress(userId))
    },

    getQualityStreak(): QualityStreak {
      return loadStreak(userId)
    },

    /**
     * Record a quality day for weekly streak.
     * Call only for verified quality contributions — never for likes or self-interaction.
     */
    recordQualityDay(meta?: { reason?: string }) {
      const streak = loadStreak(userId)
      const wk = weekKey()
      const day = dayKey()
      if (streak.weekKey !== wk) {
        saveStreak(userId, {
          weekKey: wk,
          qualityDays: 1,
          lastQualityDayKey: day,
          note: meta?.reason || "Quality contribution day",
        })
        return
      }
      if (streak.lastQualityDayKey === day) return
      saveStreak(userId, {
        weekKey: wk,
        qualityDays: Math.min(7, streak.qualityDays + 1),
        lastQualityDayKey: day,
        note: meta?.reason || streak.note,
      })
    },

    /**
     * Sync progress from live domain signals so bars feel real.
     * Does not credit GHC — economy engine remains authority for balances.
     */
    syncFromSignals(signals: ChallengeContextSignals, now = Date.now()) {
      const progress = loadProgress(userId)
      for (const c of DEFAULT_CHALLENGES) {
        if (!c.enabled || !isChallengeOpen(c, now)) continue
        const existing = progress[c.id]
        if (existing?.status === "completed") continue

        const derived = progressFromSignals(c, signals)
        const target = derived.target
        const nextProgress = Math.max(existing?.progress || 0, derived.progress)
        const done = nextProgress >= target

        let status: ChallengeStatus = "available"
        if (done) {
          status = c.requiresValidation ? "pending_validation" : "completed"
        } else if (nextProgress > 0) {
          status = "in_progress"
        }

        progress[c.id] = {
          challengeId: c.id,
          userId,
          status,
          progress: nextProgress,
          target,
          completedAt: done ? existing?.completedAt || now : existing?.completedAt,
          note: existing?.note,
          rewardTxId: existing?.rewardTxId,
        }
      }
      saveProgress(userId, progress)
    },

    getChallengeCards(
      signals?: ChallengeContextSignals,
      now = Date.now()
    ): ChallengeCard[] {
      if (signals) {
        this.syncFromSignals(signals, now)
      }
      const progress = loadProgress(userId)
      return DEFAULT_CHALLENGES.filter((c) => c.enabled).map((c) => {
        const derived = signals
          ? progressFromSignals(c, signals)
          : { progress: progress[c.id]?.progress || 0, target: progress[c.id]?.target || c.maxCompletions }

        const p: ChallengeProgress = progress[c.id] || {
          challengeId: c.id,
          userId,
          status: "available",
          progress: derived.progress,
          target: derived.target || c.maxCompletions,
        }

        // Prefer live derived progress when higher
        if (signals && derived.progress > p.progress) {
          p.progress = derived.progress
          p.target = derived.target
        }
        if (!p.target) p.target = c.maxCompletions

        let status: ChallengeStatus = p.status || "available"
        if (!isChallengeOpen(c, now)) status = "expired"
        else if (p.status === "completed") status = "completed"
        else if (p.status === "pending_validation") status = "pending_validation"
        else if (p.progress >= p.target && p.target > 0) {
          status = c.requiresValidation ? "pending_validation" : "completed"
        } else if (p.progress > 0) status = "in_progress"
        else status = "available"

        const percent =
          p.target > 0 ? Math.min(100, Math.round((p.progress / p.target) * 100)) : 0

        const nextStep = nextStepFor(c, status, percent)
        const recommended = isRecommended(c, signals, status)

        return {
          challenge: c,
          progress: { ...p, status },
          status,
          percent,
          nextStep,
          recommended,
        }
      })
    },

    recordEvent(sourceEvent: string, meta?: { note?: string }) {
      const progress = loadProgress(userId)
      const now = Date.now()
      for (const c of DEFAULT_CHALLENGES) {
        if (!c.enabled || !c.sourceEvent || c.sourceEvent !== sourceEvent) continue
        if (!isChallengeOpen(c, now)) continue
        const existing = progress[c.id]
        if (existing?.status === "completed" && c.antiAbuse.oncePerUser) continue
        if (
          existing?.completedAt &&
          c.antiAbuse.cooldownMs > 0 &&
          now - existing.completedAt < c.antiAbuse.cooldownMs
        ) {
          continue
        }
        const target = c.maxCompletions
        const nextProgress = Math.min(target, (existing?.progress || 0) + 1)
        const done = nextProgress >= target
        progress[c.id] = {
          challengeId: c.id,
          userId,
          status: done
            ? c.requiresValidation
              ? "pending_validation"
              : "completed"
            : "in_progress",
          progress: nextProgress,
          target,
          completedAt: done ? now : existing?.completedAt,
          note: meta?.note,
        }
      }
      saveProgress(userId, progress)

      // Quality streak: only quality-style events
      if (
        sourceEvent === "COMMENT_CREATED" ||
        sourceEvent === "POST_CREATED" ||
        sourceEvent === "COMMUNITY_ACTIVITY" ||
        sourceEvent === "ONBOARDING_COMPLETED"
      ) {
        this.recordQualityDay({ reason: sourceEvent })
      }
    },

    markCompleted(challengeId: string, rewardTxId?: string) {
      const progress = loadProgress(userId)
      const c = DEFAULT_CHALLENGES.find((x) => x.id === challengeId)
      if (!c) return
      progress[challengeId] = {
        challengeId,
        userId,
        status: "completed",
        progress: c.maxCompletions === 1 ? 100 : c.maxCompletions,
        target: c.maxCompletions === 1 && challengeId === "challenge_profile_complete" ? 100 : c.maxCompletions,
        completedAt: Date.now(),
        rewardTxId,
      }
      saveProgress(userId, progress)
    },
  }
}

function nextStepFor(
  c: RewardChallenge,
  status: ChallengeStatus,
  percent: number
): string {
  if (status === "completed") return "Credited — open Wallet for ledger"
  if (status === "pending_validation") return "Ready to validate — held until review (~24h)"
  if (status === "expired") return "Challenge window ended"
  if (status === "in_progress") {
    if (c.id === "challenge_profile_complete") {
      return `In progress · ${percent}% — finish missing profile fields`
    }
    return `In progress · ${percent}% — keep going`
  }
  // available
  switch (c.ctaHint) {
    case "profile":
      return "Start — complete your profile"
    case "communities":
      return "Start — join a community"
    case "feed":
      return "Start — share a helpful post or comment"
    case "marketplace":
      return "Start — complete a verified order"
    case "find":
      return "Start — invite someone who finishes onboarding"
    default:
      return "Available — meet the completion rule"
  }
}

function isRecommended(
  c: RewardChallenge,
  signals: ChallengeContextSignals | undefined,
  status: ChallengeStatus
): boolean {
  if (!signals) return status === "available" || status === "in_progress"
  if (status === "completed" || status === "expired") return false
  if (c.id === "challenge_profile_complete" && signals.profileCompletionPct < 100) return true
  if (c.id === "challenge_join_community" && signals.communitiesJoined < 1) return true
  if (c.id === "challenge_meaningful_contribution" && signals.profileCompletionPct >= 50) return true
  return status === "in_progress"
}

export type ChallengeEngine = ReturnType<typeof createChallengeEngine>
