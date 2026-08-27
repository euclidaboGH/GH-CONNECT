"use client"

/**
 * Distinct Follow / Connect / Match actions — always driven by Social Graph state.
 * Never hardcode labels; use domains.profile.getRelationshipState when available.
 */

import { useCallback, useMemo, useState } from "react"
import { UserPlus, UserCheck, Heart, Link2, MessageCircle, Loader2 } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { performProfileRelationshipAction } from "@/lib/domains/profile-domain"
import type { ProfileRelationshipAction } from "@/lib/domains/profile-domain"

type Props = {
  userId: string
  userName?: string
  userPhoto?: string
  /** Compact for grid cards */
  compact?: boolean
  className?: string
}

export function RelationshipActions({
  userId,
  userName,
  userPhoto,
  compact = false,
  className = "",
}: Props) {
  const { following, friends, matches, blockedUsers, addToast, followUser, swipe, startConversation } = useGHC()
  const [busy, setBusy] = useState<string | null>(null)

  const state = useMemo(() => {
    const services = getBoundDomainServices()
    if (services?.profile?.getRelationshipState) {
      return services.profile.getRelationshipState(userId)
    }
    // Fallback from session lists
    const isFollowing = (following || []).includes(userId)
    const isFriend = (friends || []).includes(userId)
    const isMatched = (matches || []).some((m: any) => m.userId === userId || m.id === userId)
    const isBlocked = (blockedUsers || []).includes(userId)
    return {
      isSelf: false,
      isFollowing,
      isFollower: false,
      isFriend,
      isMatched,
      isBlocked,
      isMuted: false,
      isRestricted: false,
      outgoingRequest: false,
      incomingRequest: false,
      actions: [
        isFollowing ? "unfollow" : "follow",
        isFriend ? "remove_connection" : "connect",
        isMatched ? "unmatch" : "match",
        "message",
      ] as ProfileRelationshipAction[],
      statusLabel: isFriend
        ? "Connected"
        : isMatched
          ? "Matched"
          : isFollowing
            ? "Following"
            : "Not connected",
    }
  }, [userId, following, friends, matches, blockedUsers])

  if (state.isBlocked) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold text-muted-foreground">
          Blocked
        </span>
      </div>
    )
  }

    const run = useCallback(
    async (action: ProfileRelationshipAction) => {
      if (busy) return
      setBusy(action)
      try {
        const services = getBoundDomainServices()
        if (services && performProfileRelationshipAction) {
          const result = await performProfileRelationshipAction(services, action, userId, {
            userName,
            userPhoto,
          })
          if (!result.ok) {
            // Fallback to legacy handlers for follow/match
            if (action === "follow" || action === "unfollow") {
              await followUser(userId)
            } else if (action === "match") {
              await swipe(userId, "like")
            } else {
              addToast(result.error || "Action failed", "error")
            }
          } else {
            const labels: Partial<Record<ProfileRelationshipAction, string>> = {
              follow: "Following — you'll see their public posts",
              unfollow: "Unfollowed",
              connect: "Connection request sent — they can accept to become friends",
              accept_request: "Connected",
              match: "Interest sent",
              unmatch: "Unmatched",
              message: "Opening chat",
            }
            if (labels[action]) addToast(labels[action]!, "success")
            if (action === "message") {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
            }
          }
        } else {
          if (action === "follow" || action === "unfollow") await followUser(userId)
          else if (action === "match") await swipe(userId, "like")
          else if (action === "message") {
            await startConversation(
              userId,
              userName || "Member",
              userPhoto || "/placeholder.svg?height=80&width=80"
            )
            window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
          }
        }
      } catch {
        addToast("Something went wrong", "error")
      } finally {
        setBusy(null)
      }
    },
    [busy, userId, userName, userPhoto, followUser, swipe, startConversation, addToast]
  )

  if (state.isSelf) return null

  const btn =
    compact
      ? "inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-3.5 text-[11px] font-bold transition motion-safe:active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      : "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition motion-safe:active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Relationship actions" aria-busy={!!busy}>
      {/* Follow — one-way social signal */}
      <button
        type="button"
        disabled={!!busy}
        onClick={() => run(state.isFollowing ? "unfollow" : "follow")}
        className={`${btn} ${
          state.isFollowing
            ? "border border-stone-200 bg-white text-stone-700"
            : "border border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
        aria-label={state.isFollowing ? "Unfollow" : "Follow"}
        title="Follow — see their public posts"
      >
        {busy === "follow" || busy === "unfollow" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state.isFollowing ? (
          <UserCheck size={14} />
        ) : (
          <UserPlus size={14} />
        )}
        {state.isFollowing ? "Following" : "Follow"}
      </button>

      {/* Connect — mutual friendship request */}
      <button
        type="button"
        disabled={!!busy || state.isFriend}
        onClick={() =>
          run(
            state.incomingRequest
              ? "accept_request"
              : state.isFriend
                ? "remove_connection"
                : "connect"
          )
        }
        className={`${btn} ${
          state.isFriend
            ? "border border-teal-200 bg-teal-50 text-teal-900"
            : state.outgoingRequest
              ? "border border-stone-200 bg-stone-50 text-stone-500"
              : "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
        }`}
        aria-label={
          state.isFriend
            ? "Connected"
            : state.outgoingRequest
              ? "Request sent"
              : state.incomingRequest
                ? "Accept connection"
                : "Connect"
        }
        title="Connect — request a mutual connection"
      >
        {busy === "connect" || busy === "accept_request" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Link2 size={14} />
        )}
        {state.isFriend
          ? "Connected"
          : state.outgoingRequest
            ? "Requested"
            : state.incomingRequest
              ? "Accept"
              : "Connect"}
      </button>

      {/* Match — intentional mutual interest (dating/intent) */}
      <button
        type="button"
        disabled={!!busy || state.isMatched}
        onClick={() => run(state.isMatched ? "unmatch" : "match")}
        className={`${btn} ${
          state.isMatched
            ? "border border-rose-200 bg-rose-50 text-rose-800"
            : "bg-rose-500 text-white shadow-sm shadow-rose-500/20"
        }`}
        aria-label={state.isMatched ? "Matched" : "Match"}
        title="Match — mutual intentional interest"
      >
        {busy === "match" || busy === "unmatch" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Heart size={14} className={state.isMatched ? "fill-current" : ""} />
        )}
        {state.isMatched ? "Matched" : "Match"}
      </button>

      {!compact && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("message")}
          className={`${btn} border border-stone-200 bg-white text-stone-800`}
          aria-label="Message"
        >
          <MessageCircle size={14} />
          Message
        </button>
      )}
    </div>
  )
}

/** Tiny legend for Find / Feed / Profile — one language everywhere */
export function RelationshipLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-relaxed text-muted-foreground ${className}`} role="note">
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Follow</span>
      <span className="text-muted-foreground"> public activity</span>
      <span className="mx-1 text-border">·</span>
      <span className="font-semibold text-teal-700 dark:text-teal-400">Connect</span>
      <span className="text-muted-foreground"> mutual friendship</span>
      <span className="mx-1 text-border">·</span>
      <span className="font-semibold text-rose-600 dark:text-rose-400">Match</span>
      <span className="text-muted-foreground"> intentional interest</span>
    </p>
  )
}
