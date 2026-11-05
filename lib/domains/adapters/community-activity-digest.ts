/**
 * Non-financial community activity digest — view model over existing objects.
 * No GHC, no rewards, no fabricated counts.
 */

import { buildCommunityFeed, type CommunityFeedItem, type CommunityFeedSources } from "./community-feed"

export interface CommunityActivityDigest {
  communityId: string
  communityName?: string
  generatedAt: number
  discussionCount: number
  announcementCount: number
  upcomingEventCount: number
  activityCount: number
  resourceCount: number
  recentItems: CommunityFeedItem[]
  summaryLines: string[]
}

export function buildCommunityActivityDigest(
  sources: CommunityFeedSources & { communityName?: string; now?: number }
): CommunityActivityDigest {
  const now = sources.now ?? Date.now()
  const feed = buildCommunityFeed(sources).filter((item) => {
    const src = item.source as { hidden?: boolean } | null
    if (src && (src as any).hidden) return false
    return true
  })

  const discussions = feed.filter((i) => i.kind === "discussion")
  const announcements = feed.filter((i) => i.kind === "announcement")
  const activities = feed.filter((i) => i.kind === "activity")
  const resources = feed.filter((i) => i.kind === "resource")

  const upcomingEventCount = (sources.events || []).filter((e) => {
    const t = Number(e.startsAt || e.startAt || e.date) || 0
    return t >= now
  }).length

  const summaryLines: string[] = []
  if (discussions.length) summaryLines.push(`${discussions.length} discussion${discussions.length === 1 ? "" : "s"}`)
  if (announcements.length) summaryLines.push(`${announcements.length} announcement${announcements.length === 1 ? "" : "s"}`)
  if (upcomingEventCount) summaryLines.push(`${upcomingEventCount} upcoming event${upcomingEventCount === 1 ? "" : "s"}`)
  if (activities.length) summaryLines.push(`${activities.length} activit${activities.length === 1 ? "y" : "ies"}`)
  if (resources.length) summaryLines.push(`${resources.length} resource${resources.length === 1 ? "" : "s"}`)

  return {
    communityId: sources.communityId,
    communityName: sources.communityName,
    generatedAt: now,
    discussionCount: discussions.length,
    announcementCount: announcements.length,
    upcomingEventCount,
    activityCount: activities.length,
    resourceCount: resources.length,
    recentItems: feed.slice(0, 8),
    summaryLines,
  }
}
