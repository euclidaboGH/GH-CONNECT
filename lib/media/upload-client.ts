/**
 * Client helper: upload optimized file to durable /api/media.
 * Small files: multipart via Vercel (≤ ~3.75MB).
 * Larger files: signed direct-to-storage upload (bypasses Vercel body limit).
 */

import { mediaUserMessage } from "@/lib/media/user-messages"
import { IdentityService } from "@/lib/identity/identity-service"
import { toRelativeMediaFacadeUrl } from "@/lib/media/resolve-display-url"

const MAX_PROXY_UPLOAD_BYTES = 4 * 1024 * 1024
const SAFE_PROXY_UPLOAD_BYTES = 3.75 * 1024 * 1024
/** Align with server MAX_VIDEO / elevated file limits for direct path. */
const MAX_DIRECT_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_DIRECT_VIDEO_BYTES = 40 * 1024 * 1024
const MAX_DIRECT_FILE_BYTES = 50 * 1024 * 1024
const MAX_DIRECT_AUDIO_BYTES = 50 * 1024 * 1024

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
    const dimensions = [
      ...new Set(
        [sourceMaxDimension, 1920, 1600, 1280, 1024, 900, 720, 640, 512, 400].filter(
          (value) => value <= sourceMaxDimension
        )
      ),
    ]
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
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("OPTIMIZE_FAILED"))),
            "image/jpeg",
            quality
          )
        })
        if (!best || candidate.size < best.size) best = candidate
        if (candidate.size <= SAFE_PROXY_UPLOAD_BYTES) return candidate
      }
    }
    if (best && best.size <= MAX_PROXY_UPLOAD_BYTES) return best
    // Still large after compress — caller may use direct upload with original/best
    if (best) return best
    throw new Error("OPTIMIZE_FAILED")
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

function authHeaders(): Record<string, string> {
  try {
    return { ...IdentityService.getAuthHeaders() }
  } catch {
    return {}
  }
}

/**
 * Recover a stale/missing GH session once using the already-held Pi access token.
 * The server verifies that token against Pi before issuing a fresh HttpOnly cookie.
 * No anonymous upload or client-supplied user ID is ever accepted as a fallback.
 */
async function fetchWithPiSessionRecovery(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status !== 401) return response

  const accessToken = IdentityService.getAccessToken()
  if (!accessToken) return response

  try {
    const bridge = await fetch("/api/auth/pi", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ accessToken }),
    })
    const result = (await bridge.json().catch(() => ({}))) as { ok?: boolean; verified?: boolean }
    if (!bridge.ok || result.ok !== true || result.verified !== true) return response

    // Reuse the original request body and cookie credentials; retry only once.
    return await fetch(input, { ...init, credentials: "include" })
  } catch {
    return response
  }
}

