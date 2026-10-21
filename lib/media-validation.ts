const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_AUDIO_BYTES = 50 * 1024 * 1024

export function mediaByteLimit(kind: "image" | "video" | "file" | "audio"): number {
  if (kind === "video") return MAX_VIDEO_BYTES
  if (kind === "audio") return MAX_AUDIO_BYTES
  if (kind === "file") return MAX_FILE_BYTES
  return MAX_IMAGE_BYTES
}

export function isAllowedImageMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(mime)
}

export function isAllowedVideoMime(mime: string): boolean {
  return ["video/mp4", "video/webm", "video/quicktime"].includes(mime)
}
