"use client"

/**
 * Discovery section components — premium, low-noise mini cards.
 * Tap opens full profile; no stacked Follow/Connect/Match on section tiles.
 */

import type { ReactNode } from "react"
import {
  Flame,
  MapPin,
  Clock,
  X,
  Newspaper,
  Users,
} from "lucide-react"
import type { Candidate } from "@/lib/ghc-types"
import { resolveAvatarUrl } from "@/lib/avatar"

export function DiscoverySection({
  title,
  icon,
  children,
  actionLabel,
  onAction,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="border-b border-border/60 bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-semibold text-primary hover:opacity-90"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div className="px-4 pb-3">{children}</div>
    </div>
  )
}

function safeCandidateName(c: Candidate): string {
  return typeof c?.name === "string" && c.name.trim() ? c.name.trim() : "Member"
}

function safeCandidatePhoto(c: Candidate): string {
  return resolveAvatarUrl(c?.photo, { seed: c?.id || c?.name || "member", size: 160 })
}

function safeCandidateLocation(c: Candidate): string {
  return typeof c?.location === "string" && c.location.trim()
    ? c.location.trim()
    : "Global"
}

/** Compact portrait tile — photo + name only; actions on full profile */
function MiniPersonCard({
  c,
  onViewProfile,
  accent = "from-violet-50 to-fuchsia-50",
}: {
  c: Candidate
  onViewProfile: (c: Candidate) => void
  accent?: string
}) {
  const name = safeCandidateName(c)
  const photo = safeCandidatePhoto(c)
  const location = safeCandidateLocation(c)
  return (
    <button
      type="button"
      onClick={() => onViewProfile(c)}
      className={`overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br ${accent} text-left transition hover:shadow-md active:scale-[0.99]`}
    >
      <div className="relative aspect-[4/5] w-full bg-muted">
        <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-[13px] font-bold text-white">{name}</p>
          <p className="truncate text-[10px] text-white/85">{location}</p>
        </div>
        {c.verified && (
          <span className="absolute left-2 top-2 rounded-full bg-sky-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white">
            ✓
          </span>
        )}
      </div>
    </button>
  )
}

export function TrendingSection({
  candidates,
  onViewProfile,
}: {
  candidates: Candidate[]
  onViewProfile: (c: Candidate) => void
  onLike?: (id: string) => void
  onMessage?: (id: string) => void
}) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c && (c.name || c.id) && (c.photo || c.interests?.length)).slice(0, 4) : []
  if (list.length === 0) return null

  return (
    <DiscoverySection
      title="Trending"
      icon={<Flame className="h-4 w-4 text-orange-500" />}
      actionLabel="See all"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.map((c) => (
          <MiniPersonCard key={c.id} c={c} onViewProfile={onViewProfile} accent="from-orange-50 to-red-50" />
        ))}
      </div>
    </DiscoverySection>
  )
}

export function NearbySection({
  candidates,
  onViewProfile,
}: {
  candidates: Candidate[]
  onViewProfile: (c: Candidate) => void
  onLike?: (id: string) => void
  onMessage?: (id: string) => void
}) {
  const list = Array.isArray(candidates) ? candidates.slice(0, 6) : []
  if (list.length === 0) return null

  return (
    <DiscoverySection
      title="Nearby"
      icon={<MapPin className="h-4 w-4 text-teal-600" />}
    >
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {list.map((c) => (
          <div key={c.id} className="w-28 shrink-0">
            <MiniPersonCard c={c} onViewProfile={onViewProfile} accent="from-teal-50 to-emerald-50" />
          </div>
        ))}
      </div>
    </DiscoverySection>
  )
}

export function SuggestedFriendsSection({
  candidates,
  onViewProfile,
  onFollow,
}: {
  candidates: Candidate[]
  onViewProfile: (c: Candidate) => void
  onFollow: (id: string) => void
}) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c?.name && c?.photo).slice(0, 8) : []
  if (list.length === 0) return null

  return (
    <DiscoverySection
      title="People you may know"
      icon={<Users className="h-4 w-4 text-primary" />}
    >
      <div className="space-y-2">
        {list.map((c) => {
          const name = safeCandidateName(c)
          const photo = safeCandidatePhoto(c)
          const location = safeCandidateLocation(c)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onViewProfile(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5 text-left transition hover:bg-muted/40"
            >
              <img src={photo} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-background" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-foreground">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{location}</p>
                {Array.isArray(c.interests) && c.interests[0] ? (
                  <p className="truncate text-[10px] font-medium text-primary/80">{String(c.interests[0])}</p>
                ) : null}
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onFollow(c.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation()
                    onFollow(c.id)
                  }
                }}
                className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
              >
                Follow
              </span>
            </button>
          )
        })}
      </div>
    </DiscoverySection>
  )
}

export function PopularPostsSection({
  posts,
  onViewPost,
}: {
  posts: Array<{ id: string; content?: string; authorName?: string }>
  onViewPost?: (id: string) => void
}) {
  const list = Array.isArray(posts) ? posts.slice(0, 3) : []
  if (list.length === 0) return null
  return (
    <DiscoverySection title="Popular posts" icon={<Newspaper className="h-4 w-4 text-violet-600" />}>
      <div className="space-y-2">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onViewPost?.(p.id)}
            className="w-full rounded-2xl border border-border/60 bg-muted/40 px-3 py-2.5 text-left text-[13px] text-foreground"
          >
            <span className="line-clamp-2">{p.content || "Shared a post"}</span>
            {p.authorName ? (
              <span className="mt-1 block text-[11px] text-muted-foreground">{p.authorName}</span>
            ) : null}
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

export function RecentSearchesSection({
  searches,
  onSearch,
  onClear,
  onRemove,
}: {
  searches: string[]
  onSearch: (q: string) => void
  onClear: () => void
  onRemove: (q: string) => void
}) {
  if (!searches?.length) return null
  return (
    <DiscoverySection
      title="Recent searches"
      icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      actionLabel="Clear"
      onAction={onClear}
    >
      <div className="flex flex-wrap gap-2">
        {searches.slice(0, 8).map((q) => (
          <span
            key={q}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground"
          >
            <button type="button" onClick={() => onSearch(q)} className="max-w-[8rem] truncate">
              {q}
            </button>
            <button type="button" onClick={() => onRemove(q)} aria-label={`Remove ${q}`} className="text-muted-foreground">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Re-export for App Studio blob resolution (some screens import from this barrel)
export { SuggestionsCarousel } from "./discovery-components"
