/**
 * Activities / Events domain contract.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export interface ActivitySummary {
  id: string
  title: string
  startsAt?: string
  locationLabel?: string
  communityId?: string
  kind: "event" | "activity" | "meetup" | string
}

export interface ActivitiesDomainContract {
  listUpcoming(limit?: number): DomainResult<ActivitySummary[]>
  emptyState(): DomainEmptyState
}

export function activitiesEmptyState(): DomainEmptyState {
  return {
    title: "No upcoming activities",
    description: "Events and activities from your communities will show up here when scheduled.",
    primaryAction: { label: "Browse communities", tab: "communities" },
  }
}
