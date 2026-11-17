/**
 * Notification → connection actions (canonical unified adapter).
 * Notification payload is not authorization — server/domain re-checks.
 */

import {
  acceptUnifiedConnectionRequest,
  declineUnifiedConnectionRequest,
  sendUnifiedConnectionRequest,
} from "@/lib/domains/adapters/unified-connection-request"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import { IdentityService } from "@/lib/identity/identity-service"

export async function acceptFromNotification(fromUserId: string) {
  const me = IdentityService.getCurrentUserId()
  return acceptUnifiedConnectionRequest(me, fromUserId)
}

export async function declineFromNotification(fromUserId: string) {
  const me = IdentityService.getCurrentUserId()
  return declineUnifiedConnectionRequest(me, fromUserId)
}

export async function connectFromSearch(toUserId: string, intents?: ConnectionIntentId[]) {
  const me = IdentityService.getCurrentUserId()
  return sendUnifiedConnectionRequest({
    fromUserId: me,
    toUserId,
    intents,
    source: "search",
  })
}

export async function connectFromMatches(toUserId: string, intents?: ConnectionIntentId[]) {
  const me = IdentityService.getCurrentUserId()
  return sendUnifiedConnectionRequest({
    fromUserId: me,
    toUserId,
    intents,
    source: "match",
  })
}

/** Register window listeners once (safe to call multiple times) */
let wired = false
export function wireConnectionNotificationListeners() {
  if (typeof window === "undefined" || wired) return
  wired = true
  window.addEventListener("ghc:connection-accept", ((e: CustomEvent<{ userId?: string }>) => {
    const id = e.detail?.userId
    if (id) void acceptFromNotification(id)
  }) as EventListener)
  window.addEventListener("ghc:connection-decline", ((e: CustomEvent<{ userId?: string }>) => {
    const id = e.detail?.userId
    if (id) void declineFromNotification(id)
  }) as EventListener)
}
