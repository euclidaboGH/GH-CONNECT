/**
 * Who may start a direct call, rate limits, and fail-closed production rules.
 * No media is established without explicit policy pass + user consent.
 */

import type { CallKind } from "./call-types"

export const CALLS_PRODUCTION_ENABLED = false

/** Minimum relationship to initiate a call (server should re-check). */
export type CallRelationship = "friend" | "match" | "following_mutual" | "none"

export function canInitiateDirectCall(opts: {
  relationship: CallRelationship
  isBlockedEitherWay: boolean
  isMutedPeer: boolean
  sameUser: boolean
  productionCallsEnabled?: boolean
}): { ok: true } | { ok: false; code: string; message: string } {
  if (opts.sameUser) {
    return { ok: false, code: "CALL_SELF", message: "You cannot call yourself." }
  }
  if (opts.isBlockedEitherWay) {
    return { ok: false, code: "CALL_BLOCKED", message: "Calling is unavailable for this conversation." }
  }
  if (opts.isMutedPeer) {
    return { ok: false, code: "CALL_MUTED", message: "This conversation is muted. Unmute to place a call." }
  }
  if (opts.relationship === "none") {
    return {
      ok: false,
      code: "CALL_RELATIONSHIP_REQUIRED",
      message: "Calls require an accepted connection or mutual match.",
    }
  }
  const enabled = opts.productionCallsEnabled ?? CALLS_PRODUCTION_ENABLED
  // Client may still open the sheet for UX rehearsal; media stays gated.
  if (!enabled) {
    return {
      ok: false,
      code: "CALLS_NOT_ENABLED",
      message:
        "Live calling is not enabled on this release. Signaling and TURN must be operator-configured before media starts.",
    }
  }
  return { ok: true }
}

export function requiredMediaConstraints(kind: CallKind): MediaStreamConstraints {
  if (kind === "video") {
    return {
      audio: true,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }
  }
  return { audio: true, video: false }
}

/** Client-side rate: at most one invite attempt per peer per window. */
export const CALL_INVITE_COOLDOWN_MS = 8_000
