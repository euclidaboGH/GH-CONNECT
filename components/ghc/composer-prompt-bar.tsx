"use client"

import { DurableImage } from "./durable-image"
/**
 * World-class inline composer entry — shared by Feed and Profile.
 * Opens the canonical Create hub / UnifiedCompose pipeline. No second publisher.
 */
import { useEffect, useRef } from "react"
import { Image as ImageIcon, Video } from "lucide-react"

export function ComposerPromptBar({
  avatarLetter = "G",
  avatarUrl,
  onOpen,
  onOpenPhoto,
  onOpenVideo,
  placeholder = "What would you like to share with GreenHaven?",
  className = "",
}: {
  avatarLetter?: string
  avatarUrl?: string | null
  onOpen: () => void
  onOpenPhoto?: () => void
  onOpenVideo?: () => void
  placeholder?: string
  className?: string
}) {
  const letter = (avatarLetter || "G").trim().slice(0, 1).toUpperCase() || "G"
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
      className={`rounded-2xl border border-border/60 bg-card px-3 py-3 ${className}`}
      aria-label="Create a post"
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <DurableImage src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : letter}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 min-w-0 flex-1 rounded-full bg-muted/65 px-4 text-left text-[13px] text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {placeholder}
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-border/50 pt-2.5" role="group" aria-label="Quick create">
        <button
          type="button"
          onClick={onOpenPhoto || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ImageIcon size={17} className="text-emerald-600" aria-hidden />
          Photo
        </button>
        <span className="h-5 w-px bg-border/70" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenVideo || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Video size={17} className="text-violet-600" aria-hidden />
          Video
        </button>
      </div>
    </section>
  )
}
