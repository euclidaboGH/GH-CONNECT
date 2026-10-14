/**
 * User-facing media pipeline copy — never expose storage/RPC internals.
 */

export function mediaUserMessage(code: string | undefined, fallback?: string): string {
  const c = String(code || "").toUpperCase()
  switch (c) {
    case "AUTH_REQUIRED":
      return "Sign in to upload media."
    case "RATE_LIMITED":
      return "Too many uploads. Please wait a moment and try again."
    case "FILE_REQUIRED":
    case "INVALID_FORM":
    case "USE_MULTIPART":
      return "We couldn't read that file. Please try again."
    case "UNSUPPORTED_TYPE":
      return "That file type isn't supported. Try a photo, video, or PDF."
    case "FILE_TOO_LARGE":
      return "This file is too large for GreenHaven. Please choose a smaller file."
    case "MEDIA_STORAGE_UNAVAILABLE":
    case "ASSET_RECORD_FAILED":
    case "STORAGE_ERROR":
    case "STORAGE_UPLOAD_FAILED":
      return "Upload isn't available right now. Please try again in a moment."
    case "NETWORK":
      return "Connection issue while uploading. Check your network and retry."
    case "OPTIMIZE_FAILED":
      return "We couldn't optimize this file. Please try another file."
    case "INLINE_TOO_LARGE":
      return "This file is too large to attach offline. Connect and try again, or choose a smaller file."
    default:
      return fallback || "We couldn't process this file. Please try another."
  }
}

export const MEDIA_PROGRESS = {
  preparingPhoto: "Preparing photo…",
  compressing: "Compressing…",
  uploading: "Uploading…",
  ready: "Ready",
  preparingVideo: "Preparing video…",
  optimizingVideo: "Optimizing…",
  preparingFile: "Preparing file…",
} as const
