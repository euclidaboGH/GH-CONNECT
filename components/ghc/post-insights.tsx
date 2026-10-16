"use client"

import { computePostInsights } from "@/lib/feed-profile-experience"
import type { Post } from "@/lib/ghc-types"
import { X, Eye, Heart, MessageCircle, Share2, Bookmark } from "lucide-react"

export function PostInsightsSheet({
  post,
  open,
  onClose,
}: {
  post: Post | null
  open: boolean
  onClose: () => void
}) {
  if (!open || !post) return null
  const i = computePostInsights(post)

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-[1.75rem] border border-border/50 bg-card p-5 shadow-[var(--gh-modal-shadow)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Post insights"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Post insights</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">{post.content}</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Eye, label: "Reach", value: i.reach },
            { icon: Heart, label: "Likes", value: i.likes },
            { icon: MessageCircle, label: "Comments", value: i.comments },
            { icon: Share2, label: "Shares", value: i.shares },
            { icon: Bookmark, label: "Saves", value: i.saves },
          ].map((row) => (
            <div key={row.label} className="rounded-[1.25rem] border border-border/50 bg-card p-3 shadow-[var(--gh-card-shadow)]">
              <row.icon size={16} className="mb-1 text-violet-600" />
              <p className="text-lg font-bold text-foreground">{row.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[1.25rem] border border-violet-200/60 bg-violet-50/70 px-3 py-2 text-[11px] font-semibold text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
          <span>Audience: {String((i as any).audience || post.visibility || "public")}</span>
          <span>~{i.engagementRate}% eng.</span>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Insights are private to you · estimates until server analytics is connected
        </p>
      </div>
    </div>
  )
}
