const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 40 * 1024 * 1024

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])

export function validateMediaFile(file: File, kind: "image" | "video") {
  const allowed = kind === "image" ? IMAGE_TYPES : VIDEO_TYPES
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  if (!allowed.has(file.type.toLowerCase())) {
    throw new Error(`Unsupported ${kind} format`)
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`${kind === "image" ? "Image" : "Video"} is too large`)
  }
  return file
}

export function validateImageFiles(files: File[], maxCount = 4) {
  return files.slice(0, maxCount).map((file) => validateMediaFile(file, "image"))
}

export const MEDIA_LIMITS = { maxImageBytes: MAX_IMAGE_BYTES, maxVideoBytes: MAX_VIDEO_BYTES, maxImages: 4 } as const
