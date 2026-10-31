"use client"

import { useEffect, useState } from "react"
import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"

/**
 * Video element that resolves private /api/media facade URLs to signed playback URLs.
 */
export function DurableVideo({
  src,
  className = "",
  poster,
  controls = false,
  muted = true,
  playsInline = true,
  autoPlay = false,
  loop = false,
  preload = "metadata",
}: {
  src: string
  className?: string
  poster?: string
  controls?: boolean
  muted?: boolean
  playsInline?: boolean
  autoPlay?: boolean
  loop?: boolean
  preload?: "none" | "metadata" | "auto"
}) {
  const [playSrc, setPlaySrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const raw = String(src || "").trim()
    if (!raw) {
      setPlaySrc(null)
      return
    }
    if (!isMediaFacadeUrl(raw)) {
      setPlaySrc(raw)
      return
    }
    void resolveDisplayMediaUrl(raw).then((resolved) => {
      if (!cancelled) setPlaySrc(resolved || raw)
    })
    return () => {
      cancelled = true
    }
  }, [src])

  if (!playSrc) {
    return <div className={`bg-black/80 ${className}`} aria-hidden />
  }

  return (
    <video
      key={playSrc}
      src={playSrc}
      poster={poster}
      className={className}
      controls={controls}
      muted={muted}
      playsInline={playsInline}
      autoPlay={autoPlay}
      loop={loop}
      preload={preload}
    />
  )
}
