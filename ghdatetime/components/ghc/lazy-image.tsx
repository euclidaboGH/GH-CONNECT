"use client"

import { memo, useEffect, useState } from "react"
import { ImageSkeleton } from "./skeleton-loaders"
import { isMediaFacadeUrl, resolveDisplayMediaUrl, clearDisplayMediaCache, extractMediaFacadeId } from "@/lib/media/resolve-display-url"

interface LazyImageProps {
  src?: string | null
  alt?: string | null
  className?: string
  onLoad?: () => void
  onError?: () => void
  onClick?: () => void
  online?: boolean
  verified?: boolean
  /** post-media: neutral tile + retry (never show misleading initials like "PI") */
  variant?: "default" | "avatar" | "post-media"
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
  variant = "default",
}: LazyImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const safeAlt = alt ?? (variant === "post-media" ? "Photo" : "Member")
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
        setDisplaySrc(rawSrc.startsWith("http") ? rawSrc : rawSrc.startsWith("/") ? rawSrc : null)
        if (!rawSrc.startsWith("http") && !rawSrc.startsWith("/")) setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawSrc, retryToken])

  const handleImgError = () => {
    if (retryToken < 2 && rawSrc && isMediaFacadeUrl(rawSrc)) {
      const id = extractMediaFacadeId(rawSrc)
      if (id) clearDisplayMediaCache(id)
      setRetryToken((n) => n + 1)
      setStatus("loading")
      setDisplaySrc(null)
      return
    }
    setStatus("error")
    onError?.()
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRetryToken((t) => t + 1)
    setStatus("loading")
    setDisplaySrc(null)
  }

  if (status === "error" || (!displaySrc && status !== "loading")) {
    if (variant === "post-media") {
      return (
        <div
          onClick={onClick}
          className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 ${className}`}
          role="img"
          aria-label="Media unavailable"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
            <path d="M3 16l5-4 3 2.5L16 10l5 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] font-medium text-slate-500">Media unavailable</span>
          {rawSrc ? (
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
            >
              Retry
            </button>
          ) : null}
          <span className="sr-only">{safeAlt} unavailable</span>
        </div>
      )
    }

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
        // eslint-disable-next-line @next/next/no-img-element
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
