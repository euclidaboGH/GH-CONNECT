/**
 * Canonical Connection Request adapter (Prompt #40).
 * All UI: Discover, Matches, Profile, Notifications, Search → here.
 *
 * Dual-path:
 * A) Migration/RPC unavailable → session social graph (existing authority)
 * B) Migration/RPC available → dual-write durable server + session
 */

import { getBoundDomainServices } from "@/lib/domains/compat"
import {
  persistOutgoingRequestIntent,
  getOutgoingRequestIntent,
} from "@/lib/domains/adapters/connection-request-intent"
import {
  normalizeConnectionState,
  type ConnectionRequestContext,
  type ConnectionUiState,
  type GraphSnapshotInput,
} from "@/lib/domains/adapters/connection-graph-adapter"
import { normalizeIntents, type ConnectionIntentId, CONNECTION_INTENT_OPTIONS } from "@/lib/connection-intents"
import { socialGraphStore } from "@/lib/social-graph-store"

export type ConnectionRequestSource =
  | "discover"
  | "match"
  | "profile"
  | "notification"
  | "search"
  | "community"
  | "introduction"

export interface SendConnectionRequestInput {
  fromUserId: string
  toUserId: string
  intents?: ConnectionIntentId[] | string[]
  note?: string
  source?: ConnectionRequestSource
  blockedUserIds?: string[]
}

export interface SendConnectionRequestResult {
  ok: boolean
  error?: string
  code?: string
  intents: ConnectionIntentId[]
  durable?: "session" | "session+server" | "server_unavailable"
  state?: ConnectionUiState
}

export interface PendingConnectionRequest {
  fromUserId: string
  toUserId: string
  direction: "incoming" | "outgoing"
  intents: ConnectionIntentId[]
  note?: string
  source?: string
  createdAt?: number
  state: "outgoing_pending" | "incoming_pending"
}

const ALLOWED_INTENT_IDS = new Set(CONNECTION_INTENT_OPTIONS.map((o) => o.id as string))

export function validateConnectionIntents(raw: unknown): {
  ok: boolean
  intents: ConnectionIntentId[]
  error?: string
} {
  if (raw == null) return { ok: true, intents: [] }
  if (!Array.isArray(raw)) return { ok: false, intents: [], error: "INTENTS_MUST_BE_ARRAY" }
  if (raw.length > 8) return { ok: false, intents: [], error: "TOO_MANY_INTENTS" }
  const intents = normalizeIntents(raw)
  if (raw.length > 0 && intents.length === 0) {
    return { ok: false, intents: [], error: "INVALID_INTENTS" }
  }
  return { ok: true, intents }
}

export function getUnifiedConnectionState(
  currentUserId: string,
  targetUserId: string,
  snap?: Partial<GraphSnapshotInput>
): ConnectionUiState {
  const base: GraphSnapshotInput = {
    currentUserId,
    friends: snap?.friends,
    following: snap?.following,
    followers: snap?.followers,
    blockedUsers: snap?.blockedUsers,
    outgoingFriendRequestIds: snap?.outgoingFriendRequestIds,
    incomingFriendRequestIds: snap?.incomingFriendRequestIds,
    matchIds: snap?.matchIds,
    declinedIds: snap?.declinedIds,
  }
  try {
    const me = currentUserId
    const out = socialGraphStore.outgoingFriendRequestIds?.(me) ?? base.outgoingFriendRequestIds
    const inc = socialGraphStore.incomingFriendRequestIds?.(me) ?? base.incomingFriendRequestIds
    return normalizeConnectionState(targetUserId, {
      ...base,
      outgoingFriendRequestIds: out,
      incomingFriendRequestIds: inc,
    })
  } catch {
    return normalizeConnectionState(targetUserId, base)
  }
}

