/**
 * Universal Search — multi-object layer over real Discovery sources.
 * Same identity normalization as Discovery (no duplicate object model).
 */

import type { SearchHit, SearchResultKind } from "@/lib/domains/contracts/search"
import { searchKindFromDiscoveryKind } from "@/lib/domains/contracts/search"
import type { DomainResult } from "@/lib/domains/contracts/types"
import type { DiscoveryCategory, DiscoveryCandidate } from "@/lib/domains/contracts/discovery"
import { isPersonCandidate } from "@/lib/domains/contracts/discovery"
import { searchDiscoveryObjects } from "@/lib/domains/adapters/multi-object-discovery"
import type { ViewerDiscoveryContext } from "@/lib/domains/adapters/discovery-adapter"
import type { RawDiscoveryCandidate } from "@/lib/domains/adapters/discovery-adapter"
import { resolveBlockedIds } from "@/lib/block-enforcement"
import {
  scoreDocument,
  isSearchVisible,
  type RankableDocument,
} from "@/lib/search/unified-search-engine"

export type UniversalSearchCategory =
  | "all"
  | "people"
  | "communities"
  | "events"
  | "activities"
  | "services"

export interface UniversalSearchResult extends SearchHit {
  kind: SearchResultKind
  imageUrl?: string | null
  explanation?: string
  actions: string[]
  category: UniversalSearchCategory
}

export interface UniversalSearchQuery {
  q: string
  category?: UniversalSearchCategory
  limit?: number
  blockedUserIds?: string[]
  mutedUserIds?: string[]
}

const CATEGORY_MAP: Record<Exclude<UniversalSearchCategory, "all">, DiscoveryCategory> = {
  people: "people",
  communities: "communities",
  events: "events",
  activities: "activities",
  services: "services",
}

function actionsFor(c: DiscoveryCandidate): string[] {
  if (isPersonCandidate(c)) return ["view_profile", "connect", "message"]
  if (c.kind === "community") return ["view", "join"]
  if (c.kind === "event") return ["view"]
  if (c.kind === "activity") return ["view"]
  if (c.kind === "service") return ["view"]
  return ["view"]
}

function toHit(c: DiscoveryCandidate): UniversalSearchResult {
  const kind = searchKindFromDiscoveryKind(
    c.kind as "person" | "community" | "event" | "activity" | "service"
  )
  const explanation = (c.reasons || [])
    .slice(0, 2)
    .map((r) => r.detail)
    .join(" · ")
  return {
    kind,
    id: c.id,
    title: c.displayName,
    subtitle: c.subtitle,
    imageUrl: isPersonCandidate(c)
      ? c.avatarUrl
      : c.kind === "community"
        ? (c as any).coverImage || null
        : undefined,
    explanation: explanation || undefined,
    actions: actionsFor(c),
    category:
      c.kind === "person"
        ? "people"
        : c.kind === "community"
          ? "communities"
          : c.kind === "event"
            ? "events"
            : c.kind === "activity"
              ? "activities"
              : "services",
  }
}

function matchesQuery(c: DiscoveryCandidate, q: string): boolean {
  if (!q) return true
  const parts = [c.displayName, c.subtitle || ""]
  if (isPersonCandidate(c)) {
    parts.push(...(c.interests || []).map(String))
  } else if (c.kind === "community") {
    const cc = c as any
    parts.push(
      String(cc.purpose || ""),
      String(cc.region || ""),
      ...((cc.tags || []) as string[]).map(String),
      String(cc.privacy || "")
    )
  } else if (c.kind === "event" || c.kind === "activity") {
    const e = c as any
    parts.push(String(e.locationLabel || ""), String(e.communityName || ""))
  }
  return parts.join(" ").toLowerCase().includes(q)
}

/**
 * Run universal search against the same sources as Discovery.
 */
