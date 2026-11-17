/**
 * Phase 10 — bounded idle prefetch for story media URLs.
 * Only warms URLs already present on visible story items; never invents content.
 */
import { shouldPrefetchNonCritical, scheduleNonCriticalWork } from "@/lib/mobile-performance"

export function prefetchStoryMediaUrls(urls: string[], limit = 3): void {
  if (typeof window === "undefined" || !Array.isArray(urls) || urls.length === 0) return
  if (!shouldPrefetchNonCritical()) return

  const unique = Array.from(new Set(
    urls.map((url) => String(url || "").trim())
      .filter((url) => url.startsWith("https://") || url.startsWith("/api/media/")),
  )).slice(0, Math.max(0, Math.min(3, limit)))
  if (unique.length === 0) return

  scheduleNonCriticalWork(() => {
    if (!shouldPrefetchNonCritical()) return
    for (const url of unique) {
      try {
        const image = new Image()
        image.decoding = "async"
        image.loading = "lazy"
        image.src = url
      } catch {
        // Best effort only; visible story content remains independently loadable.
      }
    }
  }, 1800)
}
