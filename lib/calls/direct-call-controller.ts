/**
 * DirectCallController — durable 1:1 WebRTC voice/video calls.
 *
 * Server-owned call state and authorization live in gh_call_* RPCs. Browser
 * media is never considered connected until ICE/peer connection reaches the
 * connected state. TURN credentials are short-lived and issued server-side.
 */
import {
  type CallEndReason,
  type CallKind,
  type CallPeer,
  type CallPhase,
  type DirectCallSession,
  CALL_RING_TIMEOUT_MS,
  CALL_CONNECT_TIMEOUT_MS,
} from "./call-types"
import { canInitiateDirectCall, requiredMediaConstraints, type CallRelationship } from "./call-policy"

export const DIRECT_CALL_EVENT = "ghc:direct-call"
export const DIRECT_CALL_ACTION_EVENT = "ghc:direct-call-action"

type CallConfig = { enabled: boolean; iceServers?: RTCIceServer[]; reason?: string }
type Signal = { id: number | string; senderId: string; kind: "offer" | "answer" | "ice_candidate"; payload: Record<string, unknown> }
type ApiResult<T = Record<string, unknown>> = { ok: boolean; error?: string; message?: string } & Partial<T>

function newCallId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return `call_${Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("")}`
}

async function api<T extends Record<string, unknown> = Record<string, unknown>>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => ({})) as ApiResult<T>
    return response.ok ? body : { ...body, ok: false, error: body.error || `HTTP_${response.status}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "NETWORK_TIMEOUT" : "NETWORK_ERROR" } as ApiResult<T>
  }
}

export type DirectCallListener = (session: DirectCallSession | null) => void

export class DirectCallController {
  private session: DirectCallSession | null = null
  private listeners = new Set<DirectCallListener>()
  private ringTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private incomingTimer: ReturnType<typeof setInterval> | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private peerConnection: RTCPeerConnection | null = null
  private lastSignalId = 0
  private pollInFlight = false
  private incomingInFlight = false
  private lastInviteAt = new Map<string, number>()

  getSession(): DirectCallSession | null { return this.session }
  getLocalStream(): MediaStream | null { return this.localStream }
  getRemoteStream(): MediaStream | null { return this.remoteStream }

  subscribe(fn: DirectCallListener): () => void {
    this.listeners.add(fn)
    fn(this.session)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    const snap = this.session
    for (const fn of this.listeners) { try { fn(snap) } catch { /* isolate observers */ } }
    if (typeof window !== "undefined") {
      try { window.dispatchEvent(new CustomEvent(DIRECT_CALL_EVENT, { detail: snap })) } catch { /* no-op */ }
    }
  }

  private setPhase(phase: CallPhase, patch: Partial<DirectCallSession> = {}) {
    if (!this.session) return
    this.session = { ...this.session, phase, ...patch }
    this.emit()
  }

  private clearTimers() {
    if (this.ringTimer) clearTimeout(this.ringTimer)
    if (this.connectTimer) clearTimeout(this.connectTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.ringTimer = null
    this.connectTimer = null
    this.pollTimer = null
  }

  private stopMedia() {
    if (this.peerConnection) {
      try { this.peerConnection.ontrack = null; this.peerConnection.onicecandidate = null; this.peerConnection.onconnectionstatechange = null; this.peerConnection.close() } catch { /* no-op */ }
      this.peerConnection = null
    }
    for (const stream of [this.localStream, this.remoteStream]) {
      if (stream) for (const track of stream.getTracks()) { try { track.stop() } catch { /* no-op */ } }
    }
    this.localStream = null
    this.remoteStream = null
  }

  private async getConfig(): Promise<CallConfig> {
    const result = await api<{ enabled?: boolean; iceServers?: RTCIceServer[]; reason?: string }>("/api/messaging/calls/config")
    return result.ok && result.enabled === true && Array.isArray(result.iceServers)
      ? { enabled: true, iceServers: result.iceServers }
      : { enabled: false, reason: result.error || result.reason || "Live calling is not configured yet. Please try again later." }
  }

  private async acquireMedia(kind: CallKind): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("This device does not support microphone or camera access.")
    return navigator.mediaDevices.getUserMedia(requiredMediaConstraints(kind))
  }

  private createPeerConnection(config: CallConfig): RTCPeerConnection {
    if (!config.enabled || !config.iceServers?.length) throw new Error("Secure call transport is unavailable.")
    const pc = new RTCPeerConnection({ iceServers: config.iceServers, iceCandidatePoolSize: 2 })
    this.peerConnection = pc
    this.remoteStream = new MediaStream()
    pc.ontrack = (event) => {
      const streams = event.streams
      if (streams?.[0]) {
        for (const track of streams[0].getTracks()) if (!this.remoteStream?.getTracks().some((item) => item.id === track.id)) this.remoteStream?.addTrack(track)
      } else if (event.track && !this.remoteStream?.getTracks().some((item) => item.id === event.track.id)) this.remoteStream?.addTrack(event.track)
      this.emit()
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.session?.callId) return
      void this.sendSignal(this.session.callId, "ice_candidate", { candidate: event.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (!this.session) return
      if (pc.connectionState === "connected") {
        this.setPhase("in_call", { mediaReady: Boolean(this.localStream?.getAudioTracks().length), signalingReady: true, connectedAt: this.session.connectedAt || Date.now(), errorMessage: undefined })
        if (this.connectTimer) clearTimeout(this.connectTimer)
        this.connectTimer = null
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        if (pc.connectionState === "failed") void this.end("network", "The call connection was lost. Check your network and try again.")
      } else if (pc.connectionState === "disconnected") {
        this.setPhase("connecting", { signalingReady: false, errorMessage: "Reconnecting call…" })
        if (!this.connectTimer) this.connectTimer = setTimeout(() => void this.end("network", "The call could not reconnect."), 12_000)
      }
    }
    if (this.localStream) for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream)
    return pc
  }

  private async sendSignal(callId: string, kind: Signal["kind"], payload: Record<string, unknown>) {
    const result = await api(`/api/messaging/calls/${encodeURIComponent(callId)}/signals`, { method: "POST", body: JSON.stringify({ kind, payload }) })
    if (!result.ok) throw new Error(result.error || "Could not send call signal.")
  }

  private startPolling(callId: string) {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => { void this.pollSignals(callId) }, 900)
    void this.pollSignals(callId)
  }

  private async pollSignals(callId: string) {
    if (this.pollInFlight || this.session?.callId !== callId || !this.peerConnection) return
    this.pollInFlight = true
    try {
      const result = await api<{ call?: Record<string, unknown>; signals?: Signal[] }>(`/api/messaging/calls/${encodeURIComponent(callId)}/signals?after=${this.lastSignalId}`)
      if (!result.ok) {
        if (result.error === "CALL_SIGNAL_READ_DENIED" || result.error === "CALL_EXPIRED") await this.end("network", "The call is no longer available.")
        return
      }
      const call = result.call || {}
      const status = String(call.status || "")
      if (this.session?.callId === callId && ["ringing", "accepted", "declined", "cancelled", "ended", "expired"].includes(status)) {
        this.session = { ...this.session, callStatus: status as DirectCallSession["callStatus"] }
      }
      if (status === "accepted" && !this.connectTimer && this.session.phase !== "in_call") {
        this.connectTimer = setTimeout(() => { if (this.session?.callId === callId && this.session.phase !== "in_call") void this.end("timeout", "The call could not connect in time.") }, CALL_CONNECT_TIMEOUT_MS)
      }
      if (["declined", "cancelled", "ended", "expired"].includes(status)) {
        await this.end(status === "declined" ? "rejected" : status === "expired" ? "timeout" : "remote_hangup", status === "declined" ? "The call was declined." : status === "expired" ? "The call expired." : "The other participant ended the call.", false)
        return
      }
      for (const signal of Array.isArray(result.signals) ? result.signals : []) {
        const id = Number(signal.id)
        if (Number.isSafeInteger(id)) this.lastSignalId = Math.max(this.lastSignalId, id)
        const pc = this.peerConnection
        if (!pc || this.session?.callId !== callId) return
        if (signal.kind === "offer" && this.session.phase === "connecting" && this.session.localUserId !== String(call.caller_id || "")) {
          const sdp = typeof signal.payload?.sdp === "string" ? signal.payload.sdp : ""
          if (!sdp || pc.remoteDescription) continue
          await pc.setRemoteDescription({ type: "offer", sdp })
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await this.sendSignal(callId, "answer", { type: answer.type, sdp: answer.sdp })
        } else if (signal.kind === "answer" && this.session.phase === "connecting" && !pc.remoteDescription) {
          const sdp = typeof signal.payload?.sdp === "string" ? signal.payload.sdp : ""
          if (sdp) await pc.setRemoteDescription({ type: "answer", sdp })
        } else if (signal.kind === "ice_candidate") {
          const candidate = signal.payload?.candidate
          if (candidate && typeof candidate === "object") {
            try { await pc.addIceCandidate(candidate as RTCIceCandidateInit) } catch { /* stale/duplicate candidate */ }
          }
        }
      }
    } catch (error) {
      if (this.session?.callId === callId) this.setPhase("connecting", { errorMessage: error instanceof Error ? error.message : "Call signaling interrupted." })
    } finally { this.pollInFlight = false }
  }

  /** Poll durable incoming-call state. Multiple mounted shells share one poller. */
  watchIncoming() {
    if (typeof window === "undefined" || this.incomingTimer) return
    const poll = async () => {
      if (this.incomingInFlight || (this.session && !["ended", "failed", "rejected", "busy"].includes(this.session.phase))) return
      if (document.visibilityState === "hidden") return
      this.incomingInFlight = true
      try {
        const result = await api<{ call?: { callId: string; conversationId: string; callerId: string; kind: CallKind; peer: CallPeer } | null }>("/api/messaging/calls")
        const incoming = result.ok ? result.call : null
        if (incoming?.callId && incoming.conversationId && incoming.callerId && !this.session) {
          this.clearTimers()
          this.session = { callId: incoming.callId, kind: incoming.kind, phase: "incoming_ringing", localUserId: "", peer: incoming.peer || { userId: incoming.callerId, displayName: "GreenHaven member" }, startedAt: Date.now(), mediaReady: false, signalingReady: false, conversationId: incoming.conversationId, callStatus: "ringing" } as DirectCallSession
          this.emit()
          this.ringTimer = setTimeout(() => { if (this.session?.callId === incoming.callId && this.session.phase === "incoming_ringing") void this.rejectIncoming(incoming.callId) }, CALL_RING_TIMEOUT_MS)
        }
      } finally { this.incomingInFlight = false }
    }
    this.incomingTimer = setInterval(() => { void poll() }, 3000)
    void poll()
  }

  async startOutgoing(opts: {
    localUserId: string; peer: CallPeer; kind: CallKind; relationship: CallRelationship;
    isBlockedEitherWay?: boolean; isMutedPeer?: boolean
  }): Promise<{ ok: boolean; code?: string; message?: string; callId?: string }> {
    if (this.session && !["ended", "failed", "rejected", "busy", "idle"].includes(this.session.phase)) return { ok: false, code: "CALL_BUSY_LOCAL", message: "You already have an active call." }
    const policy = canInitiateDirectCall({ relationship: opts.relationship, isBlockedEitherWay: Boolean(opts.isBlockedEitherWay), isMutedPeer: Boolean(opts.isMutedPeer), sameUser: String(opts.localUserId) === String(opts.peer.userId), productionCallsEnabled: true })
    if (!policy.ok) return { ok: false, code: policy.code, message: policy.message }
    const last = this.lastInviteAt.get(String(opts.peer.userId)) || 0
    if (Date.now() - last < 8000) return { ok: false, code: "CALL_COOLDOWN", message: "Please wait a moment before calling again." }
    this.lastInviteAt.set(String(opts.peer.userId), Date.now())
    const config = await this.getConfig()
    if (!config.enabled) return { ok: false, code: "CALLS_NOT_CONFIGURED", message: "Live calling is not available yet. The secure voice/video relay is still being configured." }
    const callId = newCallId()
    try {
      this.stopMedia()
      this.localStream = await this.acquireMedia(opts.kind)
      const started = await api<{ call?: Record<string, unknown> }>("/api/messaging/calls", { method: "POST", body: JSON.stringify({ callId, conversationId: opts.peer.conversationId, kind: opts.kind }) })
      if (!started.ok) throw new Error(started.error === "BLOCKED" ? "Calling is unavailable for this conversation." : started.error === "USER_ALREADY_IN_CALL" ? "You or this contact is already on another call." : started.error || "Could not start the call.")
      this.session = { callId, kind: opts.kind, phase: "connecting", localUserId: opts.localUserId, peer: opts.peer, conversationId: opts.peer.conversationId, callStatus: "ringing", startedAt: Date.now(), mediaReady: true, signalingReady: false }
      this.emit()
      const pc = this.createPeerConnection(config)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.sendSignal(callId, "offer", { type: offer.type, sdp: offer.sdp })
      this.ringTimer = setTimeout(() => { if (this.session?.callId === callId && this.session.phase !== "in_call") void this.end("timeout", "No answer. The call timed out.") }, CALL_RING_TIMEOUT_MS)
      this.startPolling(callId)
      return { ok: true, callId }
    } catch (error) {
      await this.end("unsupported", error instanceof Error ? error.message : "Could not start the call.")
      return { ok: false, code: "CALL_START_FAILED", message: error instanceof Error ? error.message : "Could not start the call." }
    }
  }

  async acceptIncoming(callId: string): Promise<void> {
    if (!this.session || this.session.callId !== callId || this.session.phase !== "incoming_ringing") return
    const config = await this.getConfig()
    if (!config.enabled) { await this.end("unsupported", "Secure call transport is not configured."); return }
    try {
      this.localStream = await this.acquireMedia(this.session.kind)
      const accepted = await api(`/api/messaging/calls/${encodeURIComponent(callId)}/transition`, { method: "POST", body: JSON.stringify({ action: "accept" }) })
      if (!accepted.ok) throw new Error(accepted.error || "This call is no longer available.")
      this.setPhase("connecting", { localUserId: "incoming", callStatus: "accepted", mediaReady: true })
      this.createPeerConnection(config)
      this.connectTimer = setTimeout(() => { if (this.session?.callId === callId && this.session.phase !== "in_call") void this.end("timeout", "The call could not connect in time.") }, CALL_CONNECT_TIMEOUT_MS)
      this.startPolling(callId)
    } catch (error) {
      await this.end("permission_denied", error instanceof Error ? error.message : "Could not accept the call.")
    }
  }

  async rejectIncoming(callId: string): Promise<void> {
    if (this.session?.callId !== callId) return
    await api(`/api/messaging/calls/${encodeURIComponent(callId)}/transition`, { method: "POST", body: JSON.stringify({ action: "decline" }) })
    await this.end("rejected", "Call declined.", false)
  }

  async hangup(): Promise<void> { await this.end("local_hangup") }

  async end(reason: CallEndReason, message?: string, notifyServer = true): Promise<void> {
    const current = this.session
    this.clearTimers()
    if (notifyServer && current?.callId) {
      // Resolve the durable server state before choosing end vs cancel. The peer
      // may accept between the last poll and a local hangup tap.
      void api<{ call?: { status?: string } }>(`/api/messaging/calls/${encodeURIComponent(current.callId)}/signals?after=${this.lastSignalId}`)
        .then(async (latest) => {
          const status = latest.call?.status || current.callStatus
          const action = status === "accepted" || current.localUserId === "incoming" ? "end" : "cancel"
          await api(`/api/messaging/calls/${encodeURIComponent(current.callId)}/transition`, { method: "POST", body: JSON.stringify({ action }) })
        })
        .catch(() => undefined)
    }
    this.stopMedia()
    if (!current || ["ended", "failed", "rejected", "busy"].includes(current.phase)) return
    const failed = ["timeout", "network", "permission_denied", "unsupported", "policy"].includes(reason)
    this.session = { ...current, phase: failed ? "failed" : reason === "rejected" || reason === "busy" ? reason : "ended", endedAt: Date.now(), endReason: reason, errorMessage: message || current.errorMessage, mediaReady: false, signalingReady: false }
    this.emit()
  }

  toggleAudio(enabled: boolean) { for (const track of this.localStream?.getAudioTracks() || []) track.enabled = enabled }
  toggleVideo(enabled: boolean) { for (const track of this.localStream?.getVideoTracks() || []) track.enabled = enabled }

  resetIdle(): void {
    this.clearTimers()
    this.stopMedia()
    this.session = null
    this.lastSignalId = 0
    this.emit()
  }
}

let _controller: DirectCallController | null = null
export function getDirectCallController(): DirectCallController {
  if (!_controller) _controller = new DirectCallController()
  return _controller
}

export function resolveCallRelationship(opts: { isFriend: boolean; isMatch: boolean; isMutualFollow?: boolean }): CallRelationship {
  if (opts.isFriend) return "friend"
  if (opts.isMatch) return "match"
  if (opts.isMutualFollow) return "following_mutual"
  return "none"
}
