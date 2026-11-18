/**
 * Global Search domain contract — people, posts, communities, GH IDs.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export type SearchResultKind = "person" | "post" | "community" | "event" | "activity" | "service" | "gh_id" | "marketplace"

export interface SearchHit {
  kind: SearchResultKind
  id: string
  title: string
  subtitle?: string
}

export interface SearchDomainContract {
  query(q: string, limit?: number): DomainResult<SearchHit[]>
  emptyState(q: string): DomainEmptyState
}

export function searchEmptyState(q: string): DomainEmptyState {
  const term = q.trim()
  return {
    title: term ? `No results for “${term}”` : "Search GreenHaven",
    description: term
      ? "Try a different name, GH ID, or community keyword."
      : "Find people, communities, and posts.",
  }
}


/** Map discovery object kind → search hit kind */
export function searchKindFromDiscoveryKind(
  kind: "person" | "community" | "event" | "activity" | "service"
): SearchResultKind {
  if (kind === "person") return "person"
  if (kind === "community") return "community"
  if (kind === "event") return "event"
  if (kind === "activity") return "activity"
  return "service"
}
