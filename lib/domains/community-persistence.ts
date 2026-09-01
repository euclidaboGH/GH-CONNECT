/**
 * Local authoritative snapshot for communities (until Supabase is primary).
 * Ensures create/join survives reload — domain conversations stay source of UI truth after hydrate.
 */

import type { Conversation } from "@/lib/ghc-types"

const STORAGE_KEY = "ghc.communities.conversations.v2"
const JOINED_KEY = "ghc.community.joinedIds"

function isCommunityRow(c: Conversation | null | undefined): boolean {
  if (!c) return false
  const any = c as Conversation & { kind?: string; communityId?: string }
  return (
    any.kind === "community" ||
    Boolean(any.communityId) ||
    c.conversationType === "group" ||
    Boolean(c.groupName)
  )
}

export function loadPersistedCommunities(): Conversation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Conversation[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c) => c && c.id && isCommunityRow(c))
  } catch {
    return []
  }
}

export function savePersistedCommunities(list: Conversation[]) {
  if (typeof window === "undefined") return
  try {
    const communities = list.filter(isCommunityRow).map((c) => ({
      ...c,
      // Cap messages in persistence — chat window loads recent only
      messages: Array.isArray(c.messages) ? c.messages.slice(-120) : [],
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(communities))
  } catch {
    /* quota */
  }
}

/** Upsert one community conversation into the persisted list */
export function persistCommunityConversation(community: Conversation) {
  if (!community?.id || !isCommunityRow(community)) return
  const prev = loadPersistedCommunities()
  const next = [community, ...prev.filter((c) => c.id !== community.id)]
  savePersistedCommunities(next)
}

export function loadJoinedIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(JOINED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveJoinedIds(ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(JOINED_KEY, JSON.stringify(Array.from(new Set(ids.filter(Boolean)))))
  } catch {
    /* */
  }
}

export function markJoined(id: string) {
  const ids = loadJoinedIds()
  if (!ids.includes(id)) saveJoinedIds([...ids, id])
}

export function markLeft(id: string) {
  saveJoinedIds(loadJoinedIds().filter((x) => x !== id))
}

/**
 * Merge live conversations with persisted community snapshots.
 * Live state wins on id collision.
 */
export function mergeCommunityConversations(
  live: Conversation[],
  persisted: Conversation[] = loadPersistedCommunities()
): Conversation[] {
  const map = new Map<string, Conversation>()
  for (const c of persisted) {
    if (c?.id) map.set(c.id, c)
  }
  for (const c of live) {
    if (c?.id && isCommunityRow(c)) map.set(c.id, c)
  }
  return Array.from(map.values())
}

export function isCommunityConversationRow(c: Conversation): boolean {
  return isCommunityRow(c)
}
