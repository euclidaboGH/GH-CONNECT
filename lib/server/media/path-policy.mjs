/** Shared media storage path and metadata policy. Server-only callers use session-derived owner IDs. */
export const MEDIA_CATEGORIES = Object.freeze(["audio", "documents", "avatars", "images", "videos"])
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024

const MIME_EXTENSIONS = Object.freeze({
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov"],
  "application/pdf": ["pdf"],
  "audio/mpeg": ["mp3"],
  "audio/mp4": ["m4a"],
  "audio/aac": ["aac"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
  "audio/webm": ["webm"],
  "audio/flac": ["flac"],
})
const MIME_KIND = Object.freeze({
  image: new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
  file: new Set(["application/pdf", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/flac"]),
})

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.([a-z0-9]{2,5})$/i

export function isSafeMediaBucket(bucket) {
  return typeof bucket === "string" && /^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucket)
}

export function isSafeMediaOwnerId(ownerId) {
  return typeof ownerId === "string" && ownerId.length > 0 && ownerId.length <= 256 &&
    !/[\\/\u0000-\u001f\u007f]/.test(ownerId) && ownerId !== "." && ownerId !== ".."
}

export function buildOwnedMediaPath(ownerId, category, fileName) {
  if (!isSafeMediaOwnerId(ownerId) || !MEDIA_CATEGORIES.includes(category)) return null
  const parsed = typeof fileName === "string" ? UUID_FILENAME.exec(fileName) : null
  if (!parsed || !Object.values(MIME_EXTENSIONS).some((extensions) => extensions.includes(parsed[1].toLowerCase()))) return null
  return `${ownerId}/${category}/${fileName}`
}

export function parseOwnedMediaPath(ownerId, storagePath) {
  if (!isSafeMediaOwnerId(ownerId) || typeof storagePath !== "string" || storagePath.length > 1024) return null
  if (storagePath.startsWith("/") || storagePath.includes("\\") || /[\u0000-\u001f\u007f]/.test(storagePath)) return null
  const parts = storagePath.split("/")
  if (parts.length !== 3 || parts[0] !== ownerId || !MEDIA_CATEGORIES.includes(parts[1])) return null
  if (parts.some((part) => !part || part === "." || part === "..")) return null
  const match = UUID_FILENAME.exec(parts[2])
  if (!match || !Object.values(MIME_EXTENSIONS).some((extensions) => extensions.includes(match[1].toLowerCase()))) return null
  return { ownerId: parts[0], category: parts[1], fileName: parts[2], extension: match[1].toLowerCase() }
}


export function mediaCategoryMatches(category, mediaKind, mimeType) {
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
  if (mediaKind === "image") return category === "images" || category === "avatars"
  if (mediaKind === "video") return category === "videos"
  if (mediaKind === "file") return mime === "application/pdf" ? category === "documents" : category === "audio"
  return false
}

export function validateMediaMetadata(input) {
  const { mediaKind, mimeType, byteSize, width = null, height = null, durationMs = null } = input || {}
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
  if (!MIME_KIND[mediaKind]?.has(mime)) return "MIME_KIND_MISMATCH"
  const maximumBytes = 50 * 1024 * 1024
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > maximumBytes) return "INVALID_BYTE_SIZE"
  const widthMax = 20_000
  const durationMax = 12 * 60 * 60 * 1000
  for (const [name, value, max] of [["width", width, widthMax], ["height", height, widthMax], ["durationMs", durationMs, durationMax]]) {
    if (value != null && (!Number.isSafeInteger(value) || value < 0 || value > max)) return `INVALID_${name.toUpperCase()}`
  }
  return null
}

export function mediaExtensionMatchesMime(fileName, mimeType) {
  const match = typeof fileName === "string" ? UUID_FILENAME.exec(fileName) : null
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
  return Boolean(match && MIME_EXTENSIONS[mime]?.includes(match[1].toLowerCase()))
}
