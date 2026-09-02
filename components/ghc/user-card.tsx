"use client"

/**
 * UserCard — premium discovery profile card.
 * Hero photo, clear hierarchy, 1 primary + compact secondary actions.
 * Full Follow / Connect / Match live in the ••• menu (and on full profile).
 */

import { memo, useMemo, useState } from "react"
import { Heart, MoreHorizontal, MapPin, X } from "lucide-react"
import { ActionSheet, closeAllActionSheets } from "./action-sheet"
import type { Candidate } from "@/lib/ghc-types"
import { LazyImage } from "./lazy-image"
import { resolveAvatarUrl } from "@/lib/avatar"
import { RelationshipActions } from "./relationship-actions"

export function calculateMatchScore(
  candidate: Candidate,
  userInterests: string[] = [],
  userAge?: number,
  userLocation?: string
): number {
  const candidateInterests = Array.isArray(candidate.interests) ? candidate.interests : []
  const normalizedUserInterests = Array.isArray(userInterests) ? userInterests : []
  const normalizedCandidateInterests = candidateInterests
    .filter((interest): interest is string => typeof interest === "string")
    .map((interest) => interest.trim().toLowerCase())
    .filter(Boolean)
  const normalizedUserInterestSet = new Set(
    normalizedUserInterests
      .filter((interest): interest is string => typeof interest === "string")
      .map((interest) => interest.trim().toLowerCase())
      .filter(Boolean)
  )
  const sharedInterests = new Set(
    normalizedCandidateInterests.filter((interest) => normalizedUserInterestSet.has(interest))
  )
  const interestPool = new Set([...normalizedCandidateInterests, ...normalizedUserInterestSet])
  const interestScore = interestPool.size > 0 ? (sharedInterests.size / interestPool.size) * 35 : 0
  const locationScore =
    userLocation &&
    candidate.location &&
    userLocation.trim().toLowerCase() === candidate.location.trim().toLowerCase()
      ? 15
      : 0
  const ageDifference =
    typeof userAge === "number" && Number.isFinite(userAge)
      ? Math.abs(userAge - candidate.age)
      : null
  const ageScore = ageDifference === null ? 0 : Math.max(0, 15 - Math.min(ageDifference, 15))
  const profileSignals = (candidate.verified ? 10 : 0) + (candidate.online ? 10 : 0)
  const baseline = 30

  return Math.round(
    Math.min(100, baseline + interestScore + locationScore + ageScore + profileSignals)
  )
}

export type UserCardProps = {
  candidate: Candidate
  onViewProfile: () => void
  onLike: () => void
  onPass?: () => void
  onMessage: () => void
  onFollow?: () => void
  isFollowing?: boolean
  /** Outgoing interest, not yet a Match */
  interestSent?: boolean
  isMatched?: boolean
  canMessage?: boolean
  mutualConnections?: number
  mutualInterestNames?: string[]
  matchScore?: number
  matchReason?: string
  userInterests?: string[]
  userAge?: number
  userLocation?: string
  /** Prefer single-column hero cards on Find */
  variant?: "grid" | "hero"
  /** Emphasize role · industry for Professionals lane */
  professionalMode?: boolean
  onReport?: () => void
  onBlock?: () => void
}

