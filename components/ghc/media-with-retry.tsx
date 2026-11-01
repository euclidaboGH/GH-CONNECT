"use client"

import { useState } from "react"
import { optimizedImageUrl, preferReducedData } from "@/lib/mobile-performance"
import { RefreshCw } from "lucide-react"

/** Image that shows a retry control when load fails (no blank gray plate). */
export function MediaWithRetry({
  src,
  alt = "",
  className = "",
}: {
  src: string
  alt?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)
  const reducedData = preferReducedData()
  if (!src || src.startsWith("blob:")) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/40 text-[11px] text-muted-foreground ${className}`}
        role="img"
        aria-label={alt ? `${alt} — media unavailable` : "Media unavailable"}
      >
        Media unavailable
      </div>
    )
  }
  if (failed) {
    return (
      <button
        type="button"
        className={`flex flex-col items-center justify-center gap-1 bg-muted/30 text-[11px] text-muted-foreground ${className}`}
        onClick={() => {
          setFailed(false)
          setNonce((n) => n + 1)
        }}
        aria-label={alt ? `Retry loading ${alt}` : "Retry loading media"}
      >
        <RefreshCw size={16} aria-hidden />
        Tap to retry image
      </button>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={nonce}
      src={optimizedImageUrl(src, reducedData ? 480 : 720)}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      style={{ backgroundColor: "var(--muted, rgba(128,128,128,.08))" }}
    />
  )
}