async function uploadViaProxy(
  uploadFile: Blob,
  uploadName: string,
  meta?: {
    width?: number
    height?: number
    durationMs?: number
    onProgress?: (label: string) => void
    category?: "avatars" | "images" | "videos" | "audio" | "documents"
  }
): Promise<DurableMediaResult> {
  const form = new FormData()
  form.append("file", uploadFile, uploadName)
  if (meta?.category) form.append("category", meta.category)
  if (meta?.width != null) form.append("width", String(meta.width))
  if (meta?.height != null) form.append("height", String(meta.height))
  if (meta?.durationMs != null) form.append("durationMs", String(meta.durationMs))

  try {
    meta?.onProgress?.("Uploading…")
    const res = await fetchWithPiSessionRecovery("/api/media", {
      method: "POST",
      credentials: "include",
      headers: { ...authHeaders() },
      body: form,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok && data.ok === true && data.url) {
      return {
        ok: true,
        durable: true,
        mediaId: String(data.mediaId || data.path || data.url),
        url: toRelativeMediaFacadeUrl(String(data.url)),
        kind: data.kind === "video" ? "video" : data.kind === "file" ? "file" : "image",
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

async function uploadViaDirect(
  file: Blob,
  mimeType: string,
  uploadName: string,
  meta?: {
    width?: number
    height?: number
    durationMs?: number
    onProgress?: (label: string) => void
    category?: "avatars" | "images" | "videos" | "audio" | "documents"
  }
): Promise<DurableMediaResult> {
  meta?.onProgress?.("Preparing secure upload…")
  try {
    const intentRes = await fetchWithPiSessionRecovery("/api/media/direct-upload-intent", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        mimeType,
        byteSize: file.size,
        fileName: uploadName,
        category: meta?.category,
      }),
    })
    const intent = (await intentRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!intentRes.ok || intent.ok !== true || !intent.uploadUrl || !intent.objectPath) {
      const code = String(intent.error || `HTTP_${intentRes.status}`)
      return {
        ok: false,
        durable: false,
        error: code,
        userMessage: mediaUserMessage(code, String(intent.message || "") || undefined),
      }
    }

    meta?.onProgress?.("Uploading…")
    const putHeaders: Record<string, string> = {
      "Content-Type": mimeType || "application/octet-stream",
    }
    if (intent.token) {
      putHeaders["x-upsert"] = "false"
    }
    const putRes = await fetch(String(intent.uploadUrl), {
      method: "PUT",
      headers: putHeaders,
      body: file,
    })
    // Some Supabase deployments expect POST to signed URL
    if (!putRes.ok) {
      const postRes = await fetch(String(intent.uploadUrl), {
        method: "POST",
        headers: putHeaders,
        body: file,
      })
      if (!postRes.ok) {
        return {
          ok: false,
          durable: false,
          error: "STORAGE_UPLOAD_FAILED",
          userMessage: mediaUserMessage("STORAGE_UPLOAD_FAILED"),
        }
      }
    }

    meta?.onProgress?.("Finalizing…")
    const completeRes = await fetchWithPiSessionRecovery("/api/media/direct-upload-complete", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        uploadId: intent.uploadId,
        objectPath: intent.objectPath,
        bucket: intent.bucket,
        mimeType,
        kind: intent.kind,
        byteSize: file.size,
        width: meta?.width,
        height: meta?.height,
        durationMs: meta?.durationMs,
        category: meta?.category,
      }),
    })
    const complete = (await completeRes.json().catch(() => ({}))) as Record<string, unknown>
    if (completeRes.ok && complete.ok === true && complete.url) {
      return {
        ok: true,
        durable: true,
        mediaId: String(complete.mediaId || complete.url),
        url: String(complete.url),
        kind:
          complete.kind === "video" ? "video" : complete.kind === "file" ? "file" : "image",
      }
    }
    const code = String(complete.error || `HTTP_${completeRes.status}`)
    return {
      ok: false,
      durable: false,
      error: code,
      userMessage: mediaUserMessage(code, String(complete.message || "") || undefined),
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


/** Safe message for failed uploads (success branch has no userMessage). */
export function mediaUploadErrorMessage(up: DurableMediaResult, fallback = "Upload failed"): string {
  if (up.ok) return fallback
  return String(up.userMessage || up.error || fallback)
}


/** True when server storage is missing or unreachable — client may use local image fallback. */
export function isMediaStorageUnavailable(error: string | undefined | null): boolean {
  const c = String(error || "").toUpperCase()
  return (
    c === "MEDIA_STORAGE_UNAVAILABLE" ||
    c === "MEDIA_STORAGE_CONFIGURATION_INVALID" ||
    c === "ASSET_RECORD_FAILED" ||
    c === "STORAGE_ERROR" ||
    c === "STORAGE_UPLOAD_FAILED" ||
    c === "HTTP_501" ||
    c === "HTTP_503" ||
    c.includes("MEDIA_STORAGE")
  )
}

export async function uploadDurableMedia(
  file: File | Blob,
  meta?: {
    width?: number
    height?: number
    durationMs?: number
    fileName?: string
    onProgress?: (label: string) => void
    category?: "avatars" | "images" | "videos" | "audio" | "documents"
  }
): Promise<DurableMediaResult> {
  const mimeType =
    (file.type || "").toLowerCase() ||
    (meta?.fileName?.match(/\.pdf$/i) ? "application/pdf" : meta?.fileName?.match(/\.mp3$/i) ? "audio/mpeg" : "application/octet-stream")
  let uploadFile: Blob = file
  let uploadName =
    meta?.fileName || (file instanceof File && file.name ? file.name : `media_${Date.now()}`)
  meta = { ...meta, category: meta?.category || (mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "videos" : mimeType === "application/pdf" ? "documents" : "images") }

  const isImage = mimeType.startsWith("image/")
  const isVideo = mimeType.startsWith("video/")
  const isAudio = mimeType.startsWith("audio/")
  const maxDirect = isImage
    ? MAX_DIRECT_IMAGE_BYTES
    : isVideo
      ? MAX_DIRECT_VIDEO_BYTES
      : isAudio
        ? MAX_DIRECT_AUDIO_BYTES
        : MAX_DIRECT_FILE_BYTES

  if (uploadFile.size > maxDirect) {
    return {
      ok: false,
      durable: false,
      error: "FILE_TOO_LARGE",
      userMessage: mediaUserMessage(
        "FILE_TOO_LARGE",
        `Maximum is ${Math.round(maxDirect / (1024 * 1024))}MB for this type.`
      ),
    }
  }

  // Prefer proxy for small files (simpler, one round-trip)
  if (uploadFile.size > SAFE_PROXY_UPLOAD_BYTES && isImage) {
    try {
      meta?.onProgress?.("Compressing photo…")
      const compressed = await compressOversizedImage(uploadFile)
      uploadFile = compressed
      uploadName = uploadName.replace(/\.[^.]+$/, "") + ".jpg"
    } catch {
      // Fall through to direct upload with original
    }
  }

  if (uploadFile.size <= SAFE_PROXY_UPLOAD_BYTES) {
    const proxy = await uploadViaProxy(uploadFile, uploadName, meta)
    if (proxy.ok) return proxy
    if (isMediaStorageUnavailable(proxy.error)) {
      return {
        ...proxy,
        error: "MEDIA_STORAGE_UNAVAILABLE",
        userMessage: mediaUserMessage("MEDIA_STORAGE_UNAVAILABLE", proxy.userMessage),
      }
    }
    // If proxy fails for size-related reasons, try direct
    if (
      proxy.error === "FILE_TOO_LARGE" ||
      proxy.error === "MEDIA_DIRECT_UPLOAD_REQUIRED" ||
      proxy.error.startsWith("HTTP_413")
    ) {
      return uploadViaDirect(
        uploadFile,
        isImage && uploadName.endsWith(".jpg") ? "image/jpeg" : mimeType,
        uploadName,
        meta
      )
    }
    return proxy
  }

  // Large file → direct-to-storage
  return uploadViaDirect(
    uploadFile,
    isImage && uploadName.endsWith(".jpg") ? "image/jpeg" : mimeType,
    uploadName,
    meta
  )
}
