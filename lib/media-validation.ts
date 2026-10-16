const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 40 * 1024 * 1024
const MAX_FILE_BYTES = 8 * 1024 * 1024

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])
const FILE_TYPES = new Set(["application/pdf", "application/x-pdf"])

export type MediaValidateKind = "image" | "video" | "file"

/** Lightweight magic-byte check (client or server buffer) */
export function sniffMediaKind(bytes: Uint8Array): "image" | "video" | "file" | "unknown" {
  if (bytes.length < 12) return "unknown"
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image"
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image"
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image"
  // WEBP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image"
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "file"
  // MP4 / QuickTime (ftyp at offset 4)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video"
  // WebM / Matroska
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

export function validateMediaFile(file: File, kind: MediaValidateKind) {
  const allowed = kind === "image" ? IMAGE_TYPES : kind === "video" ? VIDEO_TYPES : FILE_TYPES
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : kind === "video" ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  const mime = (file.type || "").toLowerCase()
  if (mime && !allowed.has(mime)) {
    // Allow empty MIME on some mobile browsers — size still enforced; signature checked at upload
    if (mime.length > 0) {
      throw new Error(
        kind === "image"
          ? "Unsupported photo format. Use JPG, PNG, WebP, or GIF."
          : kind === "video"
            ? "Unsupported video format. Use MP4 or WebM."
            : "Unsupported file type. PDF is supported."
      )
    }
  }
  if (file.size <= 0) {
    throw new Error("This file appears empty. Please choose another.")
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    throw new Error(`This file is too large for GreenHaven. Please choose a file under ${mb} MB.`)
  }
  return file
}

export function validateImageFiles(files: File[], maxCount = 10) {
  return files.slice(0, maxCount).map((file) => validateMediaFile(file, "image"))
}

export const MEDIA_LIMITS = {
  maxImageBytes: MAX_IMAGE_BYTES,
  maxVideoBytes: MAX_VIDEO_BYTES,
  maxFileBytes: MAX_FILE_BYTES,
  maxImages: 10,
} as const
