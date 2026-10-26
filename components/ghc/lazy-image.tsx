"use client"

import { memo, useEffect, useState } from "react"
import { ImageSkeleton } from "./skeleton-loaders"
import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"

interface LazyImageProps {
  src?: string | null
  alt?: string | null
  className?: string
  onLoad?: () => void
  onError?: () => void
  onClick?: () => void
  online?: boolean
  verified?: boolean
}

function LazyImageInner({
  src,
  alt,
  className = "",
  onLoad,
  onError,
  onClick,
  online = false,
  verified = false,
}: LazyImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const safeAlt = alt ?? "Member"
  const rawSrc = typeof src === "string" && src.trim() ? src.trim() : ""
  const initials =
    safeAlt
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"

  useEffect(() => {
    setRetryToken(0)
  }, [rawSrc])

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setDisplaySrc(null)

    if (!rawSrc) {
      setStatus("error")
      return
    }

    // Direct non-facade sources (http, data, relative non-api)
    if (!isMediaFacadeUrl(rawSrc)) {
      if (
        rawSrc.startsWith("https://") ||
        rawSrc.startsWith("http://") ||
        rawSrc.startsWith("data:") ||
        rawSrc.startsWith("blob:") ||
        rawSrc.startsWith("/")
      ) {
        if (!cancelled) setDisplaySrc(rawSrc)
      } else {
        if (!cancelled) setStatus("error")
      }
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      const resolved = await resolveDisplayMediaUrl(rawSrc)
      if (cancelled) return
      if (resolved) {
        setDisplaySrc(resolved)
      } else {
        // Fallback: try the content facade itself (cookies + redirect)
        setDisplaySrc(rawSrc.startsWith("http") ? rawSrc : rawSrc.startsWith("/") ? rawSrc : null)
        if (!rawSrc.startsWith("http") && !rawSrc.startsWith("/")) setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawSrc, retryToken])

  const handleImgError = () => {
    if (retryToken < 1 && rawSrc && isMediaFacadeUrl(rawSrc)) {
      setRetryToken(1)
      setStatus("loading")
      setDisplaySrc(null)
      return
    }
    setStatus("error")
    onError?.()
  }

  if (status === "error" || (!displaySrc && status !== "loading")) {
    return (
      <div onClick={onClick} className={`relative overflow-hidden bg-muted ${className}`}>
        <div className="flex h-full min-h-[2.5rem] w-full items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-[11px] font-bold text-muted-foreground">
          {initials}
        </div>
        <span className="sr-only">{safeAlt} photo unavailable</span>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden ${
        status === "loading" ? "bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" : "bg-transparent"
      } ${className}`}
    >
      {status === "loading" && <ImageSkeleton className="absolute inset-0" />}
      {displaySrc ? (
        <img
          key={displaySrc}
          src={displaySrc}
          alt={safeAlt}
          onClick={onClick}
          className={`${
            className.includes("h-full") || className.includes("absolute")
              ? "absolute inset-0 h-full w-full"
              : "h-full w-full"
          } object-cover transition-opacity duration-200 ${status === "loading" ? "opacity-0" : "opacity-100"}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{ contentVisibility: "auto", contain: "paint" }}
          onLoad={() => {
            setStatus("loaded")
            onLoad?.()
          }}
          onError={handleImgError}
        />
      ) : null}
      {(online || verified) && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5">
          <span className="sr-only">
            {online ? "Online" : "Offline"}
            {verified ? ", verified" : ""}
          </span>
          {online && (
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" aria-hidden="true" />
          )}
          {verified && (
            <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm" aria-hidden="true">
              ✓
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const LazyImage = memo(LazyImageInner)
