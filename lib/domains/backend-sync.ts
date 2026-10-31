/**
 * Backend sync helpers — hydrate authoritative data into session cache.
 * Call after auth when API base URL is configured.
 */

import type { DomainServices } from "./create-domains"
import { resolveApiBaseUrl, flushPendingRepositoryWrites } from "./http-repositories"
import type {
  PostRepository,
  MessageRepository,
  SocialGraphRepository,
  StoryRepository,
  ConversationRepository,
  ProfileRepository,
} from "./repositories"

export type BackendSyncRepos = {
  profile?: ProfileRepository | null
  posts?: PostRepository | null
  messages?: MessageRepository | null
  conversations?: ConversationRepository | null
  stories?: StoryRepository | null
  social?: SocialGraphRepository | null
}

export async function hydrateBackendRepositories(
  repos: BackendSyncRepos
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []
  const tasks: Promise<void>[] = []

  if (repos.profile?.hydrate) {
    tasks.push(
      repos.profile.hydrate().then(() => undefined).catch((e) => {
        errors.push(`profile: ${e}`)
      })
    )
  }
  if (repos.posts?.hydrate) {
    tasks.push(
      repos.posts.hydrate().then(() => undefined).catch((e) => {
        errors.push(`posts: ${e}`)
      })
    )
  }
  if (repos.conversations?.hydrate) {
    tasks.push(
      repos.conversations.hydrate().then(() => undefined).catch((e) => {
        errors.push(`conversations: ${e}`)
      })
    )
  }
  if (repos.stories?.hydrate) {
    tasks.push(
      repos.stories.hydrate().then(() => undefined).catch((e) => {
        errors.push(`stories: ${e}`)
      })
    )
  }
  if (repos.social?.hydrate) {
    tasks.push(
      repos.social.hydrate().then(() => undefined).catch((e) => {
        errors.push(`social: ${e}`)
      })
    )
  }

  await Promise.all(tasks)
  return { ok: errors.length === 0, errors }
}

/** Flush offline write queue when connectivity returns */
export async function syncPendingBackendWrites(): Promise<number> {
  const base = resolveApiBaseUrl()
  if (!base) return 0
  return flushPendingRepositoryWrites({ baseUrl: base })
}

/**
 * Soft-bind: domains already constructed with HTTP repos when API URL present.
 * This documents which services own which backend surfaces.
 */
export function backendAuthorityMap() {
  return {
    profile: "/profile",
    social: "/social/snapshot + /social/edges",
    posts: "/posts",
    stories: "/stories",
    conversations: "/conversations",
    messages: "/conversations/:id/messages",
    reports: "/reports",
  } as const
}

export function isBackendConfigured(): boolean {
  return Boolean(resolveApiBaseUrl())
}
