/**
 * Reward Level + XP — separate from Membership (FREE / VIP / VVIP).
 *
 * Membership = subscription entitlements (pay / trial).
 * Reward Level = activity contribution (earn XP; not pay-to-win).
 *
 * A user can be FREE + Gold, or VVIP + Bronze. Both axes are visible in UI.
 * GHC rewards still go through economy ledger + anti-abuse; XP is progression only.
 */

export type RewardLevelId = "bronze" | "silver" | "gold" | "platinum" | "diamond"

export interface RewardLevelPlan {
  id: RewardLevelId
  label: string
  /** Inclusive min XP to hold this level */
  minXp: number
  /** Exclusive max (next level min); Infinity for top */
  maxXp: number
  color: string
  /** Soft presentation multiplier for display (economy still enforces caps) */
  displayMultiplierHint: number
  perks: string[]
}

export const REWARD_LEVELS: RewardLevelPlan[] = [
  {
    id: "bronze",
    label: "Bronze",
    minXp: 0,
    maxXp: 500,
    color: "#b45309",
    displayMultiplierHint: 1,
    perks: ["Daily login track", "Standard missions", "Community access"],
  },
  {
    id: "silver",
    label: "Silver",
    minXp: 500,
    maxXp: 2_000,
    color: "#64748b",
    displayMultiplierHint: 1.05,
    perks: ["+5% mission XP", "Silver profile accent", "Weekly recap"],
  },
  {
    id: "gold",
    label: "Gold",
    minXp: 2_000,
    maxXp: 6_000,
    color: "#ca8a04",
    displayMultiplierHint: 1.1,
    perks: ["+10% mission XP", "Gold badge accent", "Bonus mission slots"],
  },
  {
    id: "platinum",
    label: "Platinum",
    minXp: 6_000,
    maxXp: 15_000,
    color: "#0e7490",
    displayMultiplierHint: 1.15,
    perks: ["+15% mission XP", "Featured contributor cues", "Priority challenge access"],
  },
  {
    id: "diamond",
    label: "Diamond",
    minXp: 15_000,
    maxXp: Number.POSITIVE_INFINITY,
    color: "#7c3aed",
    displayMultiplierHint: 1.2,
    perks: ["+20% mission XP", "Diamond identity mark", "Elite mission track"],
  },
]

/** XP awards for legitimate activity — not purchasable */
export const XP_AWARDS = {
  daily_login: 10,
  profile_complete: 100,
  meaningful_interaction: 5,
  daily_mission: 25,
  weekly_activity: 100,
  successful_referral: 150,
  marketplace_activity: 20,
  community_contribution: 25,
  verified_contribution: 50,
  achievement_small: 100,
  achievement_large: 500,
} as const

export type XpAwardKey = keyof typeof XP_AWARDS

export interface DailyStreakState {
  /** Consecutive calendar days claimed */
  streakDays: number
  /** Last claim day key YYYY-MM-DD (Africa/Lagos reward day) */
  lastClaimDayKey: string | null
  /** GHC amounts by day index 1..7 (resets after day 7 chest) */
  cycleDay: number
  /** Remaining streak shields this calendar month (VIP/VVIP) */
  shieldsRemaining?: number
  /** YYYY-MM of last shield refill */
  shieldsMonthKey?: string | null
}

/** Base FREE track — VIP/VVIP use enhanced tracks (not raw × multipliers) */
export const DAILY_STREAK_GHC: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 40,
  7: 100,
}

/** Membership-aware tracks — progressive value, not unlimited inflation */
export const DAILY_STREAK_TRACKS: Record<"free" | "vip" | "vvip", Record<number, number>> = {
  free: { 1: 10, 2: 15, 3: 20, 4: 25, 5: 30, 6: 40, 7: 100 },
  vip: { 1: 12, 2: 18, 3: 24, 4: 30, 5: 36, 6: 48, 7: 120 },
  vvip: { 1: 15, 2: 22, 3: 30, 4: 38, 5: 45, 6: 60, 7: 150 },
}

const XP_STORAGE = "ghc_reward_xp_v1"
const STREAK_STORAGE = "ghc_daily_streak_v1"
const DISMISS_STORAGE = "ghc_daily_reward_dismiss_v1"

/** Reward day boundary: 00:00 Africa/Lagos (prevents device-clock farming when server-backed later) */
export function lagosDayKey(d = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    // en-CA → YYYY-MM-DD
    return fmt.format(d)
  } catch {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
}

function dayKey(d = new Date()): string {
  return lagosDayKey(d)
}

function lagosMonthKey(d = new Date()): string {
  return lagosDayKey(d).slice(0, 7)
}

