"use client"

/**
 * Full-screen peer profile from Find — premium hero + circular actions
 * (aligned with production discovery products, GH relationship language).
 */

import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  MoreVertical,
  ShieldCheck,
  UserPlus,
  VolumeX,
  Ban,
  X,
} from "lucide-react"
import type { Candidate } from "@/lib/ghc-types"
import { useState, useEffect } from "react"
import { ActionSheet, ActionSheetItem, closeAllActionSheets } from "./action-sheet"
import { LazyImage } from "./lazy-image"
import { ReportChooser } from "./report-chooser"
import { resolveAvatarUrl } from "@/lib/avatar"

function calculateProfileMatch(candidate: Candidate, interests: string[], age?: number, location?: string) {
  const shared = (candidate.interests ?? []).filter((item) => interests.includes(item)).length
  const ageScore = typeof age === "number" ? Math.max(0, 20 - Math.min(20, Math.abs(age - candidate.age))) : 0
  const locationScore =
    location && candidate.location && location.toLowerCase().includes(candidate.location.toLowerCase()) ? 15 : 0
  return Math.min(
    99,
    Math.round(
      20 +
        Math.min(45, shared * 9) +
        ageScore +
        locationScore +
        (candidate.verified ? 10 : 0) +
        (candidate.online ? 5 : 0),
    ),
  )
}

export function ProfilePreviewPage({
  candidate,
  userInterests = [],
  userAge,
  userLocation,
  onBack,
  onMessage,
  onLike,
  onPass,
  onMute,
  onBlock,
  onReport,
  onFollow,
  publicPosts = [],
  stories = [],
  canMessage = false,
  isFollowing = false,
  isMatched = false,
}: {
  candidate: Candidate
  userInterests?: string[]
  userAge?: number
  userLocation?: string
  onBack: () => void
  onMessage: () => void
  onLike: () => void
  onPass: () => void
  onMute?: () => void
  onBlock?: () => void
  onReport?: (reason: string) => void
  onFollow?: () => void
  publicPosts?: Array<{ id: string; content?: string; createdAt?: number }>
  stories?: Array<{ id: string; text?: string; createdAt?: number }>
  canMessage?: boolean
  isFollowing?: boolean
  isMatched?: boolean
}) {
  const [showActions, setShowActions] = useState(false)
  const [liked, setLiked] = useState(false)
  const match = calculateProfileMatch(candidate, userInterests, userAge, userLocation)
  const closeActions = () => setShowActions(false)

  // Dismiss menu + allow host to close full profile on tab change / global reset
  useEffect(() => {
    const onClose = () => {
      setShowActions(false)
    }
    const onCloseProfile = () => {
      setShowActions(false)
      onBack()
    }
    window.addEventListener("ghc:close-action-sheets", onClose)
    window.addEventListener("ghc:close-transient-ui", onCloseProfile)
    window.addEventListener("ghc:navigate-tab", onCloseProfile)
    return () => {
      window.removeEventListener("ghc:close-action-sheets", onClose)
      window.removeEventListener("ghc:close-transient-ui", onCloseProfile)
      window.removeEventListener("ghc:navigate-tab", onCloseProfile)
    }
  }, [onBack])
  const photo = resolveAvatarUrl(candidate.photo, { seed: candidate.id || candidate.name, size: 720 })
  const name = candidate.name?.trim() || "Member"

  return (
    <section
      className="fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-background"
      aria-label={`${name}'s profile`}
    >
      {/* Full-bleed hero */}
      <div className="relative min-h-0 flex-1 bg-muted">
        <LazyImage
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!showActions) closeAllActionSheets()
                setShowActions((o) => !o)
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
              aria-label="More options"
              aria-expanded={showActions}
            >
              <MoreVertical size={18} />
            </button>
            <ActionSheet open={showActions} onClose={closeActions} title="Safety & privacy">
              <ActionSheetItem
                onClick={() => {
                  onMute?.()
                  closeActions()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <VolumeX size={16} /> Mute
                </span>
              </ActionSheetItem>
              <ActionSheetItem
                destructive
                onClick={() => {
                  if (window.confirm("Block this person?")) onBlock?.()
                  closeActions()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Ban size={16} /> Block
                </span>
              </ActionSheetItem>
              <div className="border-t border-border px-1 py-2">
                <ReportChooser
                  label="Report"
                  onSubmit={(reason) => {
                    onReport?.(reason)
                    closeActions()
                  }}
                />
              </div>
            </ActionSheet>
          </div>
        </div>

        {/* Identity overlay on photo */}
        <div className="absolute inset-x-0 bottom-28 px-5 text-white">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {candidate.online && (
              <span className="rounded-full bg-emerald-500/95 px-2.5 py-0.5 text-[11px] font-bold">Active</span>
            )}
            {candidate.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/95 px-2.5 py-0.5 text-[11px] font-bold">
                <ShieldCheck size={12} /> Verified
              </span>
            )}
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">
              {match}% compatible
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight drop-shadow-md">
            {name}
            {candidate.age ? <span className="font-semibold text-white/90">, {candidate.age}</span> : null}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
            <MapPin size={14} />
            {candidate.location || "Global"}
          </p>
          {candidate.bio ? (
            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-white/85">{candidate.bio}</p>
          ) : null}
          {(candidate.interests ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(candidate.interests ?? []).slice(0, 5).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Circular action dock — sample-style */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10">
          <button
            type="button"
            onClick={onPass}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label="Not interested"
          >
            <X size={26} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              onFollow?.()
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label={isFollowing ? "Following" : "Follow"}
          >
            <UserPlus size={22} />
          </button>
          <button
            type="button"
            onClick={() => {
              setLiked(true)
              onLike()
            }}
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition active:scale-95 ${
              liked || isMatched
                ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white"
                : "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
            }`}
            aria-label="Like / Match interest"
          >
            <Heart size={28} fill={liked || isMatched ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label={canMessage ? "Message" : "Message request"}
          >
            <MessageCircle size={22} />
          </button>
          <button
            type="button"
            onClick={onLike}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label="Connect interest"
            title="Match"
          >
            <Link2 size={22} />
          </button>
        </div>
      </div>

      {/* Scrollable details under hero (optional depth) */}
      <div className="max-h-[32dvh] shrink-0 overflow-y-auto border-t border-border bg-card px-5 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${candidate.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          {candidate.online ? "Online now" : "Recently active"}
          {candidate.verified && (
            <span className="ml-1 inline-flex items-center gap-1 text-sky-600">
              <CheckCircle2 size={15} /> Verified
            </span>
          )}
        </div>
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3 dark:from-violet-950/40 dark:to-fuchsia-950/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Compatibility
            </span>
            <span className="text-lg font-bold text-violet-900 dark:text-violet-100">{match}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
              style={{ width: `${match}%` }}
            />
          </div>
        </div>
        {publicPosts.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground">Public posts</h2>
            <div className="mt-2 space-y-2">
              {publicPosts.slice(0, 3).map((post) => (
                <article key={post.id} className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  {post.content || "Shared a post"}
                </article>
              ))}
            </div>
          </div>
        )}
        {stories.length > 0 && (
          <div className="mt-3">
            <h2 className="text-sm font-bold text-foreground">Stories</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {stories.map((story) => (
                <article key={story.id} className="min-w-[8rem] rounded-2xl bg-primary/10 p-3 text-xs text-foreground">
                  {story.text || "Shared a story"}
                </article>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Follow · Connect · Match mean different things — use the actions above intentionally.
        </p>
      </div>
    </section>
  )
}
