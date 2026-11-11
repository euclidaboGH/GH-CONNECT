"use client"

/**
 * Feed / profile composer prompt — single entry to the full compose hub.
 * Phase 4: premium card, Photo / Video / Story quick actions, focus event support.
 */

import { useEffect, useRef } from "react"
import { Image as ImageIcon, Video, Sparkles, ShieldCheck } from "lucide-react"
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
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-tight text-foreground">Start a conversation</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Share an update, idea or moment with your community</p>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700/[0.07] text-emerald-700 dark:text-emerald-300" aria-hidden="true">
          <Sparkles size={15} />
        </span>
      </div>
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
          aria-label="Create a post and choose its audience"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-border/60 bg-muted/50 px-4 text-left text-[13px] text-muted-foreground transition hover:border-emerald-700/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
          aria-label="Create a post with a photo"
          title="Add a photo"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ImageIcon size={17} className="text-emerald-600" aria-hidden />
          Photo
        </button>
        <span className="h-5 w-px shrink-0 bg-border/70" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenVideo || onOpen}
          aria-label="Create a post with a video"
          title="Add a video"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              aria-label="Create a story"
              title="Create a story"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles size={17} className="text-amber-500" aria-hidden />
              Story
            </button>
          </>
        ) : null}
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-[10px] leading-4 text-muted-foreground">
        <ShieldCheck size={12} className="shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        Choose your audience in the composer before you publish
      </p>
    </section>
  )
}

export default ComposerPromptBar
