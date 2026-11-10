/**
 * Find / Discovery ranking — non-sensitive, explainable signals only.
 * Scores are relative ordering aids, never shown as % compatibility guarantees.
 */

import type { Candidate } from "@/lib/ghc-types"

export type DiscoveryRankContext = {
  selfId?: string | null
  interests?: string[]
  city?: string
  country?: string
  profession?: string
  education?: string
  followingIds?: string[]
  friendIds?: string[]
  matchIds?: string[]
  blockedIds?: string[]
  mutedIds?: string[]
  processedIds?: Iterable<string>
  /** Soft intent filter: all | friends | professional | collaborate | mentor | learn | dating */
  connectionMode?: string
}

export type RankedCandidate = Candidate & {
  /** Internal only — never render this raw score as a user-facing match % */
  _discoveryScore?: number
  _discoveryReasons?: string[]
}

function normalizeId(id: unknown): string {
  return typeof id === "string" ? id.trim() : ""
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase() : ""
}

function timestampOf(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value < 100_000_000_000 ? value * 1000 : value
  if (typeof value !== "string" || !value.trim()) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 100_000_000_000 ? numeric * 1000 : numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sharedInterestCount(a: string[] | undefined, b: string[] | undefined): string[] {
  if (!a?.length || !b?.length) return []
  const set = new Set(a.map(normalizeText).filter(Boolean))
  const matched = new Map<string, string>()
  for (const value of b) {
    const normalized = normalizeText(value)
    const display = value.trim()
    if (normalized && display && set.has(normalized) && !matched.has(normalized)) matched.set(normalized, display)
  }
  return [...matched.values()]
}

/**
 * Exclude invalid / out-of-pool profiles before ranking.
 */
export function filterDiscoveryPool(
  candidates: Candidate[] | null | undefined,
  ctx: DiscoveryRankContext,
): Candidate[] {
  const selfId = normalizeId(ctx.selfId) || "current-user"
  const blocked = new Set((ctx.blockedIds || []).map(normalizeId).filter(Boolean))
  const muted = new Set((ctx.mutedIds || []).map(normalizeId).filter(Boolean))
  const processed = new Set(
    [...(ctx.processedIds || [])].map(normalizeId).filter(Boolean),
  )
  const alreadyMatched = new Set((ctx.matchIds || []).map(normalizeId).filter(Boolean))

  const list = Array.isArray(candidates) ? candidates : []
  return list.filter((c) => {
    if (!c || typeof c !== "object") return false
    const id = normalizeId(c.id)
    if (!id || id === selfId || id === "current-user") return false
    if (blocked.has(id) || muted.has(id) || processed.has(id)) return false
    // Already mutual matches still appear in Matches — de-emphasize in Find by excluding
    if (alreadyMatched.has(id)) return false
    const name = typeof c.name === "string" ? c.name.trim() : ""
    if (!name) return false
    return true
  })
}

/**
 * Score a single candidate using available public-ish signals.
 * Does not use private attributes (wallet, exact location coords, reports, etc.).
 */
type PreparedRankContext = {
  interests: Set<string>
  following: Set<string>
  friends: Set<string>
  city: string
  country: string
  profession: string
  education: string
  mode: string
  modeHints: string[]
  now: number
}

const MODE_HINTS: Record<string, string[]> = {
  friends: ["friend", "friendship", "social"],
  professional: ["professional", "work", "career", "networking"],
  collaborate: ["collaborate", "collaboration", "project"],
  mentor: ["mentor", "mentorship", "coaching"],
  learn: ["learn", "learning", "education"],
  dating: ["dating", "relationship", "romance"],
}

function prepareRankContext(ctx: DiscoveryRankContext, now = Date.now()): PreparedRankContext {
  const mode = normalizeText(ctx.connectionMode || "all")
  return {
    interests: new Set((ctx.interests || []).map(normalizeText).filter(Boolean)),
    following: new Set((ctx.followingIds || []).map(normalizeId).filter(Boolean)),
    friends: new Set((ctx.friendIds || []).map(normalizeId).filter(Boolean)),
    city: normalizeText(ctx.city),
    country: normalizeText(ctx.country),
    profession: normalizeText(ctx.profession),
    education: normalizeText(ctx.education),
    mode,
    modeHints: mode && mode !== "all" ? (MODE_HINTS[mode] || [mode]) : [],
    now,
  }
}

function scorePrepared(
  candidate: Candidate,
  ctx: PreparedRankContext,
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const id = normalizeId(candidate.id)

  if (ctx.interests.size && candidate.interests?.length) {
    const matched = new Map<string, string>()
    for (const value of candidate.interests) {
      const normalized = normalizeText(value)
      const display = typeof value === "string" ? value.trim() : ""
      if (normalized && display && ctx.interests.has(normalized) && !matched.has(normalized)) {
        matched.set(normalized, display)
      }
    }
    const shared = [...matched.values()]
    if (shared.length) {
      score += Math.min(shared.length * 12, 36)
      reasons.push(shared.length === 1 ? `Shared interest: ${shared[0]}` : `${shared.length} shared interests`)
    }
  }

  if (ctx.friends.has(id)) score -= 20
  else if (ctx.following.has(id)) score -= 8

  const loc = normalizeText(`${candidate.location || ""} ${candidate.city || ""} ${candidate.country || ""}`)
  if (ctx.city && loc.includes(ctx.city)) {
    score += 10
    reasons.push("Same city")
  } else if (ctx.country && loc.includes(ctx.country)) {
    score += 5
    reasons.push("Same country")
  }

  if (ctx.profession && normalizeText(candidate.profession) === ctx.profession) {
    score += 8
    reasons.push("Similar profession")
  }
  if (ctx.education && normalizeText(candidate.education) === ctx.education) {
    score += 4
    reasons.push("Similar education")
  }

  if (candidate.online || candidate.isOnline) {
    score += 6
    reasons.push("Active now")
  } else {
    const last = timestampOf(candidate.lastActiveAt)
    const ageMs = last === null ? null : ctx.now - last
    if (ageMs !== null && ageMs >= 0 && ageMs < 7 * 86400000) {
      score += 3
      reasons.push("Active this week")
    }
  }

  if (candidate.verified || candidate.isVerified) {
    score += 3
    reasons.push("Verified")
  }

  if (ctx.modeHints.length) {
    const goals = [
      ...(candidate.relationshipGoals || []),
      candidate.primaryMode,
      candidate.relationshipType,
    ].flat().filter(Boolean).map(normalizeText)
    if (goals.some((goal) => ctx.modeHints.some((hint) => goal.includes(hint)))) {
      score += 14
      reasons.push("Matches your intent")
    } else {
      score += 1
    }
  }

  if (candidate.photo && !String(candidate.photo).includes("placeholder")) score += 2
  return { score, reasons: reasons.slice(0, 4) }
}

/**
 * Score a single candidate. Batch ranking uses a prepared context to avoid
 * rebuilding normalized lookup sets for every candidate.
 */
export function scoreDiscoveryCandidate(
  candidate: Candidate,
  ctx: DiscoveryRankContext,
): { score: number; reasons: string[] } {
  return scorePrepared(candidate, prepareRankContext(ctx))
}

/**
 * Filter + rank discovery candidates. Highest score first.
 * Lookup indexes and the recency clock are prepared once per batch.
 * Does not mutate input and collapses duplicate candidate identities.
 */
export function rankDiscoveryCandidates(
  candidates: Candidate[] | null | undefined,
  ctx: DiscoveryRankContext,
): RankedCandidate[] {
  const pool = filterDiscoveryPool(candidates, ctx)
  const prepared = prepareRankContext(ctx)
  const seen = new Set<string>()
  const ranked: RankedCandidate[] = []
  for (const candidate of pool) {
    const id = normalizeId(candidate.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const { score, reasons } = scorePrepared(candidate, prepared)
    ranked.push({ ...candidate, _discoveryScore: score, _discoveryReasons: reasons })
  }
  ranked.sort((a, b) =>
    (b._discoveryScore || 0) - (a._discoveryScore || 0) ||
    normalizeId(a.id).localeCompare(normalizeId(b.id)),
  )
  return ranked
}

/**
 * After acting on a candidate, pick the next card in the ranked list.
 */
export function nextDiscoveryCandidate(
  ranked: RankedCandidate[],
  currentId: string | null | undefined,
): RankedCandidate | null {
  if (!ranked.length) return null
  if (!currentId) return ranked[0]
  const idx = ranked.findIndex((c) => c.id === currentId)
  if (idx < 0) return ranked[0]
  return ranked[idx + 1] || ranked[0] || null
}
