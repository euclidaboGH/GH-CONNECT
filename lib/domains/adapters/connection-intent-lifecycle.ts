/**
 * Connection request intent lifecycle helpers.
 * Persistence: GraphEdge.meta on friend_request → preserved on friend accept
 * (see social-graph-domain acceptFriendRequest).
 *
 * Not a second graph. Does not use process-memory as authority.
 */

import { socialGraphStore } from "@/lib/social-graph-store"
import { normalizeIntents, type ConnectionIntentId } from "@/lib/connection-intents"
import type { ConnectionRequestContext } from "./connection-graph-adapter"

export function getFriendRequestMeta(
  fromUserId: string,
  toUserId: string
): Record<string, unknown> | null {
  try {
    const edge = socialGraphStore.list().find(
      (e) =>
        e.type === "friend_request" &&
        ((e.fromUserId === fromUserId && e.toUserId === toUserId) ||
          (e.fromUserId === toUserId && e.toUserId === fromUserId))
    )
    return edge?.meta || null
  } catch {
    return null
  }
}

export function getConnectionContextBetween(
  userA: string,
  userB: string
): ConnectionRequestContext | null {
  try {
    const edges = socialGraphStore.list().filter(
      (e) =>
        (e.fromUserId === userA && e.toUserId === userB) ||
        (e.fromUserId === userB && e.toUserId === userA)
    )
    const friend = edges.find((e) => e.type === "friend")
    const request = edges.find((e) => e.type === "friend_request")
    const meta = friend?.meta || request?.meta
    if (!meta) return null
    return {
      intents: normalizeIntents(meta.intents) as ConnectionIntentId[],
      note: typeof meta.note === "string" ? meta.note : undefined,
      source: meta.source as ConnectionRequestContext["source"],
    }
  } catch {
    return null
  }
}

export function intentsFromRequestMeta(meta: Record<string, unknown> | null | undefined): ConnectionIntentId[] {
  if (!meta) return []
  return normalizeIntents(meta.intents)
}

/**
 * Server/DB migration note (not applied here):
 * When social graph is fully server-authoritative, store
 * connection_requests.intent_json + connection_edges.context_json
 * with the same shape as GraphEdge.meta.
 */
export const CONNECTION_INTENT_MIGRATION_NOTE =
  "Intent already persists on local GraphEdge.meta through send→accept. Production DB graph tables should add optional intent_json without destructive migration."
