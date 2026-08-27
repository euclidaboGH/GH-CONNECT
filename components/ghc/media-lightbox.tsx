"use client"

/** Full-screen media viewer — closes on Escape, backdrop, and section change */

import { useEffect } from "react"
import { X } from "lucide-react"
import { onCloseTransientUI } from "@/lib/transient-ui"

export function MediaLightbox({
  open,
  url,
  alt,
  caption,
  onClose,
}: {
  open: boolean
  url: string | null
  alt?: string
  caption?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const off = onCloseTransientUI(() => onClose())
    return () => {
      window.removeEventListener("keydown", onKey)
      off()
    }
  }, [open, onClose])

  if (!open || !url) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div className="flex items-center justify-between px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="truncate text-sm font-semibold text-white/90">{caption || "Media"}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2" onClick={onClose}>
        <img
          src={url}
          alt={alt || "Full screen media"}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {caption && (
        <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm text-white/80">
          {caption}
        </p>
      )}
    </div>
  )
}
