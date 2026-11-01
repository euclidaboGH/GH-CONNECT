"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Award, RefreshCw, ShieldCheck, TrendingUp, Users } from "lucide-react"

type Snapshot = {
  followers: number; following: number
  level: number; levelName: string; points: number; progress: number
  achievements: number; durable: boolean
}

function outcomeFor(snapshot: Snapshot) {
  if (snapshot.following === 0) return { title: "Build your network", detail: "Follow relevant people so your GreenHaven graph starts reflecting the people and work that matter to you.", action: "Discover people", target: "discover" }
  if (snapshot.followers === 0) return { title: "Strengthen your public identity", detail: "Your network has started. Keep your profile useful and participate consistently so others can discover your contribution.", action: "Review profile", target: "profile" }
  if (snapshot.achievements === 0) return { title: "Turn participation into proof", detail: "Your social graph is active. Meaningful participation can build visible achievement and reputation signals over time.", action: "Explore activity", target: "home" }
  if (snapshot.progress < 1) return { title: `Progress beyond ${snapshot.levelName}`, detail: "Your identity already has durable network and achievement signals. Keep contributing meaningfully toward your next reputation level.", action: "Continue participating", target: "home" }
  return { title: "Identity momentum is strong", detail: "Your current reputation level is complete. Keep your network and contribution quality active across GreenHaven.", action: "See opportunities", target: "discover" }
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

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- intentional one-shot server snapshot on mount
  useEffect(() => {
    const sync = () => { void refresh() }
    window.addEventListener("ghc:social-mutation", sync)
    window.addEventListener("ghc:connection-updated", sync)
    window.addEventListener("ghc:reputation-updated", sync)
    return () => { window.removeEventListener("ghc:social-mutation", sync); window.removeEventListener("ghc:connection-updated", sync); window.removeEventListener("ghc:reputation-updated", sync) }
  }, [refresh])

  const outcome = useMemo(() => snapshot ? outcomeFor(snapshot) : null, [snapshot])
  const navigate = (target: string) => {
    try { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: target })) } catch { /* navigation remains available through canonical shell */ }
  }

  if (!snapshot && !error) return <div className="mt-3 h-32 animate-pulse rounded-[1.25rem] bg-muted/60" aria-label="Loading identity status" />
  if (!snapshot) return <button type="button" onClick={() => void refresh()} className="mt-3 min-h-11 w-full rounded-[1.25rem] border border-border/60 bg-card px-3 py-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Identity status unavailable · Tap to retry</button>
  return (
    <section className="mt-3 overflow-hidden rounded-[1.25rem] border border-border/60 bg-card shadow-[var(--gh-card-shadow)]" aria-label="GreenHaven identity and reputation results">
      <div className="flex items-start justify-between gap-3 px-3.5 pb-2 pt-3.5">
        <div><p className="flex items-center gap-1.5 text-xs font-bold"><ShieldCheck size={15} aria-hidden /> Identity results</p><p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">Durable network, achievement and reputation signals from your GreenHaven activity.</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Refresh identity results"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
      </div>
      <div className="grid grid-cols-2 gap-px border-y border-border/50 bg-border/50 sm:grid-cols-4">
        <div className="bg-card px-3 py-3"><ShieldCheck size={14} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-1 text-sm font-black">{snapshot.levelName}</p><p className="text-[9px] text-muted-foreground">Level {snapshot.level} · {snapshot.points} pts</p></div>
        <div className="bg-card px-3 py-3"><Users size={14} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-1 text-sm font-black tabular-nums">{snapshot.followers}</p><p className="text-[9px] text-muted-foreground">Followers</p></div>
        <div className="bg-card px-3 py-3"><TrendingUp size={14} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-1 text-sm font-black tabular-nums">{snapshot.following}</p><p className="text-[9px] text-muted-foreground">Following</p></div>
        <div className="bg-card px-3 py-3"><Award size={14} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-1 text-sm font-black tabular-nums">{snapshot.achievements}</p><p className="text-[9px] text-muted-foreground">Achievements</p></div>
      </div>
      <div className="px-3.5 py-3.5">
        <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reputation progress</p><p className="text-[10px] font-bold tabular-nums">{Math.round(snapshot.progress * 100)}%</p></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-600 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round(snapshot.progress * 100)}%` }} /></div>
        {outcome ? <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-emerald-600/[0.06] px-3 py-2.5"><div className="min-w-0"><p className="text-[11px] font-bold text-foreground">{outcome.title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{outcome.detail}</p></div><button type="button" onClick={() => navigate(outcome.target)} className="min-h-10 shrink-0 rounded-full border border-emerald-600/20 bg-card px-3 text-[10px] font-bold text-emerald-700 shadow-sm dark:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{outcome.action}</button></div> : null}
        <p className="mt-2 text-[9px] text-muted-foreground">{snapshot.durable ? "Server-confirmed identity state" : "Some identity services are temporarily non-durable"}</p>
      </div>
    </section>
  )
}
