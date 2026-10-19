/**
 * Client helper: upload optimized file to durable /api/media.
 * Prefer media references over inline data URLs in posts/stories/messages.
 */

import { mediaUserMessage } from "@/lib/media/user-messages"

const MAX_PROXY_UPLOAD_BYTES = 4 * 1024 * 1024
const SAFE_PROXY_UPLOAD_BYTES = 3.75 * 1024 * 1024

/** Compress oversized images in-browser before they reach the constrained API proxy. */
async function compressOversizedImage(file: File | Blob): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file

  let source: ImageBitmap | HTMLImageElement | null = null
  let objectUrl: string | null = null
  try {
    if (typeof createImageBitmap === "function") {
      source = await createImageBitmap(file)
    } else {
      objectUrl = URL.createObjectURL(file)
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("OPTIMIZE_FAILED"))
        image.src = objectUrl as string
      })
    }

    if (!source) throw new Error("OPTIMIZE_FAILED")
    const originalWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const originalHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("OPTIMIZE_FAILED")

    const sourceMaxDimension = Math.max(originalWidth, originalHeight)
    const dimensions = [...new Set([sourceMaxDimension, 1920, 1600, 1280, 1024, 900, 720, 640, 512, 400].filter((value) => value <= sourceMaxDimension))]
    const qualities = [0.82, 0.74, 0.66, 0.58]
    let best: Blob | null = null
    for (const maxDimension of dimensions) {
      const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight))
      canvas.width = Math.max(1, Math.round(originalWidth * scale))
      canvas.height = Math.max(1, Math.round(originalHeight * scale))
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      for (const quality of qualities) {
        const candidate = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("OPTIMIZE_FAILED")), "image/jpeg", quality)
        })
        best = candidate
        if (candidate.size <= SAFE_PROXY_UPLOAD_BYTES) return candidate
      }
    }
    if (best && best.size <= MAX_PROXY_UPLOAD_BYTES) return best
    throw new Error("MEDIA_DIRECT_UPLOAD_REQUIRED")
  } catch (error) {
    if (error instanceof Error && error.message === "MEDIA_DIRECT_UPLOAD_REQUIRED") throw error
    throw new Error("OPTIMIZE_FAILED")
  } finally {
    if (source && "close" in source && typeof source.close === "function") source.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

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
  // Vercel Functions cap request bodies at 4.5 MB. Keep the actual file below
  // 4 MB to leave room for multipart overhead. Oversized images are compressed
  // client-side; video and other files require the future direct/resumable path.
  let uploadFile = file
  let uploadName = meta?.fileName || (file instanceof File && file.name ? file.name : `media_${Date.now()}`)
  if (uploadFile.size > MAX_PROXY_UPLOAD_BYTES) {
    if (uploadFile.type.startsWith("image/")) {
      try {
        meta?.onProgress?.("Compressing photo…")
        uploadFile = await compressOversizedImage(uploadFile)
        uploadName = uploadName.replace(/\.[^.]+$/, "") + ".jpg"
      } catch (error) {
        const code = error instanceof Error ? error.message : "OPTIMIZE_FAILED"
        return {
          ok: false,
          durable: false,
          error: code,
          userMessage: mediaUserMessage(code),
          clientCompress: true,
        }
      }
    }
    if (uploadFile.size > MAX_PROXY_UPLOAD_BYTES) {
      return {
        ok: false,
        durable: false,
        error: "MEDIA_DIRECT_UPLOAD_REQUIRED",
        userMessage: mediaUserMessage("MEDIA_DIRECT_UPLOAD_REQUIRED"),
        clientCompress: uploadFile !== file,
      }
    }
  }

  const form = new FormData()
  const name = uploadName
  form.append("file", uploadFile, name)
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
