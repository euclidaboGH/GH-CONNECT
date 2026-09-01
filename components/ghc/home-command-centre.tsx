"use client"

/**
 * Home top — greeting + daily reward only.
 * Creating content is handled by the bottom navigation Create (+) button
 * (and Create hub). No second "What's on your mind?" strip on the feed.
 */

import { useMemo } from "react"
import { useGHCProfile } from "@/contexts/ghc-context"
import { DailyRewardHomeExperience } from "./daily-reward-experience"

function timeGreeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return "Good night"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 21) return "Good evening"
  return "Good night"
}

function firstName(displayName?: string | null): string {
  const n = (displayName || "").trim()
  if (!n) return "there"
  return n.split(/\s+/)[0]
}

export function HomeCommandCentre({
  onCompose: _onCompose,
}: {
  onCompose?: (kind?: string) => void
  onOpenDiscover?: () => void
  onOpenCommunities?: () => void
  onOpenRewards?: () => void
}) {
  const ghc = useGHCProfile() as { profile?: { displayName?: string; photos?: string[] } }
  const profile = ghc.profile
  const greet = useMemo(() => timeGreeting(), [])
  const name = firstName(profile?.displayName)
  const avatar = profile?.photos?.[0]

  return (
    <section className="space-y-2.5" aria-label="Home">
      <header className="flex items-center gap-2.5 px-0.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-emerald-200/70 dark:bg-emerald-950 dark:ring-emerald-800">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-200">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {greet}, {name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Connect · share · grow — your feed
          </p>
        </div>
      </header>

      <DailyRewardHomeExperience />
    </section>
  )
}

export default HomeCommandCentre
