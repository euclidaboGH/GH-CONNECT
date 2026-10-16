/**
 * Discovery adapter — maps session candidates → DiscoveryCandidate contract.
 * Never invents people. Ranking scores stay internal (rankScore), not shown as %.
 */

import {
  buildExplainableReasons,
  discoveryEmptyState,
  type DiscoveryCandidate,
  type DiscoveryCategory,
  type DiscoveryQuery,
} from "@/lib/domains/contracts/discovery"
import type { DomainResult } from "@/lib/domains/contracts/types"
import {
  normalizeIntents,
  resolveUserIntents,
  scoreIntentMatch,
  type ConnectionIntentId,
} from "@/lib/connection-intents"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { filterStudioSeedEntities } from "@/lib/discovery-mode"

export type RawDiscoveryCandidate = Record<string, unknown> & {
  id?: string
  userId?: string
  name?: string
  displayName?: string
  bio?: string
  profession?: string
  occupation?: string
  interests?: string[]
  connectionIntents?: string[]
  primaryMode?: string
  location?: string
  city?: string
  country?: string
  avatar?: string
  photoUrl?: string
  photos?: string[]
  communities?: string[]
  communityIds?: string[]
}

export interface ViewerDiscoveryContext {
  userId: string
  interests?: string[]
  intents?: ConnectionIntentId[]
  city?: string
  country?: string
  communityIds?: string[]
}

const CATEGORY_INTENT_HINT: Partial<Record<DiscoveryCategory, ConnectionIntentId[]>> = {
  friends: ["friendship"],
  professionals: ["professional", "networking"],
  collaborators: ["collaboration"],
  mentors: ["mentorship", "learning"],
  communities: ["communities"],
  events: ["events"],
  activities: ["events", "volunteering"],
  services: ["business", "professional"],
  people: undefined,
}

export function isSeedCandidateId(id: string): boolean {
  return (
    id.startsWith("demo-") ||
    id.startsWith("seed-") ||
    id.startsWith("sample-") ||
    id === "current-user"
  )
}

/** Normalize one raw candidate; returns null if invalid or blocked in production */
export function normalizeDiscoveryCandidate(
  raw: RawDiscoveryCandidate,
  viewer: ViewerDiscoveryContext,
  category: DiscoveryCategory = "people"
): DiscoveryCandidate | null {
  const id = String(raw?.id || raw?.userId || "").trim()
  if (!id || id === viewer.userId) return null
  if (!isDemoDataAllowed() && isSeedCandidateId(id)) return null

  const interests = Array.isArray(raw.interests)
    ? raw.interests.map(String).filter(Boolean)
    : []
  const intents = resolveUserIntents(id, {
    connectionIntents: raw.connectionIntents as string[] | undefined,
    primaryMode: raw.primaryMode as string | undefined,
  })
  const viewerIntents = viewer.intents || []
  const sharedInterests = interests
    .filter((i) =>
      (viewer.interests || []).some((u) => String(u).toLowerCase() === String(i).toLowerCase())
    )
    .slice(0, 4)
  const sharedIntents = viewerIntents.filter((i) => intents.includes(i))
  const communities = Array.isArray(raw.communities)
    ? raw.communities.map(String)
    : Array.isArray(raw.communityIds)
      ? raw.communityIds.map(String)
      : []
  const sharedCommunities = communities.filter((c) =>
    (viewer.communityIds || []).some((v) => String(v).toLowerCase() === String(c).toLowerCase())
  )
  const locationLabel =
    (raw.location as string) ||
    [raw.city, raw.country].filter(Boolean).join(", ") ||
    null
  const sameLocation = Boolean(
    viewer.city &&
      (String(raw.city || "").toLowerCase() === String(viewer.city).toLowerCase() ||
        String(locationLabel || "")
          .toLowerCase()
          .includes(String(viewer.city).toLowerCase()))
  )

  const reasons = buildExplainableReasons({
    sharedInterests,
    sharedCommunities: sharedCommunities.slice(0, 2),
    sharedIntents: sharedIntents.slice(0, 3),
    sameLocation,
    collaborationHint:
      sharedIntents.includes("collaboration") || category === "collaborators"
        ? sharedInterests[0] || "a project"
        : undefined,
  })

  // Professional / mentor category soft reasons when no overlap yet
  if (reasons.length === 0) {
    if (category === "professionals" || category === "mentors") {
      reasons.push({
        code: "professional_signal",
        label: "Professional",
        detail:
          category === "mentors"
            ? "You may learn from this professional connection"
            : "You may be a useful professional connection",
      })
    } else if (locationLabel) {
      reasons.push({
        code: "location_context",
        label: "Nearby",
        detail: `Based near ${locationLabel}`,
      })
    } else if (viewerIntents.length) {
      reasons.push({
        code: "intent_align",
        label: "Goals",
        detail: `Aligned with your interest in ${viewerIntents[0]}`,
      })
    }
  }

  const intentBoost = scoreIntentMatch(viewerIntents, raw as any)
  const interestBoost = sharedInterests.length * 3
  const rankScore = intentBoost * 4 + interestBoost + (sameLocation ? 2 : 0)

  const avatar =
    (raw.avatar as string) ||
    (raw.photoUrl as string) ||
    (Array.isArray(raw.photos) ? raw.photos[0] : undefined) ||
    null

  const personKind = "person" as const
  return {
    id,
    kind: personKind,
    category,
    displayName: String(raw.displayName || raw.name || "Member"),
    subtitle: String(raw.profession || raw.occupation || raw.bio || "").slice(0, 140) || undefined,
    avatarUrl: avatar,
    locationLabel,
    interests,
    intents,
    profession: raw.profession ? String(raw.profession) : undefined,
    reasons,
    rankScore,
  }
}

