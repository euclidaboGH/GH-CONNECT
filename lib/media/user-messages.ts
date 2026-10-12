/**
 * User-facing media messages — never technical storage internals.
 */

export function mediaUserMessage(code: string, detail?: string): string {
  const c = String(code || "").toUpperCase()
  switch (c) {
    case "FILE_TOO_LARGE":
    case "INLINE_TOO_LARGE":
      return (
        detail ||
        "This file is still large after preparation. Try a shorter video or a normal-resolution photo — we compress automatically."
      )
    case "UNSUPPORTED_TYPE":
    case "UNSUPPORTED_MEDIA":
      return detail || "That format is not supported yet. Use JPG/PNG photos, MP4/MOV video, or PDF."
    case "MEDIA_STORAGE_UNAVAILABLE":
    case "STORAGE_ERROR":
    case "STORAGE_UNAVAILABLE":
      return (
        detail ||
        "Cloud media storage is not configured on this environment. Photos can still be compressed on-device; videos need storage to upload."
      )
    case "OPTIMIZE_FAILED":
      return detail || "We could not prepare this media. Try another file or a smaller export."
    case "NETWORK":
      return "Network issue while uploading. Check your connection and try again — your draft text is kept."
    case "AUTH_REQUIRED":
      return "Sign in to upload media."
    case "RATE_LIMITED":
      return "Too many uploads. Please wait a moment and try again."
    case "ASSET_RECORD_FAILED":
      return detail || "Upload may have partially succeeded. Please try again in a moment."
    default:
      return detail || "Could not add this media. Please try another file."
  }
}

export const MEDIA_PROGRESS = {
  preparingPhoto: "Preparing photo…",
  compressing: "Optimizing photo…",
  uploading: "Uploading…",
  preparingFile: "Preparing file…",
  preparingVideo: "Preparing video…",
  optimizingVideo: "Checking video…",
  ready: "Ready",
} as const
