/**
 * Device-local voice note recorder (MediaRecorder).
 * Produces a Blob for upload finalization — does not claim durable delivery by itself.
 */

export type VoiceNoteResult =
  | { ok: true; blob: Blob; mimeType: string; durationMs: number }
  | { ok: false; code: string; message: string }

const MAX_MS = 60_000

export function isVoiceNoteSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
}

export async function recordVoiceNote(opts?: {
  maxMs?: number
  onStart?: () => void
  signal?: AbortSignal
}): Promise<VoiceNoteResult> {
  if (!isVoiceNoteSupported()) {
    return { ok: false, code: "UNSUPPORTED", message: "Voice notes are not supported on this device." }
  }
  const maxMs = opts?.maxMs ?? MAX_MS
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : ""
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    const chunks: BlobPart[] = []
    const started = Date.now()
    opts?.onStart?.()

    const stopped = new Promise<VoiceNoteResult>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        const durationMs = Date.now() - started
        const type = recorder.mimeType || mime || "audio/webm"
        if (!chunks.length) {
          resolve({ ok: false, code: "EMPTY", message: "No audio was captured." })
          return
        }
        resolve({ ok: true, blob: new Blob(chunks, { type }), mimeType: type, durationMs })
      }
      recorder.onerror = () => {
        resolve({ ok: false, code: "RECORDER_ERROR", message: "Recording failed." })
      }
    })

    recorder.start(250)
    const timer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop()
    }, maxMs)

    if (opts?.signal) {
      const onAbort = () => {
        try {
          if (recorder.state === "recording") recorder.stop()
        } catch { /* */ }
      }
      if (opts.signal.aborted) onAbort()
      else opts.signal.addEventListener("abort", onAbort, { once: true })
    }

    // External stop: callers can abort signal; otherwise maxMs
    const result = await stopped
    clearTimeout(timer)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Microphone permission denied"
    return { ok: false, code: "PERMISSION", message: msg }
  } finally {
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop() } catch { /* */ }
      }
    }
  }
}
