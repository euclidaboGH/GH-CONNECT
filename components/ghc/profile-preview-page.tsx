"use client"

/**
 * Full-screen peer profile from Find — premium hero + circular actions
 * (aligned with production discovery products, GH relationship language).
 */

import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  MapPin,
  MessageCircle,
  MoreVertical,
  ShieldCheck,
  UserPlus,
  VolumeX,
  Ban,
  X,
  ImagePlus,
} from "lucide-react"
import type { Candidate } from "@/lib/ghc-types"
import { useState, useEffect } from "react"
import { ActionSheet, ActionSheetItem, closeAllActionSheets } from "./action-sheet"
import { LazyImage } from "./lazy-image"
import { ReportChooser } from "./report-chooser"
import { resolveAvatarUrl } from "@/lib/avatar"
import { buildProfileConnectionContext } from "@/lib/domains/adapters/profile-connection-context"
import { resolveUserIntents } from "@/lib/connection-intents"
import { IdentityService } from "@/lib/identity/identity-service"
import { ProfileContentLibrary } from "./profile-content-library"

export function ProfilePreviewPage({
  candidate,
  userInterests = [],
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
  viewerIntents,
  viewerCommunityIds,
  viewerFriendIds,
}: {
  candidate: Candidate
  userInterests?: string[]
  onBack: () => void
  onMessage: () => void
  onLike: () => void
  onPass: () => void
  onMute?: () => void
  onBlock?: () => void
  onReport?: (reason: string) => void
  onFollow?: () => void
  publicPosts?: Array<{ id: string; content?: string; createdAt?: number; images?: string[]; video?: string | null; pdf?: string | null; pdfName?: string | null; visibility?: "public" | "followers" | "mutuals" | "private" }>
  stories?: Array<{ id: string; text?: string; createdAt?: number }>
  canMessage?: boolean
  isFollowing?: boolean
  isMatched?: boolean
  viewerIntents?: string[]
  viewerCommunityIds?: string[]
  viewerFriendIds?: string[]
}) {
  const [showActions, setShowActions] = useState(false)
  const [showContentLibrary, setShowContentLibrary] = useState(false)
  const [liked, setLiked] = useState(false)
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

  const profileConnectionContext = buildProfileConnectionContext({
    viewer: {
      interests: userInterests,
      intents: (viewerIntents as any) || resolveUserIntents(IdentityService.getCurrentUserId(), null),
      communityIds: viewerCommunityIds,
      friendIds: viewerFriendIds,
    },
    subject: {
      id: String(candidate.id || ""),
      interests: candidate.interests,
      intents: (candidate as any).connectionIntents,
      communityIds: (candidate as any).communityIds,
      friendIds: (candidate as any).mutualFriendIds,
    },
  })


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

        {profileConnectionContext.reasons.length > 0 ||
        profileConnectionContext.sharedCommunities.length > 0 ? (
          <div className="absolute inset-x-0 bottom-28 z-[1] px-4">
            <div className="rounded-2xl border border-white/20 bg-black/50 p-3 backdrop-blur-md" aria-label="How you may connect">
              <p className="text-[11px] font-semibold text-white">How you may connect</p>
              <p className="mt-1 text-[11px] leading-snug text-white/85">{profileConnectionContext.summary}</p>
              {profileConnectionContext.sharedCommunities.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Shared communities">
                  {profileConnectionContext.sharedCommunities.slice(0, 3).map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:open-community", {
                                detail: { groupId: c },
                              })
                            )
                          } catch {
                            /* */
                          }
                        }}
                        className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        Both in {c}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}


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
              {onMute ? (
              <ActionSheetItem
                onClick={() => {
                  onMute()
                  closeActions()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <VolumeX size={16} /> Mute
                </span>
              </ActionSheetItem>
            ) : null}
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

        {/* Profile action dock */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10">
          <button
            type="button"
            onClick={onPass}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label="Pass — not interested for matching"
            title="Pass — skip for matching"
          >
            <X size={26} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              onFollow?.()
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            aria-label={isFollowing ? "Unfollow" : "Follow"}
            title={isFollowing ? "Unfollow" : "Follow"}
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
                ? "bg-[var(--gh-green)] text-white"
                : "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
            }`}
            aria-label="Like — interest for matching"
            title="Like — helps matching when mutual"
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
        </div>
      </div>

      {/* X-style dual primary CTAs — Message | Follow/Connect */}
      <div className="shrink-0 border-t border-border bg-card px-4 pt-3">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onMessage}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-[13px] font-bold text-white shadow-sm transition active:scale-[0.98]"
            aria-label={canMessage ? "Message" : "Message request"}
          >
            <MessageCircle size={17} />
            {canMessage ? "Message" : "Message"}
          </button>
          <button
            type="button"
            onClick={() => onFollow?.()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] font-bold text-foreground shadow-sm transition hover:bg-muted active:scale-[0.98]"
            aria-label={isFollowing ? "Following" : "Follow"}
          >
            <UserPlus size={17} />
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      </div>

      {/* Scrollable details under hero (optional depth) */}
      <div className="max-h-[32dvh] shrink-0 overflow-y-auto border-t border-border bg-card px-5 py-4">
        <button type="button" onClick={() => setShowContentLibrary(true)} className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-4 text-sm font-bold text-foreground transition hover:bg-muted" aria-label={`Browse ${name}'s posts and media`}>
          <ImagePlus size={17} /> Browse posts, photos, videos & documents
        </button>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${candidate.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          {candidate.online ? "Online now" : "Recently active"}
          {candidate.verified && (
            <span className="ml-1 inline-flex items-center gap-1 text-sky-600">
              <CheckCircle2 size={15} /> Verified
            </span>
          )}
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
      <ProfileContentLibrary
        open={showContentLibrary}
        onClose={() => setShowContentLibrary(false)}
        profileId={candidate.id}
        profileName={name}
        profilePhotos={candidate.photos?.length ? candidate.photos : [candidate.photo].filter(Boolean)}
        coverPhoto={candidate.coverPhoto || null}
        profilePhotoHistory={candidate.profilePhotoHistory || []}
        coverPhotoHistory={candidate.coverPhotoHistory || []}
      />
    </section>
  )
}
