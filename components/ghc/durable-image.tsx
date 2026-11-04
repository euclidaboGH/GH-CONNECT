"use client"

import { useEffect, useState, type ImgHTMLAttributes } from "react"
import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"

/**
 * Image element for public assets, local previews and private GreenHaven media.
 * Private facade URLs are resolved only for the active viewer session and are
 * discarded when the account changes. Native image attributes are preserved.
 */
export function DurableImage({
  src,
  referrerPolicy = "no-referrer",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [viewerEpoch, setViewerEpoch] = useState(0)
  const [resolved, setResolved] = useState<{ source: string; url: string | null } | null>(null)
  const raw = typeof src === "string" ? src.trim() : ""

  useEffect(() => {
    const onSessionChange = () => {
      setResolved(null)
      setViewerEpoch((value) => value + 1)
    }
    window.addEventListener("ghc:media-session-change", onSessionChange)
    return () => window.removeEventListener("ghc:media-session-change", onSessionChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    setResolved(null)
    if (!raw) return () => { cancelled = true }
    if (!isMediaFacadeUrl(raw)) {
      setResolved({ source: raw, url: raw })
      return () => { cancelled = true }
    }
    void resolveDisplayMediaUrl(raw).then((url) => {
      if (!cancelled) setResolved({ source: raw, url: url || raw })
    })
    return () => { cancelled = true }
  }, [raw, viewerEpoch])

  const displaySrc = resolved?.source === raw ? resolved.url || undefined : undefined
  return <img {...props} src={displaySrc} referrerPolicy={referrerPolicy} />
}
