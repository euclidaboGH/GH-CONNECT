/**
 * GreenHaven Human Connection OS — shared domain contract primitives.
 *
 * Strangler-fig layer: new UI should prefer these contracts over ad-hoc
 * context field access. Financial domains (GHC / Pi / Membership) are NOT
 * defined here and must remain isolated.
 */

export type DomainId =
  | "identity"
  | "connections"
  | "discovery"
  | "feed"
  | "messaging"
  | "communities"
  | "activities"
  | "notifications"
  | "reputation"
  | "search"

/** Result of a domain action — never invents success when data is missing */
export type DomainResult<T> =
  | { ok: true; data: T; source: "server" | "session" | "empty" }
  | { ok: false; error: string; code?: string }

/** Honest empty state — production must never fill with seed people */
export interface DomainEmptyState {
  title: string
  description: string
  primaryAction?: { label: string; href?: string; tab?: string }
}

export interface DomainEventBase {
  id: string
  domain: DomainId
  type: string
  userId?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

/** Explainable discovery / match reason — no fake percentage scores */
export interface ExplainableReason {
  code: string
  label: string
  /** Human-readable, e.g. "You both enjoy design" */
  detail: string
}
