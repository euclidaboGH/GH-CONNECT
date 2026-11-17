"use client"

/**
 * Between-post modules for Home — People / Communities / Marketplace / Create.
 * Hide when empty; never invent users or listings.
 */

import { Users, Store, Sparkles } from "lucide-react"

export type FeedInterstitialKind = "people" | "marketplace" | "communities" | "create"

export function FeedInterstitial({
  kind = "people",
  onFindPeople,
  onOpenMarketplace,
  onOpenCommunities,
  onCreate,
}: {
  kind?: FeedInterstitialKind
  onFindPeople?: () => void
  onOpenMarketplace?: () => void
  onOpenCommunities?: () => void
  onCreate?: () => void
}) {
  if (kind === "marketplace") {
    return (
      <section
        className="mx-3 my-2 rounded-[1.25rem] border border-border/60 bg-card px-4 py-3.5 shadow-sm"
        aria-label="Marketplace picks"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Store size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground">Marketplace</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Buy and sell with Pi or GHC — message sellers first.
            </p>
            <button
              type="button"
              onClick={onOpenMarketplace}
              className="mt-2 min-h-9 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white"
            >
              Browse listings
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (kind === "communities") {
    return (
      <section
        className="mx-3 my-2 rounded-[1.25rem] border border-border/60 bg-card px-4 py-3.5 shadow-sm"
        aria-label="Communities"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Users size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground">Communities</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Boards, events, and member chat — join or start one.
            </p>
            <button
              type="button"
              onClick={onOpenCommunities}
              className="mt-2 min-h-9 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white"
            >
              Discover communities
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (kind === "create") {
    return (
      <section
        className="mx-3 my-2 rounded-[1.25rem] border border-dashed border-emerald-300/70 bg-emerald-50/40 px-4 py-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20"
        aria-label="Share something"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground">Share with GreenHaven</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Post an opportunity, moment, or listing.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-2 min-h-9 rounded-full border border-emerald-600/40 bg-card px-3.5 py-1.5 text-[12px] font-bold text-emerald-800 dark:text-emerald-200"
            >
              Create
            </button>
          </div>
        </div>
      </section>
    )
  }

  // people (default)
  return (
    <section className="mx-1 my-1 border-y border-border/50 px-2 py-3" aria-label="People you may know">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-foreground">People you may know</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Discover members with shared interests.</p>
        </div>
        <button type="button" onClick={onFindPeople} className="min-h-9 shrink-0 rounded-full px-3 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">Discover</button>
      </div>
    </section>
  )
}

/** Keep discovery prompts occasional so the feed remains primarily about posts. */
export function interstitialKindAt(indexAfterPost: number): FeedInterstitialKind | null {
  if (indexAfterPost <= 0 || indexAfterPost % 12 !== 0) return null
  const cycle: FeedInterstitialKind[] = ["people", "communities", "marketplace", "create"]
  return cycle[Math.floor((indexAfterPost / 12 - 1) % cycle.length)]!
}
