"use client"

import { useEffect, useState } from "react"
import type { Post } from "@/lib/ghc-types"
import { socialToggleReaction, socialToggleSave } from "@/lib/social/client"
import { EnhancedPostCard } from "./enhanced-post-card"

type Props = {
  post: Post
  isMod?: boolean
  onPin?: (postId: string) => void
  onHide?: (postId: string) => void
}

function toast(message: string, type: "success" | "error" | "info" = "info") {
  try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message, type } })) } catch { /* no-op */ }
}

/** Canonical community post surface: identical interaction engine to Feed/Profile. */
export function CommunityCanonicalPostCard({ post, isMod = false, onPin, onHide }: Props) {
  const [saved, setSaved] = useState(Boolean(post.savedByMe))
  const [reactionBusy, setReactionBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  useEffect(() => { setSaved(Boolean(post.savedByMe)) }, [post.id, post.savedByMe])

  const openPost = (action?: string) => {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
    window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId: post.id, action, source: "community" } }))
  }

  return (
    <EnhancedPostCard
      surface="community"
      post={post}
      isSaved={saved}
      onLike={(postId) => {
        if (reactionBusy) return
        setReactionBusy(true)
        void socialToggleReaction(postId, "like").then((result) => {
          if (!result.ok) throw new Error(result.error || "REACTION_FAILED")
          window.dispatchEvent(new CustomEvent("ghc:post-engagement", { detail: { postId, source: "community-reaction" } }))
        }).catch((error) => toast(error instanceof Error ? error.message : "Could not update reaction", "error")).finally(() => setReactionBusy(false))
      }}
      onReact={(postId, reaction) => {
        if (reactionBusy) return
        setReactionBusy(true)
        void socialToggleReaction(postId, reaction).then((result) => {
          if (!result.ok) throw new Error(result.error || "REACTION_FAILED")
          window.dispatchEvent(new CustomEvent("ghc:post-engagement", { detail: { postId, source: "community-reaction" } }))
        }).catch((error) => toast(error instanceof Error ? error.message : "Could not update reaction", "error")).finally(() => setReactionBusy(false))
      }}
      onComment={() => openPost("comment")}
      onShare={() => openPost("share")}
      onSave={(postId) => {
        if (saveBusy) return
        setSaveBusy(true)
        void socialToggleSave(postId).then((result) => {
          if (!result.ok) throw new Error(result.error || "SAVE_FAILED")
          setSaved(Boolean(result.saved))
          toast(result.saved ? "Post saved" : "Post removed from saved items", "success")
        }).catch((error) => toast(error instanceof Error ? error.message : "Could not save post", "error")).finally(() => setSaveBusy(false))
      }}
      onPin={isMod ? onPin : undefined}
      onHide={isMod ? onHide : undefined}
      onOpenPost={() => openPost("view")}
      onShowVisibilityReason={() => toast("Community posts are visible to active community members.")}
      onOpenProfile={(userId) => window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId } }))}
    />
  )
}