function UserCardInner({
  candidate,
  onViewProfile,
  onLike,
  onPass,
  onMessage,
  onFollow,
  isFollowing = false,
  interestSent = false,
  isMatched = false,
  canMessage = false,
  mutualConnections = 0,
  mutualInterestNames = [],
  matchScore: matchScoreProp,
  matchReason = "Based on your interests",
  userInterests = [],
  userAge,
  userLocation,
  variant = "hero",
  professionalMode = false,
  onReport,
  onBlock,
}: UserCardProps) {
  const safeName =
    typeof candidate?.name === "string" && candidate.name.trim()
      ? candidate.name.trim()
      : "Member"
  const safePhoto = resolveAvatarUrl(candidate?.photo, {
    seed: candidate?.id || candidate?.name || "member",
    size: 512,
  })
  const safeLocation =
    typeof candidate?.location === "string" && candidate.location.trim()
      ? candidate.location.trim()
      : "Global"
  const safeOnline = Boolean(candidate?.online)
  const safeAge = Number.isFinite(Number(candidate?.age)) ? Number(candidate.age) : null
  const candidateInterests = Array.isArray(candidate?.interests)
    ? candidate.interests.filter((interest): interest is string => typeof interest === "string")
    : []

  const score = useMemo(() => {
    if (typeof matchScoreProp === "number" && matchScoreProp > 0) return matchScoreProp
    return calculateMatchScore(candidate, userInterests, userAge, userLocation)
  }, [candidate, matchScoreProp, userInterests, userAge, userLocation])

  const [menuOpen, setMenuOpen] = useState(false)
  const [liked, setLiked] = useState(false)
  const [compatOpen, setCompatOpen] = useState(true)

  const sameCity = Boolean(
    userLocation &&
      safeLocation &&
      safeLocation !== "Global" &&
      userLocation
        .toLowerCase()
        .split(/[,\s]+/)
        .filter((p) => p.length > 2)
        .some((part) => safeLocation.toLowerCase().includes(part))
  )

  const professionLine =
    typeof (candidate as { occupation?: string }).occupation === "string"
      ? (candidate as { occupation?: string }).occupation
      : typeof (candidate as { profession?: string }).profession === "string"
        ? (candidate as { profession?: string }).profession
        : ""

  const photoH = variant === "hero" ? "aspect-[3/4] max-h-72" : "aspect-[3/4] max-h-56"

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-card text-card-foreground shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition hover:border-emerald-400/40 hover:shadow-[0_12px_32px_rgba(16,185,129,0.12)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Hero photo */}
      <button
        type="button"
        onClick={onViewProfile}
        className={`relative block w-full overflow-hidden bg-muted text-left ${photoH}`}
        aria-label={`View ${safeName}'s profile`}
      >
        <LazyImage
          src={safePhoto}
          alt=""
          online={safeOnline}
          verified={Boolean(candidate?.verified)}
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute left-3 right-3 bottom-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {Boolean(candidate?.verified) && (
              <span className="rounded-full bg-sky-500/95 px-2 py-0.5 text-[10px] font-bold text-white">
                Verified
              </span>
            )}
            {safeOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> Active
              </span>
            )}
          </div>
          <h3 className="text-[17px] sm:text-lg font-semibold tracking-tight text-white drop-shadow-sm">
            {safeName}
            {safeAge !== null ? (
              <span className="font-semibold text-white/90">, {safeAge}</span>
            ) : null}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-white/90">
            <MapPin size={12} className="shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{safeLocation}</span>
          </p>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {/* Compatibility — tap for honest breakdown (not a magic %) */}
        <button
          type="button"
          onClick={() => setCompatOpen((v) => !v)}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 text-left transition active:scale-[0.99] dark:from-emerald-950/40 dark:to-teal-950/30"
          aria-expanded={compatOpen}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Common ground
            </span>
            <span className="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-200/80">tap for details</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(interestSent && !isMatched) && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300">
                Interest sent
              </span>
            )}
            {isMatched && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                Match
              </span>
            )}
            {mutualInterestNames.slice(0, 1).map((interest) => (
              <span key={`cg-${interest}`} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
                {interest}
              </span>
            ))}
            {sameCity && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-950/50 dark:text-teal-100">
                Same area
              </span>
            )}
            {mutualConnections > 0 && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50">
                {mutualConnections} mutual
              </span>
            )}
            {!mutualInterestNames.length && !sameCity && !mutualConnections && !interestSent && !isMatched && (
              <span className="text-[11px] text-emerald-800/70 dark:text-emerald-200/70">
                {matchReason || "Interests · location · activity"}
              </span>
            )}
          </div>
        </button>
        {compatOpen && (
          <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Why you're seeing this person</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {mutualInterestNames.length > 0 ? (
                <li>Shared interests: {mutualInterestNames.slice(0, 4).join(", ")}</li>
              ) : (
                <li>No shared interests listed yet</li>
              )}
              <li>Location: {sameCity ? `Near you · ${safeLocation}` : safeLocation}</li>
              <li>Activity: {safeOnline ? "Active recently" : "Typical profile activity"}</li>
              {professionLine ? <li>Role: {professionLine}</li> : null}
            </ul>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              This is a soft signal — not a guarantee of compatibility.
            </p>
          </div>
        )}

        {(professionLine || professionalMode) ? (
          <p className="truncate text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
            {[professionLine || (professionalMode ? "Professional" : null), professionalMode ? "Open to connect" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}

        {typeof candidate.bio === "string" && candidate.bio.trim() ? (
          <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {candidate.bio.trim()}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {mutualInterestNames.slice(0, 3).map((interest) => (
            <span
              key={interest}
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
            >
              {interest}
            </span>
          ))}
          {candidateInterests
            .filter((i) => !mutualInterestNames.includes(i))
            .slice(0, mutualInterestNames.length ? 1 : 3)
            .map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {interest}
              </span>
            ))}
          {sameCity && (
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              Nearby
            </span>
          )}
          {mutualConnections > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {mutualConnections} mutual
            </span>
          )}
        </div>

        {/* Actions: primary + heart + more */}
        <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={onViewProfile}
            className="min-h-11 flex-1 rounded-2xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition active:scale-[0.98]"
          >
            View profile
          </button>
          <button
            type="button"
            onClick={() => {
              setLiked(true)
              onLike()
            }}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95 ${
              liked || interestSent
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
            aria-label={interestSent && !isMatched ? `Interest sent to ${safeName}` : `Express interest in ${safeName}`}
            disabled={interestSent || isMatched}
          >
            <Heart size={18} fill={liked || interestSent ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => {
                if (!v) closeAllActionSheets()
                return !v
              })
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:bg-muted active:scale-95"
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {menuOpen && (
          <ActionSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Relationship">
            <div className="px-1 pb-2">
              <RelationshipActions
                userId={candidate.id}
                userName={safeName}
                userPhoto={safePhoto}
                compact
                className="!flex-col items-stretch gap-1.5"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onMessage()
                setMenuOpen(false)
              }}
              className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-foreground hover:bg-muted"
            >
              {canMessage ? "Message" : "Message request"}
            </button>
            {onPass && (
              <button
                type="button"
                onClick={() => {
                  onPass()
                  setMenuOpen(false)
                }}
                className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-muted-foreground hover:bg-muted"
              >
                Not interested
              </button>
            )}
            {onReport && (
              <button
                type="button"
                onClick={() => {
                  onReport()
                  setMenuOpen(false)
                }}
                className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-muted-foreground hover:bg-muted"
              >
                Report
              </button>
            )}
            {onBlock && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm(`Block ${safeName}? They will not be able to interact with you.`)) {
                    return
                  }
                  onBlock()
                  setMenuOpen(false)
                }}
                className="flex min-h-11 w-full items-center rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-red-600 hover:bg-red-50"
              >
                Block
              </button>
            )}
          </ActionSheet>
        )}
      </div>
    </article>
  )
}


