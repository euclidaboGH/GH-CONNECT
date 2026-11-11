/**
 * Incoming pending connection-request count for badges.
 * Source: request-domain (session graph until durable migration).
 */

import { buildConnectionRequestInbox } from "@/lib/domains/adapters/connection-request-inbox"

export function getIncomingConnectionRequestCount(currentUserId: string): number {
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
