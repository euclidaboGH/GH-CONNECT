"use client"

/** Durable direct-call surface: incoming accept/decline, remote media, and call controls. */
import { useEffect, useRef, useState } from "react"
import { Phone, PhoneOff, Video, Mic, MicOff, X, VideoOff, RefreshCw } from "lucide-react"
import { getDirectCallController, DIRECT_CALL_EVENT, type DirectCallController } from "@/lib/calls/direct-call-controller"
import type { DirectCallSession } from "@/lib/calls/call-types"

function phaseLabel(s: DirectCallSession): string {
  switch (s.phase) {
    case "outgoing_ringing": return "Calling…"
    case "incoming_ringing": return "Incoming call"
    case "connecting": return "Connecting securely…"
    case "in_call": return s.mediaReady && s.signalingReady ? "Connected" : "Establishing media…"
    case "ended": return "Call ended"
    case "failed": return "Call unavailable"
    case "rejected": return "Declined"
    case "busy": return "Busy"
    default: return s.phase
  }
}

export function DirectCallSheet() {
  const [session, setSession] = useState<DirectCallSession | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [mediaTick, setMediaTick] = useState(0)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const remoteAudio = useRef<HTMLAudioElement>(null)
  const localVideo = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const c = getDirectCallController()
    setSession(c.getSession())
    const unsub = c.subscribe((value) => { setSession(value); setMediaTick((n) => n + 1) })
    c.watchIncoming()
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail as DirectCallSession | null
      setSession(detail ?? null)
      setMediaTick((n) => n + 1)
    }
    window.addEventListener(DIRECT_CALL_EVENT, onEvt as EventListener)
    return () => { unsub(); window.removeEventListener(DIRECT_CALL_EVENT, onEvt as EventListener) }
  }, [])

  useEffect(() => {
    const c = getDirectCallController()
    const local = c.getLocalStream()
    const remote = c.getRemoteStream()
    if (localVideo.current && localVideo.current.srcObject !== local) localVideo.current.srcObject = local
    if (remoteVideo.current && remoteVideo.current.srcObject !== remote) remoteVideo.current.srcObject = remote
    const audioOnly = session?.kind === "voice" ? remote : null
    if (remoteAudio.current && remoteAudio.current.srcObject !== audioOnly) remoteAudio.current.srcObject = audioOnly
  }, [session, mediaTick])

  if (!session || session.phase === "idle") return null
  const terminal = ["ended", "failed", "rejected", "busy"].includes(session.phase)
  const incoming = session.phase === "incoming_ringing"
  const ctrl: DirectCallController = getDirectCallController()

  return (
    <div className="fixed inset-0 z-[220] flex flex-col overflow-hidden bg-zinc-950 text-white" role="dialog" aria-modal="true" aria-label={session.kind === "video" ? "Video call" : "Voice call"}>
      <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{session.kind === "video" ? "Video call" : "Voice call"}</p>
        {terminal && <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Close" onClick={() => ctrl.resetIdle()}><X size={18} /></button>}
      </div>

      {session.kind === "video" && !terminal ? (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-contain" aria-label="Remote video" />
          <video ref={localVideo} autoPlay muted playsInline className="absolute bottom-5 right-5 h-32 w-24 rounded-2xl border border-white/30 bg-zinc-900 object-cover shadow-xl" aria-label="Your camera preview" />
          {!session.signalingReady && <div className="absolute inset-0 flex items-center justify-center bg-black/35"><p className="rounded-full bg-black/60 px-4 py-2 text-sm text-white/80">{phaseLabel(session)}</p></div>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/20">
            <img src={session.peer.photoUrl || "/placeholder.svg?width=160&height=160"} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{session.peer.displayName || "GreenHaven member"}</p>
            <p className="mt-1 text-sm text-white/70" role="status">{phaseLabel(session)}</p>
            {session.errorMessage && <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-amber-200/90">{session.errorMessage}</p>}
            {session.phase === "in_call" && !session.signalingReady && <p className="mt-2 text-[11px] text-white/50">Reconnecting…</p>}
          </div>
        </div>
      )}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      <div className="flex min-h-24 items-center justify-center gap-4 border-t border-white/10 bg-zinc-950/90 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
        {incoming && <>
          <button type="button" className="inline-flex h-14 min-w-28 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold" onClick={() => void ctrl.rejectIncoming(session.callId)}><PhoneOff size={19} /> Decline</button>
          <button type="button" className="inline-flex h-14 min-w-28 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold" onClick={() => void ctrl.acceptIncoming(session.callId)}><Phone size={19} /> Accept</button>
        </>}
        {!incoming && !terminal && <>
          <button type="button" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15" aria-label={muted ? "Unmute microphone" : "Mute microphone"} onClick={() => { ctrl.toggleAudio(muted); setMuted((v) => !v) }}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
          {session.kind === "video" && <button type="button" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15" aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} onClick={() => { ctrl.toggleVideo(cameraOff); setCameraOff((v) => !v) }}>{cameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}
          <button type="button" className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900/40" aria-label="End call" onClick={() => void ctrl.hangup()}><PhoneOff size={26} /></button>
        </>}
        {terminal && <button type="button" className="inline-flex h-12 min-w-[140px] items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-zinc-900" onClick={() => ctrl.resetIdle()}><RefreshCw size={16} /> Done</button>}
      </div>
    </div>
  )
}

export function CallHeaderButtons(props: { onVoice?: () => void; onVideo?: () => void; disabled?: boolean }) {
  return <div className="flex items-center gap-1">
    <button type="button" disabled={props.disabled} onClick={props.onVoice} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-40" aria-label="Voice call" title="Voice call"><Phone size={18} /></button>
    <button type="button" disabled={props.disabled} onClick={props.onVideo} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-40" aria-label="Video call" title="Video call"><Video size={18} /></button>
  </div>
}
