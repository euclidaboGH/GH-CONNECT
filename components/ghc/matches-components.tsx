"use client"

import { Heart, MessageCircle, X, MapPin, ShieldCheck, Clock3, Briefcase, Users, Sparkles, GraduationCap, Handshake, Lightbulb, MoreHorizontal } from "lucide-react"
import { useState } from "react"
import type { Candidate, MatchIntention } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { LazyImage } from "@/components/ghc/lazy-image"

export const MATCH_INTENTION_META: Record<
  MatchIntention,
  { label: string; short: string; icon: React.ReactNode; className: string }
> = {
  dating: {
    label: "Dating",
    short: "Dating",
    icon: <Heart size={12} />,
    className: "bg-rose-50 text-rose-700 border-rose-100",
  },
  friendship: {
    label: "Friendship",
    short: "Friends",
    icon: <Users size={12} />,
    className: "bg-emerald-50 text-emerald-800 border-emerald-100",
  },
  professional: {
    label: "Professional",
    short: "Pro",
    icon: <Briefcase size={12} />,
    className: "bg-sky-50 text-sky-800 border-sky-100",
  },
  collaboration: {
    label: "Collaboration",
    short: "Collab",
    icon: <Handshake size={12} />,
    className: "bg-indigo-50 text-indigo-800 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900",
  },
  mentorship: {
    label: "Mentorship",
    short: "Mentor",
    icon: <GraduationCap size={12} />,
    className: "bg-amber-50 text-amber-900 border-amber-100",
  },
  learning: {
    label: "Learning",
    short: "Learn",
    icon: <Lightbulb size={12} />,
    className: "bg-teal-50 text-teal-800 border-teal-100",
  },
  shared_interests: {
    label: "Shared interests",
    short: "Interests",
    icon: <Sparkles size={12} />,
    className: "bg-stone-100 text-stone-700 border-stone-200",
  },
}

export function calculateCommonInterests(
  userInterests: string[],
  candidateInterests: string[]
): { count: number; items: string[] } {
  const common = userInterests.filter((interest) => candidateInterests.includes(interest))
  return { count: common.length, items: common }
}

/** Infer display intention without claiming deep compatibility */
export function resolveMatchIntention(
  match: { intention?: MatchIntention; intentions?: MatchIntention[] },
  candidate?: Candidate
): MatchIntention {
  if (match.intention && MATCH_INTENTION_META[match.intention]) return match.intention
  if (match.intentions?.length && MATCH_INTENTION_META[match.intentions[0]]) {
    return match.intentions[0]
  }
  const goals = (candidate as any)?.relationshipGoals || (candidate as any)?.intentions
  if (Array.isArray(goals) && goals[0] && MATCH_INTENTION_META[goals[0] as MatchIntention]) {
    return goals[0] as MatchIntention
  }
  const mode = (candidate as any)?.primaryMode
  if (mode === "dating") return "dating"
  if (mode === "networking") return "professional"
  if (mode === "friendship") return "friendship"
  return "shared_interests"
}

export function EmptyMatchesState({ onStartSwiping }: { onStartSwiping: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background px-4 py-8 text-center">
      <div className="relative z-10 w-full max-w-sm px-2 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
          <Heart size={32} className="text-rose-500" />
        </div>
        <h2 className="mb-1.5 text-xl font-bold text-foreground">No matches yet</h2>
        <p className="mb-1 text-sm text-muted-foreground">
          Mutual interest — not automatic friendship.
        </p>
        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
          Dating · Friendship · Pro · Mentor (and more) are mutual interest types — they do not
          auto-create friends.
        </p>

        {/* Example of what a Match card will look like */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm">
          <p className="border-b border-border bg-muted/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Example match card
          </p>
          <div className="flex gap-3 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-300 dark:from-emerald-800 dark:to-teal-900" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">Alex</p>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                  Mentorship
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Lagos · Design</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shared: product, mentoring · Mutual interest only
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
                  Message
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  Profile
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onStartSwiping()
            window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))
          }}
          className="w-full rounded-2xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Express interest on Find
        </button>
      </div>
    </div>
  )
}