async function postJson(url: string, body: Record<string, unknown>) {
  let authHeaders: Record<string, string> = {}
  try {
    const { IdentityService } = await import("@/lib/identity/identity-service")
    authHeaders = IdentityService.getAuthHeaders?.() || {}
  } catch {
    /* */
  }
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export async function sendUnifiedConnectionRequest(
  input: SendConnectionRequestInput
): Promise<SendConnectionRequestResult> {
  const validated = validateConnectionIntents(input.intents || [])
  if (!validated.ok) {
    return { ok: false, error: validated.error, code: validated.error, intents: [] }
  }
  const intents = validated.intents

  if (!input.fromUserId || !input.toUserId || input.fromUserId === input.toUserId) {
    return { ok: false, error: "INVALID_PAIR", code: "INVALID_PAIR", intents }
  }

  if ((input.blockedUserIds || []).includes(input.toUserId)) {
    return { ok: false, error: "TARGET_BLOCKED", code: "TARGET_BLOCKED", intents }
  }

  const stateNow = getUnifiedConnectionState(input.fromUserId, input.toUserId, {
    blockedUsers: input.blockedUserIds,
  })
  if (stateNow === "blocked") {
    return { ok: false, error: "TARGET_BLOCKED", code: "TARGET_BLOCKED", intents }
  }
  if (stateNow === "connected" || stateNow === "mutual") {
    return { ok: false, error: "ALREADY_CONNECTED", code: "ALREADY_CONNECTED", intents, state: stateNow }
  }
  if (stateNow === "outgoing_pending") {
    try {
      persistOutgoingRequestIntent(input.fromUserId, input.toUserId, {
        intents,
        note: input.note,
        source: (input.source as ConnectionRequestContext["source"]) || "discover",
      })
    } catch { /* */ }
    // Still attempt durable upsert for idempotent server truth
  }

  const ctx: ConnectionRequestContext = {
    intents,
    note: input.note,
    source: (input.source as ConnectionRequestContext["source"]) || "discover",
  }

  // Server-first: recipient only sees requests that hit durable storage.
  let durable: SendConnectionRequestResult["durable"] = "server_unavailable"
  if (typeof window !== "undefined") {
    try {
      const { res, data } = await postJson("/api/connections/request", {
        toUserId: input.toUserId,
        intents,
        note: input.note,
        source: input.source,
      })
      if (res.ok && data?.durable === true) {
        durable = "session+server"
      } else if (res.ok && data?.ok !== false && data?.durable !== true) {
        durable = "session"
        return {
          ok: false,
          error: String(data?.error || "REQUEST_NOT_DURABLE"),
          code: "REQUEST_NOT_DURABLE",
          intents,
          durable,
        }
      } else {
        return {
          ok: false,
          error: String(data?.error || "REQUEST_FAILED"),
          code: "REQUEST_FAILED",
          intents,
          durable: "server_unavailable",
        }
      }
    } catch {
      return {
        ok: false,
        error: "NETWORK_ERROR",
        code: "NETWORK_ERROR",
        intents,
        durable: "server_unavailable",
      }
    }
  } else {
    return {
      ok: false,
      error: "SERVER_REQUIRED",
      code: "SERVER_REQUIRED",
      intents,
      durable: "server_unavailable",
    }
  }

  const services = getBoundDomainServices()
  if (services?.graph?.sendFriendRequest) {
    const res = await services.graph.sendFriendRequest(input.toUserId, ctx)
    if (!res.ok) {
      console.warn("[connection] session graph lag after durable request", res.error)
    }
  }
  try {
    persistOutgoingRequestIntent(input.fromUserId, input.toUserId, ctx)
  } catch { /* */ }

  try {
    window.dispatchEvent(
      new CustomEvent("ghc:social-mutation", {
        detail: { type: "connection_request", toUserId: input.toUserId, durable: true },
      })
    )
  } catch { /* */ }

  return { ok: true, intents, durable, state: "outgoing_pending" }
}

export async function acceptUnifiedConnectionRequest(
  actorUserId: string,
  fromUserId: string
): Promise<{ ok: boolean; error?: string; code?: string; intents?: ConnectionIntentId[] }> {
  if (!actorUserId || !fromUserId || actorUserId === fromUserId) {
    return { ok: false, error: "INVALID_PAIR", code: "INVALID_PAIR" }
  }
  const prior = getOutgoingRequestIntent(fromUserId, actorUserId)

  // Server-first accept so both accounts share the same relationship state
  if (typeof window !== "undefined") {
    try {
      const { res, data } = await postJson("/api/connections/accept", { fromUserId })
      if (!res.ok || data?.ok === false || data?.durable === false) {
        return {
          ok: false,
          error: String(data?.error || "ACCEPT_NOT_DURABLE"),
          code: "ACCEPT_NOT_DURABLE",
        }
      }
    } catch {
      return { ok: false, error: "NETWORK_ERROR", code: "NETWORK_ERROR" }
    }
  } else {
    return { ok: false, error: "SERVER_REQUIRED", code: "SERVER_REQUIRED" }
  }

  const services = getBoundDomainServices()
  if (services?.graph?.acceptFriendRequest) {
    const res = await services.graph.acceptFriendRequest(fromUserId)
    if (!res.ok) {
      console.warn("[connection] session graph lag after durable accept", res.error)
    }
  }
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:connection-updated", { detail: { action: "accept", fromUserId } })
    )
    window.dispatchEvent(
      new CustomEvent("ghc:social-mutation", {
        detail: { type: "connection_accept", fromUserId, durable: true },
      })
    )
  } catch { /* */ }
  return { ok: true, intents: prior?.intents || [] }
}

