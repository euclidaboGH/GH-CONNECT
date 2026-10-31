"use client"

/**
 * Shared long-press + context-menu handlers for media download tools.
 * Keeps pointer/timer logic out of large UI components.
 */

import { useCallback, useRef } from "react"
import { downloadMedia, shareMediaUrl } from "@/lib/media/download-media"

export type MediaLongPressOptions = {
  url?: string | null
  kind?: "image" | "video"
  filename?: string
  /** ms before tools fire; default 480 */
  delayMs?: number
  onTools?: () => void
}

export function useMediaLongPress() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback((opts: MediaLongPressOptions) => {
    clear()
    firedRef.current = false
    const delay = opts.delayMs ?? 480
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      firedRef.current = true
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10)
      } catch {
        /* */
      }
      if (opts.onTools) opts.onTools()
      else if (opts.url) {
        void downloadMedia(opts.url, { kind: opts.kind, filename: opts.filename })
      }
    }, delay)
  }, [clear])

  const end = useCallback(() => {
    clear()
  }, [clear])

  const wasLongPress = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false
      return true
    }
    return false
  }, [])

  const bind = useCallback(
    (opts: MediaLongPressOptions) => ({
      onPointerDown: (e: { button?: number; currentTarget?: EventTarget | null }) => {
        if (e.button != null && e.button !== 0) return
        start(opts)
      },
      onPointerUp: () => end(),
      onPointerCancel: () => end(),
      onPointerLeave: () => end(),
      onContextMenu: (e: { preventDefault: () => void }) => {
        e.preventDefault()
        if (opts.onTools) opts.onTools()
        else if (opts.url) void downloadMedia(opts.url, { kind: opts.kind, filename: opts.filename })
      },
    }),
    [start, end],
  )

  return {
    start,
    end,
    clear,
    wasLongPress,
    bind,
    download: downloadMedia,
    share: shareMediaUrl,
  }
}
