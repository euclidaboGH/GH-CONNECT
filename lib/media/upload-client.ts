/**
 * Client helper: upload compressed file to durable /api/media when available.
 * Falls back to data URL path on 501 MEDIA_STORAGE_UNAVAILABLE.
 */

export type DurableMediaResult =
  | {
      ok: true
      durable: true
      mediaId: string
      url: string
      kind: "image" | "video"
    }
  | {
      ok: false
      durable: false
      error: string
      clientCompress?: boolean
    }

export async function uploadDurableMedia(
  file: File | Blob,
  meta?: { width?: number; height?: number; durationMs?: number }
): Promise<DurableMediaResult> {
  const form = new FormData()
  form.append("file", file)
  if (meta?.width != null) form.append("width", String(meta.width))
  if (meta?.height != null) form.append("height", String(meta.height))
  if (meta?.durationMs != null) form.append("durationMs", String(meta.durationMs))

  try {
    const res = await fetch("/api/media", {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok && data.ok === true && data.mediaId && data.url) {
      return {
        ok: true,
        durable: true,
        mediaId: String(data.mediaId),
        url: String(data.url),
        kind: data.kind === "video" ? "video" : "image",
      }
    }
    return {
      ok: false,
      durable: false,
      error: String(data.error || `HTTP_${res.status}`),
      clientCompress: Boolean(data.clientCompress),
    }
  } catch {
    return { ok: false, durable: false, error: "NETWORK" }
  }
}
