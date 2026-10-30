"use client"

/**
 * World-class inline composer entry — shared by Feed and Profile.
 * Opens the canonical Create hub / UnifiedCompose pipeline. No second publisher.
 */
import { Image as ImageIcon, Smile, Video } from "lucide-react"

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

  return (
    <section
      className={`rounded-[1.35rem] border border-border/70 bg-card p-3 shadow-[var(--gh-card-shadow)] ${className}`}
      aria-label="Create a post"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-sm font-bold text-white shadow-sm"
          aria-hidden="true"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            letter
          )}
        </span>
        <span className="min-w-0 flex-1 rounded-full border border-border/60 bg-muted/50 px-4 py-2.5 text-[13px] text-muted-foreground transition hover:bg-muted/80">
          {placeholder}
        </span>
      </button>

      <div className="mt-2.5 flex items-center gap-1 border-t border-border/50 pt-2.5" role="group" aria-label="Quick create">
        <button
          type="button"
          onClick={onOpenPhoto || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-foreground/90 transition hover:bg-muted/70 active:scale-[0.98]"
        >
          <ImageIcon size={16} className="text-emerald-600" aria-hidden />
          Photo
        </button>
        <button
          type="button"
          onClick={onOpenVideo || onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-foreground/90 transition hover:bg-muted/70 active:scale-[0.98]"
        >
          <Video size={16} className="text-violet-600" aria-hidden />
          Video
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-foreground/90 transition hover:bg-muted/70 active:scale-[0.98]"
        >
          <Smile size={16} className="text-amber-600" aria-hidden />
          Feeling
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="ml-1 inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-4 text-[12px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Create
        </button>
      </div>
    </section>
  )
}
