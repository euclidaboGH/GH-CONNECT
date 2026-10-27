/**
 * Client-side media download helpers.
 * Resolves private facade URLs → signed URL, then triggers a file download.
 * Fail-soft: never throws to the UI layer; returns a result object.
 */

import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"

export type DownloadMediaResult =
  | { ok: true; filename: string; via: "anchor" | "share" | "open" }
  | { ok: false; error: string }

function guessExtension(url: string, kind?: "image" | "video"): string {
  const lower = url.toLowerCase().split("?")[0]
  if (/\.jpe?g$/i.test(lower)) return "jpg"
  if (/\.png$/i.test(lower)) return "png"
  if (/\.webp$/i.test(lower)) return "webp"
  if (/\.gif$/i.test(lower)) return "gif"
  if (/\.mp4$/i.test(lower)) return "mp4"
  if (/\.webm$/i.test(lower)) return "webm"
  if (/\.mov$/i.test(lower)) return "mov"
  return kind === "video" ? "mp4" : "jpg"
}

function buildFilename(opts?: { filename?: string; kind?: "image" | "video"; url?: string }): string {
  if (opts?.filename && opts.filename.trim()) {
    const base = opts.filename.trim().replace(/[^\w.\-]+/g, "_").slice(0, 80)
    if (/\.\w{2,5}$/.test(base)) return base
    return `${base}.${guessExtension(opts.url || "", opts.kind)}`
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const ext = guessExtension(opts?.url || "", opts?.kind)
  return `greenhaven-${opts?.kind === "video" ? "video" : "photo"}-${stamp}.${ext}`
}

function toast(message: string, type: "success" | "error" | "info" = "info") {
  try {
    window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message, type } }))
  } catch {
    /* */
  }
}

/**
 * Resolve a displayable absolute URL for download (signed if facade).
 */
export async function resolveDownloadableUrl(src: string): Promise<string | null> {
  const raw = String(src || "").trim()
  if (!raw) return null
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw
  if (isMediaFacadeUrl(raw)) {
    const signed = await resolveDisplayMediaUrl(raw)
    if (signed) return signed
  }
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw
  return null
}

/**
 * Download media to the device. Prefer fetch→blob→object URL so CORS-safe
 * signed URLs still get a proper filename. Falls back to opening the URL.
 */
export async function downloadMedia(
  src: string,
  opts?: { filename?: string; kind?: "image" | "video"; silent?: boolean },
): Promise<DownloadMediaResult> {
  const resolved = await resolveDownloadableUrl(src)
  if (!resolved) {
    if (!opts?.silent) toast("Could not download — media unavailable", "error")
    return { ok: false, error: "UNAVAILABLE" }
  }

  const filename = buildFilename({ ...opts, url: resolved })

  // Prefer Web Share with files when available (Pi / mobile)
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
      const res = await fetch(resolved, { mode: "cors", credentials: "omit", cache: "no-store" })
      if (res.ok) {
        const blob = await res.blob()
        const file = new File([blob], filename, { type: blob.type || (opts?.kind === "video" ? "video/mp4" : "image/jpeg") })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "GreenHaven media" })
          if (!opts?.silent) toast("Shared / saved", "success")
          return { ok: true, filename, via: "share" }
        }
      }
    }
  } catch {
    /* fall through to anchor download */
  }

  // Classic download via blob URL (better filename support)
  try {
    const res = await fetch(resolved, { mode: "cors", credentials: "omit", cache: "no-store" })
    if (res.ok) {
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = filename
      a.rel = "noopener"
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4_000)
      if (!opts?.silent) toast("Download started", "success")
      return { ok: true, filename, via: "anchor" }
    }
  } catch {
    /* CORS or network — open in new tab as last resort */
  }

  try {
    const a = document.createElement("a")
    a.href = resolved
    a.download = filename
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (!opts?.silent) toast("Opened media — long-press to save if download did not start", "info")
    return { ok: true, filename, via: "open" }
  } catch {
    if (!opts?.silent) toast("Download is not available in this browser", "error")
    return { ok: false, error: "UNSUPPORTED" }
  }
}

/** Share media URL via Web Share API or clipboard. */
export async function shareMediaUrl(src: string, title = "GreenHaven media"): Promise<boolean> {
  const resolved = await resolveDownloadableUrl(src)
  const link = resolved || String(src || "").trim()
  if (!link) {
    toast("Nothing to share", "error")
    return false
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, url: link.startsWith("http") ? link : undefined, text: link })
      return true
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link)
      toast("Link copied", "success")
      return true
    }
  } catch {
    /* */
  }
  toast("Share is not available", "error")
  return false
}
