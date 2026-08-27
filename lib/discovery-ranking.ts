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

function sharedInterestCount(a: string[] | undefined, b: string[] | undefined): string[] {
  if (!a?.length || !b?.length) return []
  const set = new Set(a.map((x) => x.toLowerCase()))
  return b.filter((x) => set.has(String(x).toLowerCase()))
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

  const loc = `${candidate.location || ""} ${(candidate as any).city || ""} ${(candidate as any).country || ""}`.toLowerCase()
  if (ctx.city && loc.includes(ctx.city.toLowerCase())) {
    score += 10
    reasons.push("Same city")
  } else if (ctx.country && loc.includes(ctx.country.toLowerCase())) {
    score += 5
    reasons.push("Same country")
  }

  if (ctx.profession && (candidate as any).profession === ctx.profession) {
    score += 8
    reasons.push("Similar profession")
  }

  if (ctx.education && (candidate as any).education === ctx.education) {
    score += 4
    reasons.push("Similar education")
  }

  if (candidate.online || (candidate as any).isOnline) {
    score += 6
    reasons.push("Active now")
  } else {
    const last = Number((candidate as any).lastActiveAt || 0)
    if (last && Date.now() - last < 7 * 86400000) {
      score += 3
      reasons.push("Active this week")
    }
  }

  if (candidate.verified || (candidate as any).isVerified) {
    score += 3
    reasons.push("Verified")
  }

  // Intent / connection mode soft boost (user-selected preference)
  const mode = (ctx.connectionMode || "all").toLowerCase()
  const goals = [
    ...(((candidate as any).relationshipGoals as string[]) || []),
    (candidate as any).primaryMode,
    (candidate as any).relationshipType,
  ]
    .flat()
    .filter(Boolean)
    .map((g) => String(g).toLowerCase())

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
  ranked.sort((a, b) => (b._discoveryScore || 0) - (a._discoveryScore || 0))
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
