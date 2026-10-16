"use client"
import { useEffect, useState, useRef } from "react"
import { socialFetchReputation } from "@/lib/social/client"
import { navigateTo } from "@/lib/navigation/navigate"
export function ReputationBadge({ className = "" }: { className?: string }) {
  const [level, setLevel] = useState(1)
  const [name, setName] = useState("Seed")
  const [points, setPoints] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const lastFetchRef = useRef(0)
  const apply = (res: { ok?: boolean; level?: number; levelName?: string; totalPoints?: number }) => {
    if (!res.ok) { setFailed(true); return }
    lastFetchRef.current = Date.now()
    setLevel(Number(res.level ?? 1)); setName(String(res.levelName || "Seed"))
    setPoints(Number(res.totalPoints ?? 0)); setFailed(false)
  }
  useEffect(() => {
    let c = false
    void (async () => {
      try { const res = await socialFetchReputation(); if (!c) apply(res) }
      catch { if (!c) setFailed(true) }
      finally { if (!c) setLoaded(true) }
    })()
    return () => { c = true }
  }, [])
  useEffect(() => {
    const onCur = () => {
      if (Date.now() - lastFetchRef.current < 8000) return
      lastFetchRef.current = Date.now()
      void socialFetchReputation().then(apply)
    }
    window.addEventListener("ghc:curation-updated", onCur)
    window.addEventListener("ghc:daily-reward-claimed", onCur)
    window.addEventListener("ghc:post-engagement", onCur)
    return () => {
      window.removeEventListener("ghc:curation-updated", onCur)
      window.removeEventListener("ghc:daily-reward-claimed", onCur)
      window.removeEventListener("ghc:post-engagement", onCur)
    }
  }, [])
  if (!loaded) return <span className={`inline-flex h-6 w-24 animate-pulse rounded-full bg-muted ${className}`} aria-hidden />
  if (failed) return <span className={`inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ${className}`}>Rep · —</span>
  return (
    <button type="button" onClick={() => { if (!navigateTo("profile")) { try { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "profile" })) } catch { /* */ } } }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 ${className}`}
      aria-label={`Reputation ${name}, level ${level}, ${points} points`}>
      <span className="tabular-nums">L{level}</span><span className="opacity-70">·</span><span>{name}</span><span className="tabular-nums opacity-80">{points}</span>
    </button>
  )
}
