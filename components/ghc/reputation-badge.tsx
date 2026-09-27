"use client"

/**
 * Phase 4 — minimal reputation display (trust signal only).
 */
import { useEffect, useState } from "react"
import { socialFetchReputation } from "@/lib/social/client"

export function ReputationBadge({ className = "" }: { className?: string }) {
  const [level, setLevel] = useState(1)
  const [name, setName] = useState("Seed")
  const [points, setPoints] = useState(0)
  const [toNext, setToNext] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await socialFetchReputation()
      if (cancelled) return
      if (res.ok) {
        setLevel(Number(res.level ?? 1))
        setName(String(res.levelName || "Seed"))
        setPoints(Number(res.totalPoints ?? 0))
        setToNext(res.pointsToNext ?? null)
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded) {
    return (
      <div className={`rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground ${className}`}>
        Reputation…
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 ${className}`}
      aria-label={`Reputation level ${level}, ${name}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
        Reputation
      </p>
      <p className="text-sm font-semibold text-foreground">
        L{level} · {name}
      </p>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {points} pts
        {toNext != null ? ` · ${toNext} to next` : " · max level"}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Trust signal only · not currency
      </p>
    </div>
  )
}