export function filterByCategory(
  candidates: DiscoveryCandidate[],
  category: DiscoveryCategory
): DiscoveryCandidate[] {
  if (category === "people") return candidates
  const hints = CATEGORY_INTENT_HINT[category]
  if (!hints || !hints.length) return candidates
  return candidates.filter((c) => {
    if (c.kind !== "person") return false
    const intents = c.intents || []
    if (intents.some((i) => hints.includes(i))) return true
    if (category === "professionals" || category === "mentors") {
      const blob = `${c.subtitle || ""} ${(c.interests || []).join(" ")}`.toLowerCase()
      return /engineer|design|develop|manage|coach|mentor|business|found/.test(blob)
    }
    return false
  })
}

export function adaptDiscoveryList(
  rawList: RawDiscoveryCandidate[],
  viewer: ViewerDiscoveryContext,
  query: DiscoveryQuery
): DomainResult<DiscoveryCandidate[]> {
  const filtered = filterStudioSeedEntities(Array.isArray(rawList) ? rawList : []) as RawDiscoveryCandidate[]
  const category = query.category || "people"
  const limit = query.limit ?? 36
  const viewerIntents = query.intents?.length
    ? query.intents
    : viewer.intents || []
  const ctx: ViewerDiscoveryContext = { ...viewer, intents: viewerIntents }

  let list: DiscoveryCandidate[] = []
  for (const raw of filtered) {
    const n = normalizeDiscoveryCandidate(raw, ctx, category)
    if (n) list.push(n)
  }

  list = filterByCategory(list, category)
  list.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  list = list.slice(0, limit)

  if (!list.length) {
    return { ok: true, data: [], source: "empty" }
  }
  return { ok: true, data: list, source: "session" }
}

export function formatReasonsForUi(candidate: DiscoveryCandidate, max = 2): string {
  const reasons = candidate.reasons || []
  if (!reasons.length) return "Recommended based on your GreenHaven activity"
  return reasons
    .slice(0, max)
    .map((r) => r.detail)
    .join(" · ")
}

export { discoveryEmptyState }
