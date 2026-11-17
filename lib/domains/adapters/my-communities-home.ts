/**
 * Authoritative "My Communities" for Home — from membership state on conversation rows.
 * Never uses localStorage as authority.
 */

import {
  toCommunitySummary,
  type CommunityRowLike,
} from "@/lib/domains/adapters/community-membership-adapter"
import type { CommunitySummary } from "@/lib/domains/contracts/communities"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export function listMyCommunitiesForHome(
  rows: CommunityRowLike[],
  viewerId: string,
  opts?: { blockedUserIds?: string[]; limit?: number }
): CommunitySummary[] {
  if (!viewerId) return []
  const limit = opts?.limit ?? 6
  const out: CommunitySummary[] = []
  for (const row of rows || []) {
    if (out.length >= limit) break
    if (!isDemoDataAllowed() && String(row.id).startsWith("demo-")) continue
    const summary = toCommunitySummary(row, viewerId, {
      blockedUserIds: opts?.blockedUserIds,
    })
    if (!summary?.isMember) continue
    out.push(summary)
  }
  return out
}
