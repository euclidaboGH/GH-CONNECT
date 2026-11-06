"use client"

/**
 * Feed / profile composer prompt — single entry to the full compose hub.
 * Phase 4: premium card, Photo / Video / Story quick actions, focus event support.
 */

import { useEffect, useRef } from "react"
import { Image as ImageIcon, Video, Sparkles } from "lucide-react"
import { DurableImage } from "./durable-image"

export type ComposerPromptBarProps = {
  avatarLetter?: string
  avatarUrl?: string | null
  placeholder?: string
  className?: string
  onOpen: () => void
  onOpenPhoto?: () => void
  onOpenVideo?: () => void
  onOpenStory?: () => void
}

export function ComposerPromptBar({
  avatarLetter = "G",
  avatarUrl = null,
  placeholder = "What's on your mind?",
  className = "",
  onOpen,
  onOpenPhoto,
  onOpenVideo,
  onOpenStory,
}: ComposerPromptBarProps) {
  const letter = String(avatarLetter || "G").slice(0, 1).toUpperCase()
  const openRef = useRef(onOpen)
  openRef.current = onOpen
  useEffect(() => {
    const onFocus = () => {
      try {
        openRef.current?.()
      } catch { /* */ }
    }
    window.addEventListener("ghc:focus-composer", onFocus)
    return () => window.removeEventListener("ghc:focus-composer", onFocus)
  }, [])

  return (
    <section
      id="gh-profile-composer"
      data-composer-root
      className={`rounded-[1.25rem] border border-border/70 bg-card px-3 py-3 shadow-[var(--gh-card-shadow)] ${className}`}
      aria-label="Create a post"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold text-foreground ring-2 ring-background"
          aria-hidden="true"
        >
          {avatarUrl ? (
            <DurableImage src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            letter
          )}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border/60 bg-muted/50 px-4 text-left text-[13px] text-muted-foreground transition hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {placeholder}
        </button>
      </div>
      <div
        className="mt-2.5 flex items-center gap-1 border-t border-border/50 pt-2.5"
        role="group"
        aria-label="Quick create"
      >
        <button
          type="button"
          onClick={onOpenPhoto || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ImageIcon size={17} className="text-emerald-600" aria-hidden />
          Photo
        </button>
        <span className="h-5 w-px shrink-0 bg-border/70" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenVideo || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Video size={17} className="text-violet-600" aria-hidden />
          Video
        </button>
        {onOpenStory ? (
          <>
            <span className="h-5 w-px shrink-0 bg-border/70" aria-hidden="true" />
            <button
              type="button"
              onClick={onOpenStory}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles size={17} className="text-amber-500" aria-hidden />
              Story
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

export default ComposerPromptBar
