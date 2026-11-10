"use client"

import { forwardRef, useEffect, useState, type VideoHTMLAttributes } from "react"
import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"

type DurableVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string }

/** Video element that resolves private /api/media facade URLs for the active viewer session. */
export const DurableVideo = forwardRef<HTMLVideoElement, DurableVideoProps>(function DurableVideo({
  src,
  className = "",
  poster,
  controls = false,
  muted = true,
  playsInline = true,
  autoPlay = false,
  loop = false,
  preload = "metadata",
  ...videoProps
}, ref) {
  const [playSrc, setPlaySrc] = useState<string | null>(null)
  const [viewerEpoch, setViewerEpoch] = useState(0)

  useEffect(() => {
    const onMediaSessionChange = () => {
      setPlaySrc(null)
      setViewerEpoch((value) => value + 1)
    }
    window.addEventListener("ghc:media-session-change", onMediaSessionChange)
    return () => window.removeEventListener("ghc:media-session-change", onMediaSessionChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    const raw = String(src || "").trim()
    setPlaySrc(null)
    if (!raw) return () => { cancelled = true }
    if (!isMediaFacadeUrl(raw)) {
      setPlaySrc(raw)
      return () => { cancelled = true }
    }
    void resolveDisplayMediaUrl(raw).then((resolved) => {
      if (!cancelled) setPlaySrc(resolved || raw)
    })
    return () => { cancelled = true }
  }, [src, viewerEpoch])

  if (!playSrc) return <div className={`bg-black/80 ${className}`} aria-hidden />

  return (
    <video
      {...videoProps}
      ref={ref}
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
})
