"use client"

/**
 * Post-mutual-match confirmation — Message or continue discovering.
 * No rewards / earnings / financial language.
 */

import { MessageCircle, Compass, X, Heart } from "lucide-react"
import { LazyImage } from "./lazy-image"

export function MatchCelebration({
  open,
  userName,
  userPhoto,
  onMessage,
  onContinue,
  onClose,
}: {
  open: boolean
  userName: string
  userPhoto: string
  onMessage: () => void
  onContinue: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-celebration-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-emerald-500/30">
              <LazyImage
                src={userPhoto}
                alt={userName}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
              <Heart size={18} fill="currentColor" />
            </span>
          </div>

          <p id="match-celebration-title" className="text-xl font-bold text-foreground">
            It&apos;s a Match
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You and <span className="font-semibold text-foreground">{userName}</span> both expressed
            interest. This is mutual interest — not an automatic friendship or Follow.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={onMessage}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <MessageCircle size={18} />
              Message {userName.split(" ")[0]}
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
            >
              <Compass size={18} />
              Continue discovering
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
