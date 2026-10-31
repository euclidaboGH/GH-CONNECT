/**
 * Connection-request inbox domain layer (Prompt #41).
 * Session graph source until migration applied; never localStorage authority.
 */

import {
  listPendingConnectionRequests,
  type PendingConnectionRequest,
} from "@/lib/domains/adapters/unified-connection-request"
import { getOutgoingRequestIntent } from "@/lib/domains/adapters/connection-request-intent"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import { CONNECTION_INTENT_OPTIONS } from "@/lib/connection-intents"

export type InboxDataSource = "session_graph" | "server_durable"

export interface ConnectionRequestInboxItem {
  fromUserId: string
  toUserId: string
  direction: "incoming" | "outgoing"
  intents: ConnectionIntentId[]
  intentLabels: string[]
  note?: string
  source?: string
  createdAt?: number
  state: "outgoing_pending" | "incoming_pending"
  dataSource: InboxDataSource
  /** Display helpers filled by UI when candidate map available */
  displayName?: string
  avatarUrl?: string
}

function intentLabels(ids: ConnectionIntentId[]): string[] {
  return ids.map((id) => {
    const opt = CONNECTION_INTENT_OPTIONS.find((o) => o.id === id)
    return opt?.label || id
  })
}

/**
 * Build inbox from unified pending list.
 * When server durable RPC exists later, merge/prefer server rows here.
 */
export function buildConnectionRequestInbox(
  currentUserId: string,
  opts?: { durableAvailable?: boolean }
): {
  incoming: ConnectionRequestInboxItem[]
  outgoing: ConnectionRequestInboxItem[]
  dataSource: InboxDataSource
} {
  const dataSource: InboxDataSource =
    opts?.durableAvailable === true ? "server_durable" : "session_graph"
  const pending = listPendingConnectionRequests(currentUserId)
  const incoming: ConnectionRequestInboxItem[] = []
  const outgoing: ConnectionRequestInboxItem[] = []

  for (const p of pending) {
    const intents = p.intents?.length
      ? p.intents
      : (getOutgoingRequestIntent(
          p.direction === "outgoing" ? p.fromUserId : p.fromUserId,
          p.direction === "outgoing" ? p.toUserId : p.toUserId
        )?.intents || []) as ConnectionIntentId[]

    const item: ConnectionRequestInboxItem = {
      ...p,
      intents,
      intentLabels: intentLabels(intents),
      dataSource,
    }
    if (p.direction === "incoming") incoming.push(item)
    else outgoing.push(item)
  }

  incoming.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  outgoing.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  return { incoming, outgoing, dataSource }
}

/** Product rule helper — interest/like must not imply connection */
export function isInterestOnlyAction(action: string): boolean {
  return action === "like" || action === "interest" || action === "match" || action === "swipe_like"
}

export function isConnectionMutationAction(action: string): boolean {
  return (
    action === "connect" ||
    action === "send_connection_request" ||
    action === "accept" ||
    action === "decline"
  )
}

export type { PendingConnectionRequest }
