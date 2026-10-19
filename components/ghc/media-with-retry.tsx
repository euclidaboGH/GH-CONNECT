"use client"

import { useState } from "react"
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
  if (!src || src.startsWith("blob:")) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/40 text-[11px] text-muted-foreground ${className}`}
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
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}
