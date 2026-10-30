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

  try {
    if ("requestIdleCallback" in window) {
      ;(window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(run, {
        timeout: 2500,
      })
    } else {
      window.setTimeout(run, 400)
    }
  } catch {
    window.setTimeout(run, 400)
  }
}
