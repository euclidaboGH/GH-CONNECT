/**
 * Client + shared media validation for compose / pipeline.
 * Limits align with private Supabase bucket (50 MB).
 */

const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_AUDIO_BYTES = 50 * 1024 * 1024

export const MEDIA_LIMITS = {
  imageBytes: MAX_IMAGE_BYTES,
  videoBytes: MAX_VIDEO_BYTES,
  fileBytes: MAX_FILE_BYTES,
  audioBytes: MAX_AUDIO_BYTES,
  maxImagesPerPost: 10,
  maxVideosPerPost: 1,
} as const

export function mediaByteLimit(kind: "image" | "video" | "file" | "audio"): number {
  if (kind === "video") return MAX_VIDEO_BYTES
  if (kind === "audio") return MAX_AUDIO_BYTES
  if (kind === "file") return MAX_FILE_BYTES
  return MAX_IMAGE_BYTES
}

export function isAllowedImageMime(mime: string): boolean {
  const m = String(mime || "").toLowerCase()
  return ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"].includes(m)
}

export function isAllowedVideoMime(mime: string): boolean {
  const m = String(mime || "").toLowerCase()
  return ["video/mp4", "video/webm", "video/quicktime"].includes(m)
}

export function isAllowedAudioMime(mime: string): boolean {
  const m = String(mime || "").toLowerCase()
  return ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/webm", "audio/ogg"].includes(m)
}

export type MediaValidateKind = "image" | "video" | "file" | "audio"

export type MediaValidationResult =
  | { ok: true }
  | { ok: false; error: string }

/** Validate a single File for upload / compose. Throws or returns — pipeline uses throw style. */
export function validateMediaFile(file: File, kind: MediaValidateKind = "image"): void {
  if (!file || !(file instanceof File)) {
    throw new Error("No file selected")
  }
  const mime = String(file.type || "").toLowerCase()
  const limit = mediaByteLimit(kind)
  if (file.size <= 0) {
    throw new Error("File is empty")
  }
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024))
    throw new Error(`File too large (max ${mb} MB)`)
  }
  if (kind === "image") {
    if (mime && !isAllowedImageMime(mime)) {
      throw new Error("Unsupported image type. Use JPEG, PNG, WebP, GIF, or AVIF.")
    }
  } else if (kind === "video") {
    if (mime && !isAllowedVideoMime(mime)) {
      throw new Error("Unsupported video type. Use MP4, WebM, or MOV.")
    }
  } else if (kind === "audio") {
    if (mime && !isAllowedAudioMime(mime)) {
      throw new Error("Unsupported audio type.")
    }
  }
}

/** Soft result form for UI that prefers objects over throws. */
export function validateMediaFileResult(
  file: File,
  kind: MediaValidateKind = "image"
): MediaValidationResult {
  try {
    validateMediaFile(file, kind)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid file" }
  }
}

/**
 * Validate a batch of images for a post/gallery.
 * Returns null when ok, or an error string.
 */
export function validateImageFiles(files: File[]): string | null {
  if (!Array.isArray(files) || files.length === 0) return null
  if (files.length > MEDIA_LIMITS.maxImagesPerPost) {
    return `Too many images (max ${MEDIA_LIMITS.maxImagesPerPost})`
  }
  for (const file of files) {
    try {
      validateMediaFile(file, "image")
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid image"
    }
  }
  return null
}
