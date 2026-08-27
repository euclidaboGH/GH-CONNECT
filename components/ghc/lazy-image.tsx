"use client"

import { memo, useEffect, useState } from "react"
import { ImageSkeleton } from "./skeleton-loaders"

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

function LazyImageInner({ src, alt, className = "", onLoad, onError, onClick, online = false, verified = false }: LazyImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const safeAlt = alt ?? "Member"
  const safeSrc = typeof src === "string" && src.trim() ? src : "/placeholder.svg?height=320&width=320"
  const initials = safeAlt.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?"

  useEffect(() => {
    setStatus("loading")
  }, [safeSrc])

  if (status === "error") {
    return (
      <div onClick={onClick} className={`relative overflow-hidden ${className}`}>
        <img src="/placeholder.svg?height=320&width=320" alt={`${safeAlt} placeholder`} className="h-full w-full object-cover opacity-90" loading="lazy" />
        <span className="sr-only">{safeAlt} photo unavailable</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${status === "loading" ? "bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" : "bg-transparent"} ${className}`}>
      {status === "loading" && <ImageSkeleton className="absolute inset-0" />}
      <img
        key={safeSrc}
        src={safeSrc}
        alt={safeAlt}
        onClick={onClick}
        className={`${className.includes("h-full") || className.includes("absolute") ? "absolute inset-0 h-full w-full" : "h-full w-full"} object-cover transition-opacity duration-200 ${status === "loading" ? "opacity-0" : "opacity-100"}`}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        style={{ contentVisibility: "auto", contain: "paint" }}
        onLoad={() => {
          setStatus("loaded")
          onLoad?.()
        }}
        onError={() => {
          setStatus("error")
          onError?.()
        }}
      />
      {(online || verified) && <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5"><span className="sr-only">{online ? "Online" : "Offline"}{verified ? ", verified" : ""}</span>{online && <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" aria-hidden="true" />}{verified && <span className="rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm" aria-hidden="true">✓</span>}</div>}
    </div>
  )
}

export const LazyImage = memo(LazyImageInner)
