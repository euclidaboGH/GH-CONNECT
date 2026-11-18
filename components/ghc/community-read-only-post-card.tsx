"use client"

import type { ReactNode } from "react"
import type { Post } from "@/lib/ghc-types"
import { EnhancedPostCard } from "./enhanced-post-card"

const noMutation = () => undefined

/**
 * Canonical visual renderer for archived and preview-only community content.
 * It deliberately disables every post mutation: historical/sample identifiers
 * must never be sent to the durable social write APIs.
 */
export function CommunityReadOnlyPostCard({
  post,
  statusLabel,
  children,
}: {
  post: Post
  statusLabel: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-2" data-community-post-state="read-only">
      <div className="flex items-center gap-2 px-1">
        <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          {statusLabel}
        </span>
      </div>
      <EnhancedPostCard
        surface="community"
        readOnly
        post={post}
        isSaved={false}
        onComment={noMutation}
        onShare={noMutation}
        onSave={noMutation}
        onShowVisibilityReason={noMutation}
      />
      {children ? <div className="rounded-b-xl border-x border-b border-border/60 bg-card px-3 py-2">{children}</div> : null}
    </div>
  )
}
