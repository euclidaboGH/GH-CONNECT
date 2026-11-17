/**
 * Direct 1:1 call signaling types — application layer only.
 * Media (WebRTC) requires STUN/TURN + real signaling transport; this module
 * defines the durable state machine and event shapes without inventing connectivity.
 */

export type CallKind = "voice" | "video"

export type CallPhase =
  | "idle"
  | "outgoing_ringing"
  | "incoming_ringing"
  | "connecting"
  | "in_call"
  | "ended"
  | "failed"
  | "rejected"
  | "busy"
  | "unavailable"

export type CallEndReason =
  | "local_hangup"
  | "remote_hangup"
  | "rejected"
  | "busy"
  | "timeout"
  | "permission_denied"
  | "network"
  | "policy"
  | "unsupported"
  | "cancelled"

export interface CallPeer {
  userId: string
  displayName: string
  photoUrl?: string | null
  conversationId?: string | null
}

export interface DirectCallSession {
  callId: string
  kind: CallKind
  phase: CallPhase
  localUserId: string
  peer: CallPeer
  conversationId?: string | null
  callStatus?: "ringing" | "accepted" | "declined" | "cancelled" | "ended" | "expired"
  startedAt: number
  connectedAt?: number
  endedAt?: number
  endReason?: CallEndReason
  /** True only after getUserMedia succeeds for required tracks */
  mediaReady: boolean
  /** Explicit: signaling transport is not claimed ready without operator config */
  signalingReady: boolean
  errorMessage?: string
}

export type CallSignalType =
  | "invite"
  | "accept"
  | "reject"
  | "hangup"
  | "busy"
  | "offer"
  | "answer"
  | "ice"
  | "timeout"

export interface CallSignalPayload {
  type: CallSignalType
  callId: string
  kind: CallKind
  fromUserId: string
  toUserId: string
  conversationId?: string | null
  sdp?: string
  candidate?: string
  ts: number
}

export const CALL_RING_TIMEOUT_MS = 45_000
export const CALL_CONNECT_TIMEOUT_MS = 30_000
export const CALL_MAX_CONCURRENT_PER_USER = 1
