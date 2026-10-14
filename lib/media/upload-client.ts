/**
 * Client helper: upload optimized file to durable /api/media.
 * Prefer media references over inline data URLs in posts/stories/messages.
 */

import { mediaUserMessage } from "@/lib/media/user-messages"

export type DurableMediaResult =
  | {
      ok: true
      durable: true
      mediaId: string
      url: string
      kind: "image" | "video" | "file"
    }
  | {
      ok: false
      durable: false
      error: string
      userMessage: string
      clientCompress?: boolean
    }

export async function uploadDurableMedia(
  file: File | Blob,
  meta?: {
    width?: number
    height?: number
    durationMs?: number
    fileName?: string
    onProgress?: (label: string) => void
  }
): Promise<DurableMediaResult> {
  // Vercel Functions cap request bodies at 4.5 MB. Keep a 4 MB file ceiling
  // for this proxy path so multipart overhead cannot turn a valid selection into a 413.
  // Large uploads must use the planned direct-to-storage/resumable path.
  if (file.size > 4 * 1024 * 1024) {
    return {
      ok: false,
      durable: false,
      error: "MEDIA_DIRECT_UPLOAD_REQUIRED",
      userMessage: mediaUserMessage("MEDIA_DIRECT_UPLOAD_REQUIRED"),
    }
  }

  const form = new FormData()
  const name =
    meta?.fileName ||
    (file instanceof File && file.name ? file.name : `media_${Date.now()}`)
  form.append("file", file, name)
  if (meta?.width != null) form.append("width", String(meta.width))
  if (meta?.height != null) form.append("height", String(meta.height))
  if (meta?.durationMs != null) form.append("durationMs", String(meta.durationMs))

  try {
    meta?.onProgress?.("Uploading…")
    const res = await fetch("/api/media", {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok && data.ok === true && data.url) {
      return {
        ok: true,
        durable: true,
        mediaId: String(data.mediaId || data.path || data.url),
        url: String(data.url),
        kind:
          data.kind === "video" ? "video" : data.kind === "file" ? "file" : "image",
      }
    }
    const code = String(data.error || `HTTP_${res.status}`)
    return {
      ok: false,
      durable: false,
      error: code,
      userMessage: mediaUserMessage(code, String(data.message || "") || undefined),
      clientCompress: Boolean(data.clientCompress),
    }
  } catch {
    return {
      ok: false,
      durable: false,
      error: "NETWORK",
      userMessage: mediaUserMessage("NETWORK"),
    }
  }
}
