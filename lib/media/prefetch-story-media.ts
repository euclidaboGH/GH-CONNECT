/**
 * Phase 3 — idle prefetch for story media URLs (images only).
 * Never invents content; only warms cache for URLs already on the story item.
 */
export function prefetchStoryMediaUrls(urls: string[], limit = 6): void {
  if (typeof window === "undefined") return
  const unique = Array.from(
    new Set(
      urls
        .map((u) => String(u || "").trim())
        .filter((u) => u.startsWith("http") || u.startsWith("/api/media/")),
    ),
  ).slice(0, limit)

  const run = () => {
    for (const url of unique) {
      try {
        const img = new Image()
        img.decoding = "async"
        img.src = url
      } catch {
        /* ignore */
      }
    }
  }

  const scheduleFallback = () => globalThis.setTimeout(run, 400)

  try {
    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleWindow.requestIdleCallback(run, { timeout: 2500 })
    } else {
      scheduleFallback()
    }
  } catch {
    scheduleFallback()
  }
}
