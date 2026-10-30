"use client"

/**
 * Full-screen media viewer (images + video).
 * - Portal at z-220 (above nav / sheets)
 * - Gallery prev/next + keyboard
 * - Resolves private facade → signed URL
 * - Download + Share actions; long-press on image opens tools sheet
 * - Body scroll lock while open
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, Download, Share2, MoreHorizontal } from "lucide-react"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { isMediaFacadeUrl, resolveDisplayMediaUrl } from "@/lib/media/resolve-display-url"
import { downloadMedia, shareMediaUrl } from "@/lib/media/download-media"
import { DurableVideo } from "./durable-video"

export type MediaLightboxItem = {
  url: string
  kind?: "image" | "video"
  alt?: string
}

export function MediaLightbox({
  open,
  url,
  urls,
  index: initialIndex = 0,
  alt,
  caption,
  onClose,
}: {
  open: boolean
  /** Single URL (legacy) */
  url?: string | null
  /** Gallery of media items */
  urls?: MediaLightboxItem[] | string[]
  index?: number
  alt?: string
  caption?: string
  onClose: () => void
}) {
  const items: MediaLightboxItem[] = (() => {
    if (Array.isArray(urls) && urls.length > 0) {
      return urls.map((u) =>
        typeof u === "string"
          ? { url: u, kind: "image" as const }
          : { url: u.url, kind: u.kind || "image", alt: u.alt },
      )
    }
    if (url) return [{ url, kind: "image" as const, alt }]
    return []
  })()

  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)))
  const [resolved, setResolved] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)))
      setToolsOpen(false)
    }
  }, [open, initialIndex, items.length])

  const current = items[index] || null

  useEffect(() => {
    let cancelled = false
    setResolved(null)
    if (!open || !current?.url) return
    const raw = current.url
    if (!isMediaFacadeUrl(raw) && (raw.startsWith("http") || raw.startsWith("/") || raw.startsWith("data:") || raw.startsWith("blob:"))) {
      setResolved(raw)
      return
    }
    setResolving(true)
    void (async () => {
      const signed = await resolveDisplayMediaUrl(raw)
      if (cancelled) return
      setResolved(signed || (raw.startsWith("/") || raw.startsWith("http") ? raw : null))
      setResolving(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, current?.url])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
    setToolsOpen(false)
  }, [])
  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1))
    setToolsOpen(false)
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (toolsOpen) setToolsOpen(false)
        else onClose()
      }
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", onKey)
    const off = onCloseTransientUI(() => onClose())
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
      off()
    }
  }, [open, onClose, goPrev, goNext, toolsOpen])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = () => {
    clearLongPress()
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      longPressFired.current = true
      setToolsOpen(true)
      try {
        if ("vibrate" in navigator) navigator.vibrate(12)
      } catch {
        /* */
      }
    }, 480)
  }

  const endLongPress = () => {
    clearLongPress()
  }

  const handleDownload = async () => {
    if (!current?.url || busy) return
    setBusy(true)
    try {
      await downloadMedia(current.url, { kind: current.kind === "video" ? "video" : "image" })
    } finally {
      setBusy(false)
      setToolsOpen(false)
    }
  }

  const handleShare = async () => {
    if (!current?.url || busy) return
    setBusy(true)
    try {
      await shareMediaUrl(current.url, caption || "GreenHaven media")
    } finally {
      setBusy(false)
      setToolsOpen(false)
    }
  }

  if (!open || items.length === 0) return null
  if (typeof document === "undefined") return null

  const node = (
    <div
      className="gh-world-media-viewer fixed inset-0 z-[220] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Full screen media"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm font-semibold text-white/90">
          {caption || (items.length > 1 ? `${index + 1} / ${items.length}` : "Media")}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={busy || !current?.url}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Download media"
            title="Download"
          >
            <Download size={20} />
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={busy || !current?.url}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Share media"
            title="Share"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="More media tools"
          >
            <MoreHorizontal size={20} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close media viewer"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-2 select-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if ((e.target as HTMLElement).closest("button, video, a")) return
          startLongPress()
        }}
        onPointerUp={endLongPress}
        onPointerCancel={endLongPress}
        onPointerLeave={endLongPress}
        onContextMenu={(e) => {
          e.preventDefault()
          setToolsOpen(true)
        }}
      >
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              disabled={index <= 0}
              className="absolute left-2 z-10 rounded-full bg-black/50 p-2.5 text-white disabled:opacity-30"
              aria-label="Previous"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              disabled={index >= items.length - 1}
              className="absolute right-2 z-10 rounded-full bg-black/50 p-2.5 text-white disabled:opacity-30"
              aria-label="Next"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {resolving && !resolved ? (
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/20" aria-label="Loading media" />
        ) : current?.kind === "video" && resolved ? (
          <div className="flex h-full max-h-full w-full max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <DurableVideo
              src={resolved}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : resolved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved}
            alt={current?.alt || alt || "Full screen media"}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        ) : (
          <p className="text-sm text-white/70">Media unavailable</p>
        )}
      </div>

      {(caption || items.length > 1) && (
        <p className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 text-center text-sm text-white/75">
          {caption || `${index + 1} of ${items.length}`}
          <span className="mt-1 block text-[10px] text-white/45">Hold photo for download & tools</span>
        </p>
      )}

      {toolsOpen && (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center bg-black/50"
          onClick={() => setToolsOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-zinc-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Media tools"
          >
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-white/50">Media tools</p>
            <div className="grid gap-2">
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void handleDownload()}
                className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                <Download size={18} /> Download to device
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void handleShare()}
                className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                <Share2 size={18} /> Share
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setToolsOpen(false)}
                className="mt-1 flex min-h-11 items-center justify-center rounded-xl text-sm font-medium text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(node, document.body)
}