/** Compact list row — “Discover People” sample style */
export function DiscoverListRow({
  candidate,
  onViewProfile,
  onLike,
  isFollowing,
}: {
  candidate: Candidate
  onViewProfile: () => void
  onLike?: () => void
  isFollowing?: boolean
}) {
  const name =
    typeof candidate?.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Member"
  const photo = resolveAvatarUrl(candidate?.photo, {
    seed: candidate?.id || name,
    size: 96,
  })
  const subtitle =
    typeof (candidate as { occupation?: string }).occupation === "string"
      ? (candidate as { occupation?: string }).occupation
      : (Array.isArray(candidate.interests) && candidate.interests[0]) ||
        candidate.location ||
        "On GreenHaven"
  const tagline =
    typeof candidate.bio === "string" && candidate.bio.trim()
      ? candidate.bio.trim()
      : Array.isArray(candidate.interests)
        ? candidate.interests.slice(0, 2).join(" · ")
        : ""

  return (
    <button
      type="button"
      onClick={onViewProfile}
      className="flex w-full items-center gap-3 rounded-[1.15rem] border border-border/60 bg-card px-3.5 py-3 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition hover:border-emerald-400/35 hover:bg-muted/30 hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
        <LazyImage src={photo} alt="" className="h-full w-full object-cover" online={Boolean(candidate.online)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-bold text-foreground">{name}</p>
          {candidate.verified && (
            <span className="text-[10px] font-bold text-sky-600" aria-label="Verified">
              ✓
            </span>
          )}
        </div>
        <p className="truncate text-[12px] font-medium text-muted-foreground">{subtitle}</p>
        {tagline ? <p className="truncate text-[11px] text-muted-foreground/90">{tagline}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onLike && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onLike()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation()
                onLike()
              }
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              isFollowing
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-border bg-background text-muted-foreground"
            }`}
            aria-label="Like"
          >
            <Heart size={16} fill={isFollowing ? "currentColor" : "none"} />
          </span>
        )}
        <span className="text-muted-foreground" aria-hidden>
          ›
        </span>
      </div>
    </button>
  )
}

export const UserCard = memo(UserCardInner)
export default UserCard
