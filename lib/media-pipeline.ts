/**
 * Canonical production media pipeline:
 * select → validate → compress/transform → upload → receive reference → store reference
 *
 * Do NOT persist large Base64 inside posts, messages, or profiles when an upload
 * endpoint is available. Local/offline may use short-lived object URLs or compact previews.
 */

import {
  validateMediaFile,
  validateImageFiles,
  MEDIA_LIMITS,
} from "./media-validation"
import { compressImage } from "./ghc-data"
import { resolveApiBaseUrl } from "./domains/http-repositories"

export type MediaKind = "image" | "video"

export type MediaPipelineStage =
  | "selected"
  | "validated"
  | "transformed"
  | "uploading"
  | "uploaded"
  | "failed"

export interface MediaReference {
  /** Stable URL or storage key — preferred form in posts/messages/profiles */
  url: string
  kind: MediaKind
  mimeType: string
  byteSize?: number
  width?: number
  height?: number
  /** True when url is still a data: URI (fallback only) */
  isInlineData?: boolean
  /** Object URL that must be revoked when no longer needed */
  objectUrl?: string
  provider?: "local" | "http" | "cdn"
}

export interface MediaPipelineResult {
  ok: true
  stage: MediaPipelineStage
  reference: MediaReference
  /** Compact preview data-URL for optimistic UI only — do not persist long-term */
  previewDataUrl?: string
}

export interface MediaPipelineError {
  ok: false
  stage: MediaPipelineStage
  error: string
}

export type MediaPipelineOutcome = MediaPipelineResult | MediaPipelineError

export interface MediaPipelineOptions {
  kind: MediaKind
  /** Max dimension for image transform (default 1200 production, 600 legacy compress) */
  maxDimension?: number
  /** JPEG quality 0–1 */
  quality?: number
  /** Prefer uploading when API base is configured */
  upload?: boolean
  /** Override upload path (default /media) */
  uploadPath?: string
  getAuthHeaders?: () => Record<string, string>
  /** Allow inline data URL fallback when upload unavailable (offline prototype) */
  allowInlineFallback?: boolean
}

const DEFAULT_MAX_DIM = 1200
const DEFAULT_QUALITY = 0.8
/** Soft warn if inline data would exceed this (posts should not store large base64) */
export const INLINE_WARN_BYTES = 120_000

function isDataUrl(s: string) {
  return s.startsWith("data:")
}

/**
 * Transform image via canvas — returns Blob (preferred) not only data URL.
 */
export async function transformImageToBlob(
  file: File,
  maxDimension = DEFAULT_MAX_DIM,
  quality = DEFAULT_QUALITY
): Promise<{ blob: Blob; width: number; height: number; previewDataUrl: string }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback path for older WebViews
    const dataUrl = await compressImage(file)
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return createImageBitmap(blob)
  })

  let width = bitmap.width
  let height = bitmap.height
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width)
      width = maxDimension
    } else {
      width = Math.round((width * maxDimension) / height)
      height = maxDimension
    }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image transform failed"))),
      "image/jpeg",
      quality
    )
  })

  const previewDataUrl = canvas.toDataURL("image/jpeg", Math.min(quality, 0.7))

  return { blob, width, height, previewDataUrl }
}

/**
 * Upload blob to backend media endpoint; returns storage URL/key.
 */
