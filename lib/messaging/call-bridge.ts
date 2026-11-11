/**
 * Bridges chat thread actions → DirectCallController with relationship checks.
 */

import { getDirectCallController, resolveCallRelationship } from "@/lib/calls/direct-call-controller"
import type { CallKind } from "@/lib/calls/call-types"
import { pushCallHistory } from "@/lib/calls/call-history"

export async function startDirectCallFromThread(opts: {
  localUserId: string
  peerUserId: string
  peerName: string
  peerPhoto?: string | null
  conversationId?: string | null
  kind: CallKind
  isFriend: boolean
  isMatch: boolean
  isMutualFollow?: boolean
  isBlocked?: boolean
  isMuted?: boolean
}): Promise<{ ok: boolean; message?: string }> {
  const relationship = resolveCallRelationship({
    isFriend: opts.isFriend,
    isMatch: opts.isMatch,
    isMutualFollow: opts.isMutualFollow,
  })
  const ctrl = getDirectCallController()
  const result = await ctrl.startOutgoing({
    localUserId: opts.localUserId,
    peer: {
      userId: opts.peerUserId,
      displayName: opts.peerName,
      photoUrl: opts.peerPhoto,
      conversationId: opts.conversationId,
    },
    kind: opts.kind,
    relationship,
    isBlockedEitherWay: Boolean(opts.isBlocked),
    isMutedPeer: Boolean(opts.isMuted),
  })

  if (!result.ok) {
    return { ok: false, message: result.message || "Unable to start call." }
  }

  // Record attempt when session ends (listener once)
  const unsub = ctrl.subscribe((s) => {
    if (!s) return
    if (s.phase === "ended" || s.phase === "failed" || s.phase === "rejected" || s.phase === "busy") {
      pushCallHistory({
        callId: s.callId,
        peerUserId: opts.peerUserId,
        peerName: opts.peerName,
        kind: opts.kind,
        direction: "outgoing",
        endedAt: s.endedAt || Date.now(),
        reason: s.endReason,
        note: s.errorMessage,
      })
      unsub()
    }
  })


  return { ok: true }
}