export function MatchCard({
  match,
  userInterests,
  candidateData,
  onMessage,
  onRemove,
  onOpenProfile,
  animationDelay = 0,
  mutualConnectionCount = 0,
}: {
  match: {
    id: string
    userId: string
    userName: string
    userPhoto: string
    matchedAt: number
    online: boolean
    intention?: MatchIntention
    intentions?: MatchIntention[]
  }
  userInterests: string[]
  candidateData?: Candidate
  onMessage: () => void
  onRemove: () => void
  onOpenProfile?: () => void
  animationDelay?: number
  mutualConnectionCount?: number
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const commonInterests = calculateCommonInterests(
    userInterests || [],
    Array.isArray(candidateData?.interests) ? candidateData!.interests! : [],
  )
  const intention = resolveMatchIntention(match, candidateData)
  const intentionMeta = MATCH_INTENTION_META[intention] || MATCH_INTENTION_META.shared_interests
  const location = candidateData?.location || "Location not shared"
  const age = candidateData?.age
  const bio = candidateData?.bio
  const profession =
    (candidateData as { profession?: string; occupation?: string } | undefined)?.profession ||
    (candidateData as { occupation?: string } | undefined)?.occupation
  const lastSeenLabel = match.online
    ? "Active now"
    : candidateData?.lastSeen
      ? `Active ${timeAgo(candidateData.lastSeen)}`
      : "Recently active"

  const signals: string[] = []
  if (commonInterests.items.length > 0) {
    signals.push(`Shared: ${commonInterests.items.slice(0, 2).join(", ")}`)
  } else if (commonInterests.count > 0) {
    signals.push(`${commonInterests.count} shared interest${commonInterests.count === 1 ? "" : "s"}`)
  }
  if (mutualConnectionCount > 0) {
    signals.push(`${mutualConnectionCount} mutual${mutualConnectionCount === 1 ? "" : "s"}`)
  }
  if (
    profession &&
    (intention === "professional" || intention === "collaboration" || intention === "mentorship")
  ) {
    signals.push(String(profession))
  }
  if (candidateData?.verified) signals.push("Verified profile")
  if (signals.length === 0) signals.push(`Mutual interest · ${intentionMeta.label}`)

  const daysSince = (Date.now() - match.matchedAt) / (24 * 60 * 60 * 1000)
  const isStale = daysSince >= 7
  const photo = match.userPhoto || candidateData?.photo || "/placeholder.svg?height=400&width=400"

  return (
    <article
      className="group gh-card-enter overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm transition hover:border-emerald-200 hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-500/30"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex min-h-[72px] gap-3 p-4">
        <button
          type="button"
          onClick={onOpenProfile}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted ring-2 ring-border"
          aria-label={`View ${match.userName}'s profile`}
        >
          <LazyImage src={photo} alt="" className="h-full w-full object-cover object-top" />
          <span
            className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
              match.online ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
            title={match.online ? "Online" : "Away"}
          />
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenProfile}
              className="truncate text-left text-[16px] font-semibold text-foreground hover:text-emerald-700"
            >
              {match.userName}
              {age ? <span className="font-medium text-muted-foreground"> · {age}</span> : null}
            </button>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${intentionMeta.className}`}
            >
              {intentionMeta.icon}
              {intentionMeta.short}
            </span>
          </div>

          <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
            <MapPin size={12} aria-hidden />
            {location}
            {profession ? ` · ${profession}` : ""}
          </p>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Why this match: </span>
            {signals.join(" · ")}
          </p>

          <p className="text-[10px] font-medium text-muted-foreground">
            Mutual interest only · matched {timeAgo(match.matchedAt)} · {lastSeenLabel}
          </p>

          {isStale && (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              Still interested? Say hello — this match has been quiet for a while.
            </p>
          )}

          {bio ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{bio}</p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMessage()
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <MessageCircle size={15} aria-hidden />
              Message
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenProfile?.()
              }}
              className="min-h-11 rounded-2xl border border-border bg-card px-3 text-[12px] font-bold text-foreground transition hover:bg-muted active:scale-[0.98]"
            >
              Profile
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((v) => !v)
                }}
                className="flex min-h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:bg-muted"
                aria-label="More match actions"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="absolute bottom-12 right-0 z-20 w-44 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onRemove()
                    }}
                    className="flex min-h-11 w-full items-center px-3 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    Unmatch
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                    }}
                    className="flex min-h-11 w-full items-center px-3 text-left text-[12px] text-muted-foreground hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function MatchCardSkeleton() {
  return (
    <div className="flex min-h-[72px] gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm" aria-hidden>
      <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
        <div className="mt-2 flex gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-2xl bg-muted" />
          <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function MatchTabs({
  activeTab,
  onTabChange,
  newCount,
  totalCount,
}: {
  activeTab: "new" | "all"
  onTabChange: (tab: "new" | "all") => void
  newCount: number
  totalCount: number
}) {
  return (
    <div className="flex gap-1 rounded-2xl border border-stone-100 bg-white p-1 shadow-sm">
      <button
        onClick={() => onTabChange("new")}
        className={`relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
          activeTab === "new"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
        }`}
      >
        New{newCount > 0 ? ` (${newCount > 99 ? "99+" : newCount})` : ""}
      </button>
      <button
        onClick={() => onTabChange("all")}
        className={`flex min-h-10 flex-1 items-center justify-center rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-95 ${
          activeTab === "all"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
        }`}
      >
        All ({totalCount})
      </button>
    </div>
  )
}

/** Intention filter chips for Matches */
export function MatchIntentionFilters({
  active,
  onChange,
  counts,
}: {
  active: MatchIntention | "all"
  onChange: (v: MatchIntention | "all") => void
  counts?: Partial<Record<MatchIntention | "all", number>>
}) {
  const keys: (MatchIntention | "all")[] = [
    "all",
    "dating",
    "friendship",
    "professional",
    "collaboration",
    "mentorship",
    "learning",
    "shared_interests",
  ]
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" role="tablist" aria-label="Match intentions">
      {keys.map((key) => {
        const selected = active === key
        const label = key === "all" ? "All intents" : MATCH_INTENTION_META[key].short
        const count = counts?.[key]
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
              selected
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {key !== "all" && (
              <span className={selected ? "text-white/80" : "text-stone-400"}>
                {MATCH_INTENTION_META[key].icon}
              </span>
            )}
            {label}
            {typeof count === "number" && count > 0 && (
              <span className={`text-[10px] ${selected ? "text-white/70" : "text-stone-400"}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