export function runUniversalSearch(
  query: UniversalSearchQuery,
  viewer: ViewerDiscoveryContext,
  peopleRaw: RawDiscoveryCandidate[] = []
): DomainResult<UniversalSearchResult[]> {
  const q = (query.q || "").trim().toLowerCase()
  const limit = query.limit ?? 40
  const blocked = new Set([
    ...(query.blockedUserIds || []),
    ...(query.mutedUserIds || []),
    viewer.userId,
  ])

  const categories: Exclude<UniversalSearchCategory, "all">[] =
    !query.category || query.category === "all"
      ? ["people", "communities", "events", "activities", "services"]
      : [query.category]

  const hits: UniversalSearchResult[] = []

  for (const cat of categories) {
    const discCat = CATEGORY_MAP[cat]
    const result = searchDiscoveryObjects(
      { category: discCat, intents: viewer.intents, interests: viewer.interests, limit: limit },
      viewer,
      peopleRaw
    )
    if (!result.ok) continue
    for (const c of result.data) {
      if (c.kind === "person" && blocked.has(c.id)) continue
      if (c.kind === "community") {
        const priv = String((c as any).privacy || "public").toLowerCase()
        if (priv === "private" || priv === "invite-only" || priv === "secret") continue
        const life = String((c as any).lifecycle || "active").toLowerCase()
        if (life === "draft" || life === "archived") continue
      }
      if (!matchesQuery(c, q) && q.length > 0) {
        // Allow typo-tolerant path via unified scorer
        const doc: RankableDocument = {
          id: c.id,
          kind: c.kind === "person" ? "person" : (c.kind as RankableDocument["kind"]),
          title: c.displayName || "",
          body: c.subtitle || "",
          verified: Boolean((c as any).verified),
          visibility: c.kind === "community" ? String((c as any).privacy || "public") : "public",
          authorId: c.kind === "person" ? c.id : undefined,
        }
        if (scoreDocument(doc, q) <= 0) continue
      }
      // Privacy gate (blocks already applied; enforce visibility)
      const privacyDoc: RankableDocument = {
        id: c.id,
        kind: c.kind === "person" ? "person" : (c.kind as RankableDocument["kind"]),
        title: c.displayName || "",
        visibility: c.kind === "community" ? String((c as any).privacy || "public") : "public",
        authorId: c.kind === "person" ? c.id : undefined,
        verified: Boolean((c as any).verified),
      }
      if (
        !isSearchVisible(privacyDoc, {
          viewerId: viewer.userId || null,
          blockedIds: blocked,
        })
      ) {
        continue
      }
      const hit = toHit(c)
      // Unified relevance (typo tolerance + partial + verified boost)
      const name = (c.displayName || "").toLowerCase()
      const doc: RankableDocument = {
        id: c.id,
        kind: c.kind === "person" ? "person" : (c.kind as RankableDocument["kind"]),
        title: c.displayName || "",
        body: [c.subtitle, hit.explanation].filter(Boolean).join(" "),
        aliases: name !== (c.displayName || "").toLowerCase() ? [name] : undefined,
        verified: Boolean((c as any).verified),
      }
      let relevance = scoreDocument(doc, q)
      if (hit.explanation) relevance += 5
      if (c.kind === "community") relevance += Math.min(10, Number((c as any).memberCount || 0) * 0.1)
      if (c.kind === "event") relevance += 3
      ;(hit as any)._relevance = relevance
      hits.push(hit)
      if (hits.length >= limit * 2) break
    }
    if (hits.length >= limit) break
  }

  if (!hits.length) {
    return { ok: true, data: [], source: "empty" }
  }
  hits.sort((a, b) => Number((b as any)._relevance || 0) - Number((a as any)._relevance || 0))
  return { ok: true, data: hits.slice(0, limit).map((h) => {
    const { _relevance, ...rest } = h as UniversalSearchResult & { _relevance?: number }
    return rest as UniversalSearchResult
  }), source: "session" }
}

export function groupSearchResults(hits: UniversalSearchResult[]) {
  const groups: Record<string, UniversalSearchResult[]> = {
    people: [],
    communities: [],
    events: [],
    activities: [],
    services: [],
  }
  for (const h of hits) {
    const key = h.category in groups ? h.category : "people"
    groups[key].push(h)
  }
  return groups
}