export async function uploadMediaBlob(
  blob: Blob,
  opts: {
    path?: string
    mimeType: string
    getAuthHeaders?: () => Record<string, string>
    fileName?: string
  }
): Promise<{ url: string }> {
  const base = resolveApiBaseUrl()
  if (!base) throw new Error("No media upload endpoint configured")

  const form = new FormData()
  form.append("file", blob, opts.fileName || `media_${Date.now()}.jpg`)
  form.append("mimeType", opts.mimeType)

  const res = await fetch(`${base.replace(/\/$/, "")}${opts.path || "/media"}`, {
    method: "POST",
    headers: {
      ...(opts.getAuthHeaders?.() || {}),
    },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Upload failed (${res.status})`)
  }
  const data = (await res.json()) as { url?: string; key?: string }
  const url = data.url || data.key
  if (!url) throw new Error("Upload response missing media reference")
  return { url }
}

/**
 * Full pipeline for a single file.
 */
export async function processMediaFile(
  file: File,
  options: MediaPipelineOptions
): Promise<MediaPipelineOutcome> {
  let stage: MediaPipelineStage = "selected"
  try {
    stage = "validated"
    validateMediaFile(file, options.kind)

    stage = "transformed"
    if (options.kind === "image") {
      const { blob, width, height, previewDataUrl } = await transformImageToBlob(
        file,
        options.maxDimension ?? DEFAULT_MAX_DIM,
        options.quality ?? DEFAULT_QUALITY
      )

      const shouldUpload =
        options.upload !== false && Boolean(resolveApiBaseUrl())

      if (shouldUpload) {
        stage = "uploading"
        const { url } = await uploadMediaBlob(blob, {
          path: options.uploadPath,
          mimeType: blob.type || "image/jpeg",
          getAuthHeaders: options.getAuthHeaders,
          fileName: file.name,
        })
        stage = "uploaded"
        return {
          ok: true,
          stage,
          reference: {
            url,
            kind: "image",
            mimeType: blob.type || "image/jpeg",
            byteSize: blob.size,
            width,
            height,
            isInlineData: false,
            provider: "http",
          },
          previewDataUrl,
        }
      }

      // Offline / no API: object URL preferred over huge base64 in state
      const objectUrl = URL.createObjectURL(blob)
      const allowInline = options.allowInlineFallback !== false
      if (blob.size > INLINE_WARN_BYTES && !allowInline) {
        return {
          ok: false,
          stage: "failed",
          error: "Media too large for inline storage — configure upload endpoint",
        }
      }

      stage = "uploaded"
      return {
        ok: true,
        stage,
        reference: {
          url: objectUrl,
          kind: "image",
          mimeType: blob.type || "image/jpeg",
          byteSize: blob.size,
          width,
          height,
          isInlineData: false,
          objectUrl,
          provider: "local",
        },
        previewDataUrl,
      }
    }

    // Video: validate + object URL / upload; no client re-encode in this phase
    stage = "transformed"
    const shouldUpload = options.upload !== false && Boolean(resolveApiBaseUrl())
    if (shouldUpload) {
      stage = "uploading"
      const { url } = await uploadMediaBlob(file, {
        path: options.uploadPath || "/media",
        mimeType: file.type,
        getAuthHeaders: options.getAuthHeaders,
        fileName: file.name,
      })
      stage = "uploaded"
      return {
        ok: true,
        stage,
        reference: {
          url,
          kind: "video",
          mimeType: file.type,
          byteSize: file.size,
          isInlineData: false,
          provider: "http",
        },
      }
    }

    const objectUrl = URL.createObjectURL(file)
    stage = "uploaded"
    return {
      ok: true,
      stage,
      reference: {
        url: objectUrl,
        kind: "video",
        mimeType: file.type,
        byteSize: file.size,
        objectUrl,
        provider: "local",
      },
    }
  } catch (e) {
    return {
      ok: false,
      stage: stage === "selected" ? "failed" : stage,
      error: e instanceof Error ? e.message : "Media processing failed",
    }
  }
}

/**
 * Process multiple images for a post (max from MEDIA_LIMITS).
 * Returns only stable references suitable for storing on the post.
 */
export async function processImagesForPost(
  files: File[],
  options?: Partial<MediaPipelineOptions>
): Promise<{
  references: MediaReference[]
  errors: string[]
  previews: string[]
}> {
  const validated = validateImageFiles(files, MEDIA_LIMITS.maxImages)
  const references: MediaReference[] = []
  const errors: string[] = []
  const previews: string[] = []

  for (const file of validated) {
    const outcome = await processMediaFile(file, {
      kind: "image",
      allowInlineFallback: true,
      ...options,
    })
    if (outcome.ok) {
      references.push(outcome.reference)
      if (outcome.previewDataUrl) previews.push(outcome.previewDataUrl)
    } else {
      errors.push(outcome.error)
    }
  }

  return { references, errors, previews }
}

/** Revoke object URLs when post is discarded or component unmounts */
export function revokeMediaReferences(refs: MediaReference[]) {
  for (const r of refs) {
    if (r.objectUrl) {
      try {
        URL.revokeObjectURL(r.objectUrl)
      } catch {
        /* */
      }
    }
  }
}

/** Guard: reject persisting huge data-URLs into entities */
export function assertSafeMediaRefsForStorage(urls: string[]): string | null {
  for (const u of urls) {
    if (isDataUrl(u) && u.length > INLINE_WARN_BYTES) {
      return "Inline media too large — use media pipeline upload references"
    }
  }
  return null
}

export { MEDIA_LIMITS, validateMediaFile, validateImageFiles }