export async function declineUnifiedConnectionRequest(
  actorUserId: string,
  fromUserId: string
): Promise<{ ok: boolean; error?: string; code?: string }> {
  if (!actorUserId || !fromUserId || actorUserId === fromUserId) {
    return { ok: false, error: "INVALID_PAIR", code: "INVALID_PAIR" }
  }
  const services = getBoundDomainServices()
  if (!services?.graph?.rejectFriendRequest) {
    return { ok: false, error: "GRAPH_UNAVAILABLE", code: "GRAPH_UNAVAILABLE" }
  }
  const res = await services.graph.rejectFriendRequest(fromUserId)
  if (!res.ok) {
    return { ok: false, error: res.error || "DECLINE_FAILED", code: "DECLINE_FAILED" }
  }
  if (typeof window !== "undefined") {
    try {
      await postJson("/api/connections/decline", { fromUserId })
    } catch { /* */ }
  }
  return { ok: true }
}

export function listPendingConnectionRequests(currentUserId: string): PendingConnectionRequest[] {
  if (!currentUserId) return []
  const out: PendingConnectionRequest[] = []
  try {
    const outgoing = socialGraphStore.outgoingFriendRequestIds?.(currentUserId) || []
    const incoming = socialGraphStore.incomingFriendRequestIds?.(currentUserId) || []
    for (const toUserId of outgoing) {
      const meta = getOutgoingRequestIntent(currentUserId, toUserId)
      out.push({
        fromUserId: currentUserId,
        toUserId,
        direction: "outgoing",
        intents: meta?.intents || [],
        note: meta?.note,
        source: meta?.source,
        createdAt: meta?.createdAt,
        state: "outgoing_pending",
      })
    }
    for (const fromUserId of incoming) {
      const meta = getOutgoingRequestIntent(fromUserId, currentUserId)
      out.push({
        fromUserId,
        toUserId: currentUserId,
        direction: "incoming",
        intents: meta?.intents || [],
        note: meta?.note,
        source: meta?.source,
        createdAt: meta?.createdAt,
        state: "incoming_pending",
      })
    }
  } catch { /* */ }
  return out
}

/** @deprecated Prefer sendUnifiedConnectionRequest */
export async function sendConnectionRequest(input: SendConnectionRequestInput) {
  return sendUnifiedConnectionRequest(input)
}
