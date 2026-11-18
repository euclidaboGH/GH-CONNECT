/**
 * Human Connection OS — domain contracts entrypoint.
 * Financial domains remain under lib/server/economy and lib/domains/economy-*.
 */

export * from "./types"
export * from "./identity"
export * from "./connections"
export * from "./discovery"
export * from "./feed"
export * from "./messaging"
export * from "./communities"
export * from "./activities"
export * from "./notifications"
export * from "./reputation"
export * from "./search"

export const SOCIAL_DOMAIN_IDS = [
  "identity",
  "connections",
  "discovery",
  "feed",
  "messaging",
  "communities",
  "activities",
  "notifications",
  "reputation",
  "search",
] as const

/** Explicitly excluded from social contracts — protected financial domains */
export const PROTECTED_FINANCIAL_DOMAINS = [
  "economy",
  "wallet",
  "membership",
  "payments_pi",
  "rewards_ledger",
] as const
