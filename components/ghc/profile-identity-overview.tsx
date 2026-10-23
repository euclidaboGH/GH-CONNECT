"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, RefreshCw, ShieldCheck, Users } from "lucide-react"

type Snapshot = {
  followers: number; following: number
  level: number; levelName: string; points: number; progress: number
  achievements: number; durable: boolean
}

export function ProfileIdentityOverview({ onCounts }: { onCounts?: (counts: { followers: number; following: number }) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const [followRes, repRes, achRes] = await Promise.all([
        fetch("/api/social/follows", { credentials: "include", cache: "no-store" }),
        fetch("/api/social/reputation", { credentials: "include", cache: "no-store" }),
        fetch("/api/profile/achievements", { credentials: "include", cache: "no-store" }),
      ])
      const [f, r, a] = await Promise.all([followRes.json().catch(() => ({})), repRes.json().catch(() => ({})), achRes.json().catch(() => ({}))])
      if (!followRes.ok) throw new Error(String(f.error || "Identity graph unavailable"))
      const next = {
        followers: Math.max(0, Number(f.followersCount) || 0), following: Math.max(0, Number(f.followingCount) || 0),
        level: Math.max(1, Number(r.level) || 1), levelName: String(r.levelName || "Seed"), points: Math.max(0, Number(r.totalPoints) || 0),
        progress: Math.max(0, Math.min(1, Number(r.progressRatio) || 0)), achievements: Array.isArray(a.achievements) ? a.achievements.length : 0,
        durable: Boolean(f.durable && r.durable !== false && a.durable !== false),
      }
      setSnapshot(next); onCounts?.({ followers: next.followers, following: next.following })
    } catch (e) { setError(e instanceof Error ? e.message : "Identity snapshot unavailable") }
    finally { setLoading(false) }
  }, [loading, onCounts])

  useEffect(() => { void refresh() }, []) // intentional initial authoritative snapshot
  useEffect(() => {
    const sync = () => { void refresh() }
    window.addEventListener("ghc:social-mutation", sync)
    window.addEventListener("ghc:connection-updated", sync)
    window.addEventListener("ghc:reputation-updated", sync)
    return () => { window.removeEventListener("ghc:social-mutation", sync); window.removeEventListener("ghc:connection-updated", sync); window.removeEventListener("ghc:reputation-updated", sync) }
  }, [refresh])

  if (!snapshot && !error) return <div className="mt-3 h-20 animate-pulse rounded-[1.1rem] bg-muted/60" aria-label="Loading identity status" />
  if (!snapshot) return <button type="button" onClick={() => void refresh()} className="mt-3 w-full rounded-[1.1rem] border border-border/60 bg-card px-3 py-3 text-left text-xs font-semibold">Identity status unavailable · Tap to retry</button>
  return (
    <section className="mt-3 rounded-[1.1rem] border border-border/60 bg-card p-3 shadow-sm" aria-label="GreenHaven identity status">
      <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold">Identity & trust</p><p className="text-[10px] text-muted-foreground">Server-authoritative social graph and reputation</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-full p-2 hover:bg-muted" aria-label="Refresh identity status"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/45 px-2 py-2"><ShieldCheck size={15} className="mx-auto"/><p className="mt-1 text-sm font-bold">{snapshot.levelName}</p><p className="text-[9px] text-muted-foreground">Level {snapshot.level} · {snapshot.points} pts</p></div>
        <div className="rounded-xl bg-muted/45 px-2 py-2"><Users size={15} className="mx-auto"/><p className="mt-1 text-sm font-bold">{snapshot.followers}</p><p className="text-[9px] text-muted-foreground">Followers</p></div>
        <div className="rounded-xl bg-muted/45 px-2 py-2"><Award size={15} className="mx-auto"/><p className="mt-1 text-sm font-bold">{snapshot.achievements}</p><p className="text-[9px] text-muted-foreground">Achievements</p></div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${Math.round(snapshot.progress * 100)}%` }} /></div>
      <p className="mt-1 text-[9px] text-muted-foreground">{snapshot.durable ? "Durable identity state" : "Some identity services are temporarily non-durable"}</p>
    </section>
  )
}
