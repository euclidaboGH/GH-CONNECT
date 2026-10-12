/**
 * Client media validation — prefer compress/normalize over hard rejection.
 * Hard limits still exist to protect devices and storage; they are aligned with
 * server /api/media and the client compressor.
 */

export type MediaValidateKind = "image" | "video" | "file"

/** Input caps (before compression). Output is much smaller for images. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_IMAGES_PER_POST = 10

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
])

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/m4v",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
  "video/x-mp4",
  "application/mp4",
])

const FILE_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
])

const IMAGE_EXT = new Set([
  "jpg", "jpeg", "jpe", "jfif", "png", "webp", "gif", "bmp", "avif", "heic", "heif",
])
const VIDEO_EXT = new Set([
  "mp4", "m4v", "webm", "mov", "qt", "3gp", "3g2", "mpeg", "mpg",
])
const FILE_EXT = new Set(["pdf"])

function extOf(name: string): string {
  const n = String(name || "").toLowerCase()
  const i = n.lastIndexOf(".")
  return i >= 0 ? n.slice(i + 1) : ""
}

/** Map empty/odd MIME from extension so mobile browsers do not hard-fail. */
export function normalizeMediaMime(file: File, kind: MediaValidateKind): string {
  const mime = (file.type || "").toLowerCase().trim()
  if (mime && mime !== "application/octet-stream") return mime
  const ext = extOf(file.name)
  if (kind === "image") {
    if (ext === "png") return "image/png"
    if (ext === "webp") return "image/webp"
    if (ext === "gif") return "image/gif"
    if (ext === "bmp") return "image/bmp"
    if (ext === "avif") return "image/avif"
    if (ext === "heic" || ext === "heif") return "image/heic"
    return "image/jpeg"
  }
  if (kind === "video") {
    if (ext === "webm") return "video/webm"
    if (ext === "mov" || ext === "qt") return "video/quicktime"
    if (ext === "3gp") return "video/3gpp"
    return "video/mp4"
  }
  return "application/pdf"
}

export function isLikelyImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (IMAGE_TYPES.has(mime) || mime.startsWith("image/")) return true
  return IMAGE_EXT.has(extOf(file.name))
}

export function isLikelyVideo(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (VIDEO_TYPES.has(mime) || mime.startsWith("video/")) return true
  return VIDEO_EXT.has(extOf(file.name))
}

export function isLikelyPdf(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (FILE_TYPES.has(mime)) return true
  return FILE_EXT.has(extOf(file.name))
}

/** Lightweight magic-byte check */
export function sniffMediaKind(bytes: Uint8Array): "image" | "video" | "file" | "unknown" {
  if (bytes.length < 12) return "unknown"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "file"
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video"
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video"
  return "unknown"
}

export async function sniffFileKind(file: File): Promise<"image" | "video" | "file" | "unknown"> {
  try {
    const buf = await file.slice(0, 16).arrayBuffer()
    return sniffMediaKind(new Uint8Array(buf))
  } catch {
    return "unknown"
  }
}

export type ValidateResult =
  | { ok: true; file: File; normalizedMime: string }
  | { ok: false; error: string; code: "UNSUPPORTED_TYPE" | "EMPTY" | "TOO_LARGE" }

/**
 * Soft validation: accept common mobile formats; only reject empty / extreme size / unknown kind.
 */
export function validateMediaFileSoft(file: File, kind: MediaValidateKind): ValidateResult {
  if (!file || file.size <= 0) {
    return { ok: false, code: "EMPTY", error: "This file appears empty. Please choose another." }
  }
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : kind === "video" ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return {
      ok: false,
      code: "TOO_LARGE",
      error:
        kind === "image"
          ? `Photo is over ${mb} MB. GreenHaven will compress normal camera photos — try a slightly smaller export or take the shot again.`
          : kind === "video"
            ? `Video is over ${mb} MB. Try a shorter clip or export at 720p/1080p.`
            : `File is over ${mb} MB. Please choose a smaller PDF.`,
    }
  }

  const mime = (file.type || "").toLowerCase()
  const ext = extOf(file.name)
  const allowed =
    kind === "image" ? IMAGE_TYPES : kind === "video" ? VIDEO_TYPES : FILE_TYPES
  const extOk =
    kind === "image" ? IMAGE_EXT.has(ext) : kind === "video" ? VIDEO_EXT.has(ext) : FILE_EXT.has(ext)

  // Empty or generic MIME: trust extension (common on iOS/Android)
  if (!mime || mime === "application/octet-stream") {
    if (extOk || !ext) {
      return { ok: true, file, normalizedMime: normalizeMediaMime(file, kind) }
    }
  }

  if (mime && allowed.has(mime)) {
    return { ok: true, file, normalizedMime: mime }
  }

  // image/* or video/* wildcards from some pickers
  if (kind === "image" && mime.startsWith("image/")) {
    return { ok: true, file, normalizedMime: mime }
  }
  if (kind === "video" && mime.startsWith("video/")) {
    return { ok: true, file, normalizedMime: mime }
  }

  if (extOk) {
    return { ok: true, file, normalizedMime: normalizeMediaMime(file, kind) }
  }

  return {
    ok: false,
    code: "UNSUPPORTED_TYPE",
    error:
      kind === "image"
        ? "We could not recognize this photo. Try JPG, PNG, WebP, GIF, or HEIC from your camera roll."
        : kind === "video"
          ? "We could not recognize this video. Try MP4, MOV, or WebM."
          : "Unsupported file type. PDF is supported for documents.",
  }
}

/**
 * Legacy throwing API used by existing call sites — softer errors, wider types.
 */
export function validateMediaFile(file: File, kind: MediaValidateKind): File {
  const r = validateMediaFileSoft(file, kind)
  if (!r.ok) throw new Error(r.error)
  return r.file
}

/**
 * Accept as many valid images as possible; skip failures instead of aborting the batch.
 */
export function validateImageFiles(files: File[], maxCount = MAX_IMAGES_PER_POST): File[] {
  const out: File[] = []
  for (const file of files.slice(0, maxCount * 2)) {
    if (out.length >= maxCount) break
    const r = validateMediaFileSoft(file, "image")
    if (r.ok) out.push(r.file)
  }
  return out
}

export const MEDIA_LIMITS = {
  maxImageBytes: MAX_IMAGE_BYTES,
  maxVideoBytes: MAX_VIDEO_BYTES,
  maxFileBytes: MAX_FILE_BYTES,
  maxImages: MAX_IMAGES_PER_POST,
} as const
