/**
 * GreenHaven unified search scoring & privacy filters.
 * Single ranking helper for universal-search / global-search — not a second engine.
 *
 * Client uses in-memory/session sources only (no unrestricted full-table scans).
 * Server indexes remain future work when social data is DB-backed.
 */

export type SearchEntityKind =
  | "person"
  | "community"
  | "post"
  | "marketplace"
  | "service"
  | "event"
  | "professional"
  | "business"
  | "gh_id"
  | "activity"

export type LocationFilter = {
  state?: string | null
  province?: string | null
  lga?: string | null
  district?: string | null
  city?: string | null
  town?: string | null
  ward?: string | null
  area?: string | null
}

export type SearchPrivacyContext = {
  viewerId: string | null
  blockedIds: Set<string>
  mutedIds?: Set<string>
  /** Hide deleted / moderated author ids */
  deletedOrSuspendedIds?: Set<string>
}

export type RankableDocument = {
  id: string
  kind: SearchEntityKind
  title: string
  aliases?: string[]
  body?: string
  tags?: string[]
  /** Structured location labels for geo filter */
  location?: LocationFilter & { label?: string }
  verified?: boolean
  professionalCategory?: string | null
  /** public | matches | private | hidden */
  visibility?: string
  authorId?: string
  deleted?: boolean
  moderatedHidden?: boolean
}

/** Simple Damerau-Levenshtein-ish distance capped for typo tolerance */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase()
  const t = b.toLowerCase()
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  if (Math.abs(s.length - t.length) > 2) return 99
  const m = s.length
  const n = t.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
      }
    }
  }
  return dp[m][n]
}

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .trim()
    .split(/[\s,._-]+/)
    .filter((t) => t.length > 0)
}

/** Partial + typo + alias match score (0 = no match) */
export function scoreDocument(doc: RankableDocument, query: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (doc.deleted || doc.moderatedHidden) return 0

  const title = (doc.title || "").toLowerCase()
  const aliases = (doc.aliases || []).map((a) => a.toLowerCase())
  const body = (doc.body || "").toLowerCase()
  const tags = (doc.tags || []).map((t) => t.toLowerCase())
  const hay = [title, ...aliases, body, ...tags].join(" ")

  let score = 0

  if (title === q) score += 120
  else if (title.startsWith(q)) score += 70
  else if (title.includes(q)) score += 40

  for (const a of aliases) {
    if (a === q) score += 100
    else if (a.includes(q)) score += 35
  }

  // GH ID style exact
  if (doc.kind === "gh_id" && (title === q || title.replace(/^@/, "") === q.replace(/^@/, ""))) {
    score += 150
  }

  // Token partials + typo tolerance (edit distance ≤ 1 for tokens ≥ 4)
  for (const tok of tokens(q)) {
    if (hay.includes(tok)) score += 12
    if (title.includes(tok)) score += 8
    if (tok.length >= 4) {
      const words = title.split(/\s+/)
      for (const w of words) {
        if (w.length >= 3 && editDistance(tok, w) <= 1) score += 18
      }
    }
  }

  if (doc.verified) score += 8
  if (doc.kind === "person") score += 2
  if (doc.kind === "professional" || doc.kind === "business") score += 3
  if (doc.kind === "community") score += 2

  return score
}

export function passesLocationFilter(
  doc: RankableDocument,
  filter?: LocationFilter | null
): boolean {
  if (!filter) return true
  const loc = doc.location
  if (!loc) return true // no geo data → don't exclude (unknown)
  const checks: Array<[string | null | undefined, string | null | undefined]> = [
    [filter.state, loc.state || loc.province],
    [filter.province, loc.province || loc.state],
    [filter.lga, loc.lga || loc.district],
    [filter.district, loc.district || loc.lga],
    [filter.city, loc.city || loc.town],
    [filter.town, loc.town || loc.city],
    [filter.ward, loc.ward || loc.area],
    [filter.area, loc.area || loc.ward],
  ]
  for (const [want, have] of checks) {
    if (!want) continue
    if (!have) return false
    if (!have.toLowerCase().includes(want.toLowerCase())) return false
  }
  return true
}

/**
 * Privacy / block / visibility gate — never return a match solely because text matches.
 */
export function isSearchVisible(
  doc: RankableDocument,
  ctx: SearchPrivacyContext
): boolean {
  if (doc.deleted || doc.moderatedHidden) return false
  const subject = doc.authorId || (doc.kind === "person" ? doc.id : null)
  if (subject && ctx.blockedIds.has(subject)) return false
  if (subject && ctx.mutedIds?.has(subject)) return false
  if (subject && ctx.deletedOrSuspendedIds?.has(subject)) return false

  const vis = (doc.visibility || "public").toLowerCase()
  if (vis === "hidden" || vis === "private" || vis === "no-one") {
    // Only self
    return Boolean(ctx.viewerId && subject === ctx.viewerId)
  }
  if (vis === "matches-only" || vis === "matches") {
    // Without server match graph, conservative: hide from global search
    return Boolean(ctx.viewerId && subject === ctx.viewerId)
  }
  return true
}

export function rankAndFilter(
  docs: RankableDocument[],
  query: string,
  ctx: SearchPrivacyContext,
  opts?: {
    location?: LocationFilter | null
    verifiedOnly?: boolean
    professionalCategory?: string | null
    limit?: number
  }
): Array<RankableDocument & { relevance: number }> {
  const limit = opts?.limit ?? 40
  const out: Array<RankableDocument & { relevance: number }> = []
  for (const doc of docs) {
    if (!isSearchVisible(doc, ctx)) continue
    if (opts?.verifiedOnly && !doc.verified) continue
    if (
      opts?.professionalCategory &&
      doc.professionalCategory &&
      !doc.professionalCategory.toLowerCase().includes(opts.professionalCategory.toLowerCase())
    ) {
      continue
    }
    if (!passesLocationFilter(doc, opts?.location)) continue
    const relevance = scoreDocument(doc, query)
    if (relevance <= 0) continue
    out.push({ ...doc, relevance })
  }
  out.sort((a, b) => b.relevance - a.relevance)
  return out.slice(0, limit)
}