function lagosYesterdayKey(d = new Date()): string {
  // Step back ~26h then re-key in Lagos to avoid DST edge cases
  const prev = new Date(d.getTime() - 26 * 60 * 60 * 1000)
  const today = lagosDayKey(d)
  // Walk backward until key changes
  for (let i = 1; i <= 48; i++) {
    const candidate = new Date(d.getTime() - i * 60 * 60 * 1000)
    const k = lagosDayKey(candidate)
    if (k !== today) return k
  }
  return lagosDayKey(prev)
}

export type MembershipTierForTrack = "free" | "vip" | "vvip"

export function normalizeTier(tier?: string | null): MembershipTierForTrack {
  const t = String(tier || "free").toLowerCase()
  if (t === "vvip") return "vvip"
  if (t === "vip") return "vip"
  return "free"
}

export function trackForTier(tier?: string | null): Record<number, number> {
  return DAILY_STREAK_TRACKS[normalizeTier(tier)] || DAILY_STREAK_TRACKS.free
}

export function ghcForCycleDay(cycleDay: number, tier?: string | null): number {
  const track = trackForTier(tier)
  const d = Math.min(7, Math.max(1, cycleDay | 0))
  return track[d] ?? DAILY_STREAK_GHC[d] ?? 10
}

/** Monthly streak shields: VIP 1, VVIP 2, Free 0 */
export function monthlyShieldQuota(tier?: string | null): number {
  const t = normalizeTier(tier)
  if (t === "vvip") return 2
  if (t === "vip") return 1
  return 0
}

export function wasDailyRewardDismissed(userId: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false
    const raw = localStorage.getItem(DISMISS_STORAGE)
    if (!raw) return false
    const all = JSON.parse(raw) as Record<string, string>
    return all[userId] === lagosDayKey()
  } catch {
    return false
  }
}

export function markDailyRewardDismissed(userId: string) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(DISMISS_STORAGE)
    const all = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    all[userId] = lagosDayKey()
    localStorage.setItem(DISMISS_STORAGE, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function clearDailyRewardDismissed(userId: string) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(DISMISS_STORAGE)
    if (!raw) return
    const all = JSON.parse(raw) as Record<string, string>
    delete all[userId]
    localStorage.setItem(DISMISS_STORAGE, JSON.stringify(all))
  } catch {
    /* */
  }
}

function readXp(userId: string): number {
  try {
    if (typeof localStorage === "undefined") return 0
    const raw = localStorage.getItem(XP_STORAGE)
    if (!raw) return 0
    const all = JSON.parse(raw) as Record<string, number>
    const v = all[userId]
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0
  } catch {
    return 0
  }
}

function writeXp(userId: string, xp: number) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(XP_STORAGE)
    const all = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    all[userId] = Math.max(0, Math.floor(xp))
    localStorage.setItem(XP_STORAGE, JSON.stringify(all))
  } catch {
    /* */
  }
}

function readStreak(userId: string): DailyStreakState {
  try {
    if (typeof localStorage === "undefined") {
      return { streakDays: 0, lastClaimDayKey: null, cycleDay: 0, shieldsRemaining: 0, shieldsMonthKey: null }
    }
    const raw = localStorage.getItem(STREAK_STORAGE)
    if (!raw) return { streakDays: 0, lastClaimDayKey: null, cycleDay: 0, shieldsRemaining: 0, shieldsMonthKey: null }
    const all = JSON.parse(raw) as Record<string, DailyStreakState>
    const s = all[userId]
    if (!s) return { streakDays: 0, lastClaimDayKey: null, cycleDay: 0, shieldsRemaining: 0, shieldsMonthKey: null }
    return {
      streakDays: Math.max(0, s.streakDays | 0),
      lastClaimDayKey: s.lastClaimDayKey || null,
      cycleDay: Math.min(7, Math.max(0, s.cycleDay | 0)),
      shieldsRemaining: typeof s.shieldsRemaining === "number" ? Math.max(0, s.shieldsRemaining) : 0,
      shieldsMonthKey: s.shieldsMonthKey || null,
    }
  } catch {
    return { streakDays: 0, lastClaimDayKey: null, cycleDay: 0, shieldsRemaining: 0, shieldsMonthKey: null }
  }
}

