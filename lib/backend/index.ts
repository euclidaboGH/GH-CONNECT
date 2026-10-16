/**
 * Backend facade — client adapters for moderation, matching, messaging, feed, profile.
 *
 * Compatibility: domain mutations remain authoritative via `@/lib/domains`.
 * This facade is for service-shaped APIs (getBackend) used by older callers.
 * Prefer domain services + repositories for new writes. HTTP repos:
 * use `@/lib/domains/http-repositories` (or the thin wrappers in `./http-repositories`).
 */

import {
  createFeedService,
  createMatchingService,
  createMessagingService,
  createModerationService,
  createProfileService,
} from "./client-services"
import type {
  FeedService,
  MatchingService,
  MessagingService,
  ModerationService,
  ProfileService,
} from "./types"

export * from "./types"

export type BackendServices = {
  moderation: ModerationService
  matching: MatchingService
  messaging: MessagingService
  profile: ProfileService
  feed: FeedService
}

let singleton: BackendServices | null = null

/** Returns shared backend services (client adapters by default). */
export function getBackend(): BackendServices {
  if (!singleton) {
    singleton = {
      moderation: createModerationService(),
      matching: createMatchingService(),
      messaging: createMessagingService(),
      profile: createProfileService(),
      feed: createFeedService(),
    }
  }
  return singleton
}

/** Test / future remote API: replace adapters without touching UI. */
export function setBackend(services: Partial<BackendServices>) {
  singleton = { ...getBackend(), ...services }
}
