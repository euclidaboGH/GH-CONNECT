/**
 * Pi Browser native helpers (share + capability probes).
 *
 * Uses official client SDK surface when present:
 * - Pi.openShareDialog(title, message) — text share via OS sheet
 * - Pi.shareFile(...) — file/video share (Sep 2026 capability)
 *
 * Outside Pi Browser, falls back to Web Share API / clipboard.
 * Never throws into the UI — always returns a structured result.
 */

export type PiNativeShareResult =
  | { ok: true; method: "pi.shareFile" | "pi.openShareDialog" | "web-share" | "clipboard" }
  | { ok: false; error: string; cancelled?: boolean }

function getPi(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { Pi?: Record<string, unknown> }
  return w.Pi && typeof w.Pi === "object" ? w.Pi : null
}

/**
 * Best-effort host detection for choosing the Pi SDK sign-in path. This is
 * only a UX hint; it never authenticates a user or grants payment authority.
 * Pi Browser can expose its user-agent before the SDK bridge is initialized.
 */
export function isPiBrowserRuntime(): boolean {
  if (getPi()) return true
  if (typeof window === "undefined") return false
  // Common Pi webview / bridge globals (vary by SDK generation)
  const w = window as unknown as Record<string, unknown>
  if (w.PiApp || w.PiNetwork || w.__PI_BROWSER__ || w.piNetwork) return true
  if (typeof navigator === "undefined") return false
  const ua = String(navigator.userAgent || "")
  if (/PiBrowser|Pi\s*Network|minepi|Pi\s*Browser|PiWebView|Pi\/|\bPiOS\b/i.test(ua)) return true
  // Android WebView packaging sometimes omits "PiBrowser" but includes host app markers
  if (/wv\)/i.test(ua) && /pi\.network|minepi\.com/i.test(ua)) return true
  try {
    const ref = String(document.referrer || "")
    if (/minepi\.com|pi\.app|pinet\.com/i.test(ref)) return true
  } catch { /* */ }
  return false
}

export function canOpenShareDialog(): boolean {
  const Pi = getPi()
  return typeof Pi?.openShareDialog === "function"
}

export function canShareFile(): boolean {
  const Pi = getPi()
  return typeof Pi?.shareFile === "function"
}

export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function"
}

/**
 * Share plain text / invite link using Pi native dialog or Web Share / clipboard.
 */
export async function shareText(options: {
  title: string
  message: string
  url?: string
}): Promise<PiNativeShareResult> {
  const title = String(options.title || "GreenHaven").trim()
  const message = String(options.message || "").trim()
  const url = options.url?.trim()
  const body = url ? `${message}${message ? "\n\n" : ""}${url}` : message

  const Pi = getPi()
  if (Pi && typeof Pi.openShareDialog === "function") {
    try {
      ;(Pi.openShareDialog as (t: string, m: string) => void)(title, body)
      return { ok: true, method: "pi.openShareDialog" }
    } catch (e) {
      // fall through
      console.warn("[pi-native] openShareDialog failed", e)
    }
  }

  if (canWebShare()) {
    try {
      await navigator.share({
        title,
        text: message,
        url: url || undefined,
      })
      return { ok: true, method: "web-share" }
    } catch (e) {
      const err = e as { name?: string; message?: string }
      if (err?.name === "AbortError") {
        return { ok: false, error: "Share cancelled", cancelled: true }
      }
      // fall through to clipboard
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(body || title)
      return { ok: true, method: "clipboard" }
    }
  } catch {
    /* */
  }

  return {
    ok: false,
    error: "Sharing is not available on this device. Copy the link manually.",
  }
}

/**
 * Share a file/blob via Pi.shareFile when available, else Web Share with files.
 * Accepts File | Blob | string (URL — may not work in all WebViews).
 */
export async function shareFile(options: {
  file?: File | Blob | null
  /** Remote or object URL — used when file is not provided */
  fileUrl?: string
  filename?: string
  mimeType?: string
  title?: string
  message?: string
}): Promise<PiNativeShareResult> {
  const title = String(options.title || "GreenHaven").trim()
  const message = String(options.message || "").trim()
  const Pi = getPi()

  // Prefer official Pi.shareFile when present (whitelist / Pi Browser capability)
  if (Pi && typeof Pi.shareFile === "function") {
    try {
      const shareFileFn = Pi.shareFile as (arg: unknown) => Promise<unknown> | unknown
      // Support both object and positional styles defensively
      const payload: Record<string, unknown> = {
        title,
        message,
        filename: options.filename,
        mimeType: options.mimeType,
      }
      if (options.file) payload.file = options.file
      if (options.fileUrl) payload.url = options.fileUrl
      await Promise.resolve(shareFileFn(payload))
      return { ok: true, method: "pi.shareFile" }
    } catch (e) {
      const err = e as { name?: string; message?: string }
      if (err?.name === "AbortError" || /cancel/i.test(String(err?.message || ""))) {
        return { ok: false, error: "Share cancelled", cancelled: true }
      }
      console.warn("[pi-native] shareFile failed, trying fallbacks", e)
    }
  }

  // Web Share Level 2 (files)
  if (options.file && canWebShare() && typeof navigator.canShare === "function") {
    try {
      const file =
        options.file instanceof File
          ? options.file
          : new File(
              [options.file],
              options.filename || "share.bin",
              { type: options.mimeType || options.file.type || "application/octet-stream" }
            )
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: message,
        })
        return { ok: true, method: "web-share" }
      }
    } catch (e) {
      const err = e as { name?: string }
      if (err?.name === "AbortError") {
        return { ok: false, error: "Share cancelled", cancelled: true }
      }
    }
  }

  // Last resort: share text/link only
  return shareText({
    title,
    message: message || "Shared from GreenHaven",
    url: options.fileUrl,
  })
}

/** Probe for diagnostics / health panels */
export function probePiNative(): {
  hasPi: boolean
  openShareDialog: boolean
  shareFile: boolean
  webShare: boolean
} {
  return {
    hasPi: isPiBrowserRuntime(),
    openShareDialog: canOpenShareDialog(),
    shareFile: canShareFile(),
    webShare: canWebShare(),
  }
}
