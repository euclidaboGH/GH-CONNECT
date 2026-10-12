"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, RefreshCw, Sparkles } from "lucide-react"

type ProgressionResponse = {
  ok?: boolean
  totalXp?: number
  level?: number
  nextLevel?: number | null
  pointsToNext?: number
  progressRatio?: number
  rulesVersion?: string
  events?: Array<{ id: string; eventType: string; xp: number; createdAt: string | number }>
}

const LABELS: Record<string, string> = {
  profile_completed: "Profile completed",
  original_post_published: "First original post",
  helpful_reply_verified: "Helpful reply verified",
  community_contribution_verified: "Community contribution",
  marketplace_order_completed: "Verified marketplace order",
  learning_milestone: "Learning milestone",
}

export function ProfileProgressionCard() {
  const [data, setData] = useState<ProgressionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch("/api/social/progression", { cache: "no-store" })
      const result = await response.json().catch(() => null) as ProgressionResponse | null
      if (!response.ok || !result?.ok) throw new Error("PROGRESSION_UNAVAILABLE")
      setData(result)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const level = Math.max(1, Number(data?.level) || 1)
  const ratio = Math.min(1, Math.max(0, Number(data?.progressRatio) || 0))
  const xp = Math.max(0, Number(data?.totalXp) || 0)

  return (
    <section className="mt-4 w-full px-4" aria-label="Your contribution progress">
      <div className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <Award size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground">Contribution progress</h2>
              <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh contribution progress" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              </button>
            </div>
            {loading && !data ? (
              <p className="mt-2 text-xs text-muted-foreground">Loading verified progress…</p>
            ) : error && !data ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Progress is temporarily unavailable.</p>
                <button type="button" onClick={() => void load()} className="mt-2 text-xs font-bold text-primary underline underline-offset-2">Try again</button>
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black tracking-tight text-foreground">Level {level}</p>
                    <p className="text-xs text-muted-foreground">{xp.toLocaleString()} verified XP</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground">{data?.nextLevel ? `Level ${data.nextLevel} next` : "Maximum level reached"}</p>
                    <p className="text-[11px] text-muted-foreground">{data?.nextLevel ? `${Math.max(0, Number(data.pointsToNext) || 0).toLocaleString()} XP to go` : "Well done"}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
                  <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${Math.round(ratio * 100)}%` }} />
                </div>
                {data?.events?.length ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recent milestones</p>
                    {data.events.slice(0, 3).map((event) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground"><Sparkles size={12} className="shrink-0" aria-hidden="true" />{LABELS[event.eventType] || "Verified contribution"}</span>
                        <span className="shrink-0 font-bold text-foreground">+{event.xp} XP</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">XP tracks verified contribution only. It is separate from GHC wallet value, membership, reputation and trust, and does not itself unlock financial privileges.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
