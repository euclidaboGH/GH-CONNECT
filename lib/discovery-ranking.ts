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
export function scoreDiscoveryCandidate(
  candidate: Candidate,
  ctx: DiscoveryRankContext,
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const shared = sharedInterestCount(ctx.interests, candidate.interests)
  if (shared.length) {
    score += Math.min(shared.length * 12, 36)
    reasons.push(
      shared.length === 1 ? `Shared interest: ${shared[0]}` : `${shared.length} shared interests`,
    )
  }

  const following = new Set((ctx.followingIds || []).map(normalizeId))
  const friends = new Set((ctx.friendIds || []).map(normalizeId))
  // Soft mutual proxy: candidate also followed by people you follow is not available offline;
  // treat existing follow relationship as lower priority for "new discovery"
  const id = normalizeId(candidate.id)
  if (friends.has(id)) {
    score -= 20 // already connected — should usually be filtered, but deprioritize
  } else if (following.has(id)) {
    score -= 8
  }

  const loc = normalizeText(`${candidate.location || ""} ${candidate.city || ""} ${candidate.country || ""}`)
  if (ctx.city && loc.includes(normalizeText(ctx.city))) {
    score += 10
    reasons.push("Same city")
  } else if (ctx.country && loc.includes(normalizeText(ctx.country))) {
    score += 5
    reasons.push("Same country")
  }

  if (ctx.profession && normalizeText(candidate.profession) === normalizeText(ctx.profession)) {
    score += 8
    reasons.push("Similar profession")
  }

  if (ctx.education && normalizeText(candidate.education) === normalizeText(ctx.education)) {
    score += 4
    reasons.push("Similar education")
  }

  if (candidate.online || candidate.isOnline) {
    score += 6
    reasons.push("Active now")
  } else {
    const last = timestampOf(candidate.lastActiveAt)
    const ageMs = last === null ? null : Date.now() - last
    if (ageMs !== null && ageMs >= 0 && ageMs < 7 * 86400000) {
      score += 3
      reasons.push("Active this week")
    }
  }

  if (candidate.verified || candidate.isVerified) {
    score += 3
    reasons.push("Verified")
  }

  // Intent / connection mode soft boost (user-selected preference)
  const mode = (ctx.connectionMode || "all").toLowerCase()
  const goals = [
    ...(candidate.relationshipGoals || []),
    candidate.primaryMode,
    candidate.relationshipType,
  ]
    .flat()
    .filter(Boolean)
    .map((g) => normalizeText(g))

  if (mode && mode !== "all") {
    const modeHints: Record<string, string[]> = {
      friends: ["friend", "friendship", "social"],
      professional: ["professional", "work", "career", "networking"],
      collaborate: ["collaborate", "collaboration", "project"],
      mentor: ["mentor", "mentorship", "coaching"],
      learn: ["learn", "learning", "education"],
      dating: ["dating", "relationship", "romance"],
    }
    const hints = modeHints[mode] || [mode]
    if (goals.some((g) => hints.some((h) => g.includes(h)))) {
      score += 14
      reasons.push("Matches your intent")
    } else {
      score += 1 // soft — don't hard-exclude unless filters say so
    }
  }

  // Slight diversity: profiles with a photo rank a bit higher for UX quality
  if (candidate.photo && !String(candidate.photo).includes("placeholder")) {
    score += 2
  }

  return { score, reasons: reasons.slice(0, 4) }
}

/**
 * Filter + rank discovery candidates. Highest score first.
 * Does not mutate input.
 */
export function rankDiscoveryCandidates(
  candidates: Candidate[] | null | undefined,
  ctx: DiscoveryRankContext,
): RankedCandidate[] {
  const pool = filterDiscoveryPool(candidates, ctx)
  const ranked: RankedCandidate[] = pool.map((c) => {
    const { score, reasons } = scoreDiscoveryCandidate(c, ctx)
    return { ...c, _discoveryScore: score, _discoveryReasons: reasons }
  })
  ranked.sort((a, b) => (b._discoveryScore || 0) - (a._discoveryScore || 0) || normalizeId(a.id).localeCompare(normalizeId(b.id)))
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