function writeStreak(userId: string, state: DailyStreakState) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STREAK_STORAGE)
    const all = raw ? (JSON.parse(raw) as Record<string, DailyStreakState>) : {}
    all[userId] = state
    localStorage.setItem(STREAK_STORAGE, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function levelFromXp(xp: number): RewardLevelPlan {
  const n = Math.max(0, xp)
  for (let i = REWARD_LEVELS.length - 1; i >= 0; i--) {
    if (n >= REWARD_LEVELS[i].minXp) return REWARD_LEVELS[i]
  }
  return REWARD_LEVELS[0]
}

export function xpProgress(xp: number): {
  level: RewardLevelPlan
  current: number
  nextAt: number | null
  pct: number
} {
  const level = levelFromXp(xp)
  const next = REWARD_LEVELS.find((l) => l.minXp > level.minXp)
  if (!next || !Number.isFinite(level.maxXp)) {
    return { level, current: xp, nextAt: null, pct: 100 }
  }
  const span = next.minXp - level.minXp
  const into = xp - level.minXp
  const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100
  return { level, current: xp, nextAt: next.minXp, pct }
}

export function getUserXp(userId: string): number {
  return readXp(userId)
}

export function awardXp(
  userId: string,
  key: XpAwardKey,
  opts?: { times?: number }
): { ok: true; awarded: number; total: number; level: RewardLevelPlan } {
  const times = Math.max(1, opts?.times ?? 1)
  const unit = XP_AWARDS[key] ?? 0
  const awarded = unit * times
  const total = readXp(userId) + awarded
  writeXp(userId, total)
  return { ok: true, awarded, total, level: levelFromXp(total) }
}

function ensureShields(userId: string, tier?: string | null): DailyStreakState {
  const s = readStreak(userId)
  const mk = lagosMonthKey()
  const quota = monthlyShieldQuota(tier)
  if (s.shieldsMonthKey === mk && typeof s.shieldsRemaining === "number") {
    return s
  }
  const next: DailyStreakState = {
    ...s,
    shieldsRemaining: quota,
    shieldsMonthKey: mk,
  }
  writeStreak(userId, next)
  return next
}

export function getDailyStreak(
  userId: string,
  membershipTier?: string | null
): DailyStreakState & {
  canClaimToday: boolean
  todayGhc: number
  nextDayPreview: number
  displayCycleDay: number
  rewardDayKey: string
  shieldsRemaining: number
  usedShield?: boolean
} {
  const s = ensureShields(userId, membershipTier)
  const today = dayKey()
  const canClaimToday = s.lastClaimDayKey !== today
  const nextCycle = s.cycleDay >= 7 || s.cycleDay <= 0 ? 1 : s.cycleDay + 1
  const displayCycleDay = canClaimToday ? nextCycle : s.cycleDay || 1
  const todayGhc = canClaimToday ? ghcForCycleDay(nextCycle, membershipTier) : 0
  const previewDay = canClaimToday ? (nextCycle >= 7 ? 1 : nextCycle + 1) : nextCycle
  return {
    ...s,
    canClaimToday,
    todayGhc,
    nextDayPreview: ghcForCycleDay(previewDay, membershipTier),
    displayCycleDay,
    rewardDayKey: today,
    shieldsRemaining: s.shieldsRemaining ?? 0,
  }
}

/**
 * Claim daily streak — returns GHC amount to credit via economy (caller must ledger).
 * Uses Africa/Lagos reward day. Optional membershipTier selects the enhanced track.
 * Missed-day continuity may consume a streak shield (VIP/VVIP) instead of resetting.
 */
export function claimDailyStreak(
  userId: string,
  membershipTier?: string | null
): {
  ok: boolean
  ghc: number
  xp: number
  streakDays: number
  cycleDay: number
  usedShield?: boolean
  error?: string
} {
  const s = ensureShields(userId, membershipTier)
  const today = dayKey()
  if (s.lastClaimDayKey === today) {
    return {
      ok: false,
      ghc: 0,
      xp: 0,
      streakDays: s.streakDays,
      cycleDay: s.cycleDay,
      error: "Already claimed today",
    }
  }

  const yesterday = lagosYesterdayKey()
  let streakDays = 1
  let cycleDay = 1
  let usedShield = false
  let shieldsRemaining = s.shieldsRemaining ?? 0

  if (s.lastClaimDayKey) {
    if (s.lastClaimDayKey === yesterday) {
      streakDays = s.streakDays + 1
      cycleDay = s.cycleDay >= 7 ? 1 : s.cycleDay + 1
    } else if (shieldsRemaining > 0) {
      // Missed day(s) but shield protects continuity once
      usedShield = true
      shieldsRemaining -= 1
      streakDays = s.streakDays + 1
      cycleDay = s.cycleDay >= 7 ? 1 : s.cycleDay + 1
    }
  }

  const ghc = ghcForCycleDay(cycleDay, membershipTier)
  writeStreak(userId, {
    streakDays,
    lastClaimDayKey: today,
    cycleDay,
    shieldsRemaining,
    shieldsMonthKey: s.shieldsMonthKey || lagosMonthKey(),
  })
  clearDailyRewardDismissed(userId)
  const xpResult = awardXp(userId, "daily_login")

  return {
    ok: true,
    ghc,
    xp: xpResult.awarded,
    streakDays,
    cycleDay,
    usedShield,
  }
}

export function describeDualStatus(
  membershipTier: string,
  xp: number
): string {
  const level = levelFromXp(xp)
  return `${membershipTier.toUpperCase()} · ${level.label} Reward Level`
}
