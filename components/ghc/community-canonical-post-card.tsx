"use client"

import { useEffect, useState } from "react"
import { broadcastPostEngagement, normalizeEngagementMetrics } from "@/lib/engagement/post-engagement"
import type { Post } from "@/lib/ghc-types"
import { socialCommunityPlatformAction, socialToggleReaction, socialToggleSave } from "@/lib/social/client"
import { EnhancedPostCard } from "./enhanced-post-card"

type Props = {
  post: Post
  communityId: string
  isMod?: boolean
  onPin?: (postId: string) => void
  onHide?: (postId: string) => void
}

function toast(message: string, type: "success" | "error" | "info" = "info") {
  try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message, type } })) } catch { /* no-op */ }
}

/** Canonical community post surface: identical interaction engine to Feed/Profile. */
export function CommunityCanonicalPostCard({ post, communityId, isMod = false, onPin, onHide }: Props) {
  const [saved, setSaved] = useState(Boolean(post.savedByMe))
  const [reactionBusy, setReactionBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [engagementOverride, setEngagementOverride] = useState<Partial<Post>>({})
  useEffect(() => { setSaved(Boolean(post.savedByMe)); setEngagementOverride({}) }, [post.id, post.savedByMe])
  useEffect(() => {
    const onEngagement = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: string; likeCount?: number; reactionCounts?: Record<string, number>; viewerReactions?: string[]; shareCount?: number; commentCount?: number; savedByMe?: boolean }>).detail
      if (!detail || String(detail.postId || "") !== post.id) return
      if (typeof detail.savedByMe === "boolean") setSaved(detail.savedByMe)
      setEngagementOverride((previous) => {
        const next: Partial<Post> = { ...previous }
        if (typeof detail.likeCount === "number" && Number.isFinite(detail.likeCount)) {
          next.likes = Math.max(0, detail.likeCount)
          next.engagement = normalizeEngagementMetrics(post.engagement || previous.engagement, { likes: Math.max(0, detail.likeCount) })
        }
        if (detail.reactionCounts && typeof detail.reactionCounts === "object") next.reactionCounts = detail.reactionCounts
        if (Array.isArray(detail.viewerReactions)) next.viewerReactions = detail.viewerReactions
        if (typeof detail.shareCount === "number" && Number.isFinite(detail.shareCount)) {
          next.shares = Math.max(0, detail.shareCount)
          next.engagement = normalizeEngagementMetrics(next.engagement || post.engagement || previous.engagement, { shares: Math.max(0, detail.shareCount) })
        }
        if (typeof detail.commentCount === "number" && Number.isFinite(detail.commentCount)) {
          next.engagement = normalizeEngagementMetrics(next.engagement || post.engagement || previous.engagement, { comments: Math.max(0, detail.commentCount) })
        }
        return next
      })
    }
    window.addEventListener("ghc:post-engagement", onEngagement as EventListener)
    return () => window.removeEventListener("ghc:post-engagement", onEngagement as EventListener)
  }, [post.id, post.engagement])
  const renderPost: Post = {
    ...post,
    ...engagementOverride,
    engagement: normalizeEngagementMetrics(post.engagement, engagementOverride.engagement),
  }

  const openPost = (action?: string) => {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
    window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId: post.id, action, source: "community" } }))
  }

  return (
    <EnhancedPostCard
      surface="community"
      post={renderPost}
      isSaved={saved}
      onLike={(postId) => {
        if (reactionBusy) return
        setReactionBusy(true)
        void socialToggleReaction(postId, "like").then((result) => {
          if (!result.ok || result.durable === false) throw new Error(result.error || "REACTION_FAILED")
          broadcastPostEngagement({ postId, kind: "reaction", ...(typeof result.likeCount === "number" ? { likeCount: result.likeCount } : {}), ...(result.reactionCounts ? { reactionCounts: result.reactionCounts } : {}), ...(result.viewerReactions ? { viewerReactions: result.viewerReactions } : {}), ...(typeof result.liked === "boolean" ? { likedByMe: result.liked } : {}) })
        }).catch((error) => toast(error instanceof Error ? error.message : "Could not update reaction", "error")).finally(() => setReactionBusy(false))
      }}
      onReact={async (postId, reaction) => {
        if (reactionBusy) return false
        setReactionBusy(true)
        try {
          const result = await socialToggleReaction(postId, reaction)
          if (!result.ok || result.durable === false) throw new Error(result.error || "REACTION_FAILED")
          broadcastPostEngagement({ postId, kind: "reaction", ...(typeof result.likeCount === "number" ? { likeCount: result.likeCount } : {}), ...(result.reactionCounts ? { reactionCounts: result.reactionCounts } : {}), ...(result.viewerReactions ? { viewerReactions: result.viewerReactions } : {}), ...(typeof result.liked === "boolean" ? { likedByMe: result.liked } : {}) })
          return true
        } catch (error) {
          toast(error instanceof Error ? error.message : "Could not update reaction", "error")
          return false
        } finally {
          setReactionBusy(false)
        }
      }}
      onComment={() => openPost("comment")}
      onShare={() => openPost("share")}
      onSave={(postId) => {
        if (saveBusy) return
        setSaveBusy(true)
        void socialToggleSave(postId).then((result) => {
          if (!result.ok || result.durable === false) throw new Error(result.error || "SAVE_FAILED")
          setSaved(Boolean(result.saved))
          broadcastPostEngagement({ postId, kind: "save", savedByMe: Boolean(result.saved) })
          toast(result.saved ? "Post saved" : "Post removed from saved items", "success")
        }).catch((error) => toast(error instanceof Error ? error.message : "Could not save post", "error")).finally(() => setSaveBusy(false))
      }}
      onReport={(postId, reason, details) => {
        if (reportBusy) {
          toast("A report is already being sent. Please wait.")
          return
        }
        const normalizedReason: Record<string, string> = {
          spam: "spam",
          harassment: "harassment",
          "hate speech": "hate",
          "inappropriate content": "other",
          "fake profile": "impersonation",
          "scam / fraud": "safety",
          other: "other",
        }
        const safeReason = normalizedReason[String(reason || "").trim().toLowerCase()] || "other"
        setReportBusy(true)
        void socialCommunityPlatformAction(communityId, "report_create", {
          targetType: "post",
          targetId: postId,
          reason: safeReason,
          note: details || "",
        }).then((result) => {
          if (!result.ok || result.durable !== true) throw new Error("REPORT_FAILED")
          toast("Report sent to community moderators", "success")
        }).catch(() => toast("Could not send report. Please try again.", "error")).finally(() => setReportBusy(false))
      }}
      onPin={isMod ? onPin : undefined}
      onHide={isMod ? onHide : undefined}
      onOpenPost={() => openPost("view")}
      onShowVisibilityReason={() => toast("Community posts are visible to active community members.")}
      onOpenProfile={(userId) => window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId } }))}
    />
  )
}
