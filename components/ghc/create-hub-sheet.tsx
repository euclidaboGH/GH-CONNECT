"use client"

/**
 * Create hub — four intentional actions:
 *  1) Post (unified text + photo + video + files)
 *  2) Poll
 *  3) Community board
 *  4) Challenge (reward quest)
 * Photo/Video are attachments inside Post — not separate product surfaces.
 */

import { useEffect, useMemo } from "react"
import {
  X,
  PenLine,
  BarChart3,
  Users,
  Trophy,
  Lightbulb,
} from "lucide-react"

export type CreateHubAction = "post" | "poll" | "community" | "challenge"

const ACTIONS: {
  id: CreateHubAction
  label: string
  desc: string
  icon: typeof PenLine
  accent: string
}[] = [
  {
    id: "post",
    label: "Post",
    desc: "Text, photos, video & files",
    icon: PenLine,
    accent: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "poll",
    label: "Poll",
    desc: "Ask your network",
    icon: BarChart3,
    accent: "bg-amber-600/15 text-amber-800 dark:text-amber-200",
  },
  {
    id: "community",
    label: "Community",
    desc: "Post on a group board",
    icon: Users,
    accent: "bg-teal-600/15 text-teal-700 dark:text-teal-300",
  },
  {
    id: "challenge",
    label: "Challenge",
    desc: "Start a reward quest",
    icon: Trophy,
    accent: "bg-rose-600/15 text-rose-700 dark:text-rose-300",
  },
]

const HUB_TIPS = [
  "Share a moment with text, photos, or video in one post",
  "💡 Ask a poll when you want a clear decision",
  "Challenges turn activity into GHC progress",
  "Community boards keep group discussion organised",
] as const

export function CreateHubSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (action: CreateHubAction) => void
}) {
  const tip = useMemo(() => {
    try {
      return HUB_TIPS[Math.floor(Date.now() / (1000 * 60 * 30)) % HUB_TIPS.length]
    } catch {
      return HUB_TIPS[0]
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const onVis = () => {
      if (document.hidden) onClose()
    }
    const onTab = () => onClose()
    window.addEventListener("keydown", onKey)
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("ghc:tab-change", onTab)
    window.addEventListener("ghc:close-transient-ui", onTab)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("ghc:tab-change", onTab)
      window.removeEventListener("ghc:close-transient-ui", onTab)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Create">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close create"
        onClick={onClose}
      />
      <div className="relative z-[81] w-full max-w-[var(--gh-content-max,28rem)] rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-[15px] font-bold text-foreground">Create</p>
            <p className="text-[11px] text-muted-foreground">Share with GreenHaven</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <p className="text-[12px] leading-relaxed text-emerald-900 dark:text-emerald-100">{tip}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelect(a.id)
                  onClose()
                }}
                className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-background px-3.5 py-3.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 active:scale-[0.98] dark:hover:bg-emerald-950/30"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.accent}`}>
                  <Icon size={20} strokeWidth={2.25} />
                </span>
                <span>
                  <span className="block text-[13px] font-bold text-foreground">{a.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{a.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CreateHubSheet
