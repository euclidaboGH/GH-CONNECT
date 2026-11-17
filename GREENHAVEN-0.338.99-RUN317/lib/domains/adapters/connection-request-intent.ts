/**
 * Connection request intent lifecycle.
 *
 * Session graph edges already support optional `meta` on friend_request.
 * This adapter stores intent/context on that edge — same authority as the
 * existing client graph (not a parallel graph).
 *
 * Durable multi-device persistence of intent requires a future additive
 * server migration (e.g. connection_requests.intent jsonb). Until then,
 * intent is session/edge-meta only and must not be claimed as server-authoritative.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import { normalizeIntents } from "@/lib/connection-intents"
import { socialGraphStore } from "@/lib/social-graph-store"
import type { ConnectionRequestContext } from "@/lib/domains/adapters/connection-graph-adapter"

export const CONNECTION_INTENT_SERVER_MIGRATION =
  "Additive table/columns required for multi-device intent persistence (e.g. connection_requests.intents jsonb). Not applied in Prompt #38."

export interface StoredConnectionRequestIntent {
  fromUserId: string
  toUserId: string
  intents: ConnectionIntentId[]
  note?: string
  source?: ConnectionRequestContext["source"]
  createdAt: number
}

function readRequestMeta(fromUserId: string, toUserId: string): Record<string, unknown> | undefined {
  const edge = socialGraphStore
    .list()
    .find(
      (e) =>
        e.type === "friend_request" &&
        e.fromUserId === fromUserId &&
        e.toUserId === toUserId
    )
  return edge?.meta
}

/** Attach intent when sending a request (call after / with sendFriendRequest edge create) */
export function persistOutgoingRequestIntent(
  fromUserId: string,
  toUserId: string,
  ctx: ConnectionRequestContext
): StoredConnectionRequestIntent {
  const intents = normalizeIntents(ctx.intents || [])
  const meta = {
    intents,
    note: ctx.note,
    source: ctx.source || "discover",
    intentVersion: 1,
  }
  // Re-add edge with meta (store replaces same type edge)
  socialGraphStore.addEdge(fromUserId, toUserId, "friend_request", meta)
  return {
    fromUserId,
    toUserId,
    intents,
    note: ctx.note,
    source: ctx.source,
    createdAt: Date.now(),
  }
}

export function getOutgoingRequestIntent(
  fromUserId: string,
  toUserId: string
): StoredConnectionRequestIntent | null {
  const meta = readRequestMeta(fromUserId, toUserId)
  if (!meta) return null
  const intents = normalizeIntents(meta.intents)
  return {
    fromUserId,
    toUserId,
    intents,
    note: meta.note ? String(meta.note) : undefined,
    source: meta.source as ConnectionRequestContext["source"],
    createdAt: Date.now(),
  }
}

export function getIncomingRequestIntent(
  viewerUserId: string,
  fromUserId: string
): StoredConnectionRequestIntent | null {
  return getOutgoingRequestIntent(fromUserId, viewerUserId)
}

/**
 * On accept: copy request meta onto friend edge so relationship retains context.
 */
export function promoteRequestIntentToFriendship(
  userA: string,
  userB: string
): StoredConnectionRequestIntent | null {
  const meta =
    readRequestMeta(userA, userB) || readRequestMeta(userB, userA)
  if (!meta) return null
  const intents = normalizeIntents(meta.intents)
  const retained = {
    intents,
    note: meta.note,
    source: meta.source,
    connectedFromRequest: true,
    intentVersion: 1,
  }
  socialGraphStore.addEdge(userA, userB, "friend", retained)
  socialGraphStore.addEdge(userB, userA, "friend", retained)
  return {
    fromUserId: userA,
    toUserId: userB,
    intents,
    note: meta.note ? String(meta.note) : undefined,
    source: meta.source as ConnectionRequestContext["source"],
    createdAt: Date.now(),
  }
}

export function getFriendshipIntent(
  userA: string,
  userB: string
): ConnectionIntentId[] {
  const edge = socialGraphStore
    .list()
    .find(
      (e) =>
        e.type === "friend" &&
        ((e.fromUserId === userA && e.toUserId === userB) ||
          (e.fromUserId === userB && e.toUserId === userA))
    )
  return normalizeIntents(edge?.meta?.intents)
}
