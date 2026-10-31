/**
 * Domain migration compatibility layer.
 *
 * Purpose: let existing UI, hooks, and engines keep working while writes
 * gradually move onto createDomainServices + runMutation.
 *
 * Rules:
 * - New code should import from `@/lib/domains` (or specific domain modules).
 * - This file only provides stable adapters and type bridges — not a second
 *   source of business truth.
 * - Do not put new product logic here.
 */

import type { DomainServices, DomainStateSlice } from "./create-domains"
import { createDomainServices } from "./create-domains"
import type { MutationResult } from "./mutation-pipeline"

export type { DomainServices, DomainStateSlice, MutationResult }

/**
 * Optional session holder so non-React modules (engines, backend facades)
 * can resolve the active DomainServices without importing GHCContext.
 * GHCProvider should call bindDomainServices once after createDomainServices.
 */
let activeServices: DomainServices | null = null

export function bindDomainServices(services: DomainServices | null): void {
  activeServices = services
}

export function getBoundDomainServices(): DomainServices | null {
  return activeServices
}

/** Build services the same way the provider does — for tests and adapters. */
export function createSessionDomainServices(
  getState: () => DomainStateSlice,
  options?: Parameters<typeof createDomainServices>[1]
): DomainServices {
  return createDomainServices(getState, options)
}

/**
 * Normalize MutationResult for older call sites that expect throw-on-failure
 * or simple boolean success.
 */
export function unwrapMutation<T>(result: MutationResult<T>): T {
  if (result.ok) return result.data
  const err = new Error(result.error || result.code || "mutation_failed")
  ;(err as Error & { code?: string }).code = result.code
  throw err
}

export function mutationSucceeded(result: MutationResult<unknown>): boolean {
  return result.ok === true
}

/**
 * Legacy-friendly names → domain service keys (documentation + runtime map).
 * Used by migration tooling and backend facade wiring.
 */
export const DOMAIN_SERVICE_ALIASES = {
  user: "user",
  identity: "user",
  profile: "profile",
  digitalIdentity: "profile",
  economy: "economy",
  wallet: "economy",
  rewards: "economy",
  ghc: "economy",
  reputation: "reputation",
  achievements: "achievements",
  achievement: "achievements",
  membership: "membership",
  premium: "membership",
  vip: "membership",
  vvip: "membership",
  verification: "verification",
  marketplace: "marketplace",
  listings: "marketplace",
  seller: "marketplace",
  payment: "payment",
  payments: "payment",
  search: "search",
  universalSearch: "search",
  posts: "posts",
  post: "posts",
  feed: "feed",
  graph: "graph",
  socialGraph: "graph",
  relationships: "graph",
  messaging: "messaging",
  messages: "messaging",
  chat: "messaging",
  reports: "reports",
  moderation: "reports",
  safety: "reports",
  share: "share",
  discovery: "discovery",
  find: "discovery",
  recommendations: "discovery",
  stories: "stories",
  story: "stories",
  matching: "matching",
  matches: "matching",
  community: "community",
  communities: "community",
  groups: "community",
} as const

/** Resolve graph domain from bound services (compat for engines) */
export function getGraphDomain() {
  return getBoundDomainServices()?.graph ?? null
}

/** Resolve messaging domain from bound services */
export function getMessagingDomain() {
  return getBoundDomainServices()?.messaging ?? null
}

export function getFeedDomain() {
  return getBoundDomainServices()?.feed ?? null
}

export function getPostsDomain() {
  return getBoundDomainServices()?.posts ?? null
}

export function getStoryDomain() {
  return getBoundDomainServices()?.stories ?? null
}

export function getDiscoveryDomain() {
  const s = getBoundDomainServices()
  return s?.discovery ?? s?.find ?? null
}

export function getMatchingDomain() {
  return getBoundDomainServices()?.matching ?? null
}

export function getCommunityDomain() {
  return getBoundDomainServices()?.community ?? null
}

export function getProfileDomain() {
  return getBoundDomainServices()?.profile ?? null
}

export function getNotificationDomain() {
  return getBoundDomainServices()?.notifications ?? null
}

export type DomainServiceAlias = keyof typeof DOMAIN_SERVICE_ALIASES


export function getEconomyDomain() {
  return getBoundDomainServices()?.economy ?? null
}

export function getReputationDomain() {
  return getBoundDomainServices()?.reputation ?? null
}

export function getAchievementDomain() {
  return getBoundDomainServices()?.achievements ?? null
}

export function getMembershipDomain() {
  return getBoundDomainServices()?.membership ?? null
}

export function getVerificationDomain() {
  return getBoundDomainServices()?.verification ?? null
}

export function getMarketplaceDomain() {
  return getBoundDomainServices()?.marketplace ?? null
}

export function getPaymentDomain() {
  return getBoundDomainServices()?.payment ?? null
}

export function getSearchDomain() {
  return getBoundDomainServices()?.search ?? null
}
