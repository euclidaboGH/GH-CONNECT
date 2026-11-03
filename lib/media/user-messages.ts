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
      return "That file type isn't supported. Try a photo, video, audio file, or PDF."
    case "FILE_TOO_LARGE":
      return "This file is too large for GreenHaven. Please choose a smaller file."
    case "MEDIA_DIRECT_UPLOAD_REQUIRED":
      return "This file needs a secure direct upload. Please stay online and try again — photos up to 25MB and videos up to 40MB are supported when connected."
    case "MEDIA_STORAGE_UNAVAILABLE":
    case "MEDIA_STORAGE_CONFIGURATION_INVALID":
    case "ASSET_RECORD_FAILED":
    case "STORAGE_ERROR":
    case "STORAGE_UPLOAD_FAILED":
    case "HTTP_501":
    case "HTTP_503":
      return "Photo storage is not ready on the server yet. Photos can stay on this device for now — ask the operator to set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GH_MEDIA_BUCKET."
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
