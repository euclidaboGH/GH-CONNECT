/**
 * Shared Connect → Intent picker → Confirm → Request flow helpers.
 * Domain result drives UI state; no optimistic "sent" without ok.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import {
  sendUnifiedConnectionRequest,
  getUnifiedConnectionState,
  type ConnectionRequestSource,
  type SendConnectionRequestResult,
} from "@/lib/domains/adapters/unified-connection-request"
import { buildConnectionRequestInbox } from "@/lib/domains/adapters/connection-request-inbox"
import type { ConnectionUiState } from "@/lib/domains/adapters/connection-graph-adapter"

export type ConnectFlowTarget = {
  userId: string
  displayName?: string
  source: ConnectionRequestSource
  blockedUserIds?: string[]
}

export type ConnectFlowPhase =
  | "idle"
  | "picking_intent"
  | "submitting"
  | "success"
  | "error"

export function userFacingConnectError(codeOrMessage?: string): string {
  const c = (codeOrMessage || "").toUpperCase()
  if (c.includes("TARGET_BLOCKED") || c.includes("BLOCKED")) {
    return "You can't connect with this person."
  }
  if (c.includes("ALREADY_CONNECTED")) {
    return "You're already connected."
  }
  if (c.includes("INVALID_INTENTS") || c.includes("INTENTS")) {
    return "Choose at least one valid reason to connect."
  }
  if (c.includes("INVALID_PAIR")) {
    return "This connection isn't available."
  }
  if (c.includes("REQUEST_FAILED") || c.includes("GRAPH")) {
    return "Couldn't send the request. Try again."
  }
  if (c.includes("UNAUTHORIZED")) {
    return "Please sign in again to continue."
  }
  return "Couldn't send the request. Try again."
}

export async function submitConnectionFromPicker(
  fromUserId: string,
  target: ConnectFlowTarget,
  intents: ConnectionIntentId[],
  note?: string
): Promise<SendConnectionRequestResult> {
  return sendUnifiedConnectionRequest({
    fromUserId,
    toUserId: target.userId,
    intents,
    note: note?.trim() || undefined,
    source: target.source,
    blockedUserIds: target.blockedUserIds,
  })
}

export function incomingRequestBadgeCount(currentUserId: string): number {
  if (!currentUserId) return 0
  try {
    const { incoming } = buildConnectionRequestInbox(currentUserId, {
      durableAvailable: false,
    })
    return incoming.length
  } catch {
    return 0
  }
}

/** Map unified state to primary CTA for Match/Profile */
export function primaryConnectionCta(
  state: ConnectionUiState
): "connect" | "pending" | "accept" | "message" | "none" {
  switch (state) {
    case "connected":
    case "mutual":
      return "message"
    case "outgoing_pending":
      return "pending"
    case "incoming_pending":
      return "accept"
    case "blocked":
      return "none"
    case "matched":
    case "none":
    case "declined":
    default:
      return "connect"
  }
}

export function resolveConnectionUiState(
  currentUserId: string,
  targetUserId: string,
  snap?: Parameters<typeof getUnifiedConnectionState>[2]
): ConnectionUiState {
  return getUnifiedConnectionState(currentUserId, targetUserId, snap)
}
