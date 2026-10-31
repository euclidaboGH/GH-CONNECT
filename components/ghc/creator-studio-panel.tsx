"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, RefreshCw, Sparkles, Wallet } from "lucide-react"
import { UnifiedActivityCenter } from "./unified-activity-center"

type CreatorState = { exists?: boolean; tipsEnabled?: boolean; displayName?: string | null; tagline?: string | null }
type PostRow = { id: string; content?: string; visibility?: string; community_id?: string | null; community_name?: string | null; like_count?: number; comment_count?: number; share_count?: number; view_count?: number; qualified_view_count?: number; upvote_count?: number; downvote_count?: number }
type CreatorEconomy = { tipPiGross?: number; tipPiPayable?: number; tipPiPaid?: number; tipGhcSettled?: number; tipCount?: number; rewardTotal?: number; rewardAuthor?: number; rewardCuration?: number; rewardPosts?: number; walletCreatorCredits?: number; walletCreatorDebits?: number }
type EconomyState = { available?: number; pending?: number; locked?: number; balance?: number; curationBalance?: number; currency?: string; server?: { curationRedistributeEnabled?: boolean; issuanceFromSocialActions?: boolean } }

const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const fmt = (value: unknown) => n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })

export function CreatorStudioPanel({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState<CreatorState>({})
  const [posts, setPosts] = useState<PostRow[]>([])
  const [rep, setRep] = useState<{ level?: number; levelName?: string; totalPoints?: number } | null>(null)
  const [economy, setEconomy] = useState<EconomyState | null>(null)
  const [creatorEconomy, setCreatorEconomy] = useState<CreatorEconomy | null>(null)
  const [windowDays, setWindowDays] = useState<"all" | 7 | 30>("all")
  const [tipsEnabled, setTipsEnabled] = useState(false)
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [creatorRes, economyRes] = await Promise.all([
        fetch("/api/social/creator", { credentials: "include", cache: "no-store" }),
        fetch("/api/social/economy/status", { credentials: "include", cache: "no-store" }),
      ])
      const [data, economyData] = await Promise.all([creatorRes.json().catch(() => ({})), economyRes.json().catch(() => ({}))])
      if (data?.ok) {
        setCreator(data.creator || {})
        setTipsEnabled(Boolean(data.creator?.tipsEnabled))
        setPosts(Array.isArray(data.posts) ? data.posts : [])
        setRep(data.reputation || null)
        setCreatorEconomy(data.creatorEconomy || null)
      }
      setEconomy(economyData?.ok ? economyData : null)
    } catch { /* fail-soft; never invent creator/economy state */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener("ghc:curation-updated", refresh)
    window.addEventListener("ghc:post-engagement", refresh)
    window.addEventListener("ghc:wallet-refresh", refresh)
    return () => {
      window.removeEventListener("ghc:curation-updated", refresh)
      window.removeEventListener("ghc:post-engagement", refresh)
      window.removeEventListener("ghc:wallet-refresh", refresh)
    }
  }, [load])

  const filteredPosts = useMemo(() => {
    if (windowDays === "all") return posts
    const cutoff = Date.now() - windowDays * 86400000
    return posts.filter((p) => { const t = Date.parse(String((p as PostRow & { created_at?: string }).created_at || "")); return Number.isFinite(t) && t >= cutoff })
  }, [posts, windowDays])

  const totals = useMemo(() => filteredPosts.reduce((a, p) => ({
    views: a.views + n(p.view_count), qualified: a.qualified + n(p.qualified_view_count),
    likes: a.likes + n(p.like_count), comments: a.comments + n(p.comment_count), shares: a.shares + n(p.share_count),
    up: a.up + n(p.upvote_count), down: a.down + n(p.downvote_count), communities: a.communities + (p.community_id ? 1 : 0),
  }), { views: 0, qualified: 0, likes: 0, comments: 0, shares: 0, up: 0, down: 0, communities: 0 }), [filteredPosts])

  const enableStudio = async () => {
    setBusy(true); setMsg("")
    try {
      const res = await fetch("/api/social/creator", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipsEnabled }) })
      const data = await res.json()
      if (data?.ok) { setMsg("Creator Studio updated."); await load() } else setMsg(String(data?.error || "Update failed"))
    } catch { setMsg("Network error") } finally { setBusy(false) }
  }

  const openPost = (postId: string) => {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
    window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId, action: "insights" } }))
    onClose?.()
  }

  return <div className="space-y-4 p-4">
    <div className="flex items-center justify-between gap-2">
      <div><h2 className="text-lg font-bold text-foreground">Creator Studio</h2><p className="text-xs text-muted-foreground">Content, curation, reputation and wallet-backed creator activity</p></div>
      <div className="flex gap-1"><button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50" aria-label="Refresh Creator Studio"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></button>{onClose ? <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Close</button> : null}</div>
    </div>

    {loading ? <p className="text-sm text-muted-foreground">Loading verified creator state…</p> : <>
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-2">
        <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Performance window</p>
        <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Creator performance window">
          {(["all", 30, 7] as const).map((d) => <button key={String(d)} type="button" onClick={() => setWindowDays(d)} className={`rounded-full px-3 py-1 text-[10px] font-bold ${windowDays === d ? "bg-background shadow" : "text-muted-foreground"}`}>{d === "all" ? "All" : `${d}d`}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3"><BarChart3 size={16}/><p className="mt-2 text-lg font-bold">{filteredPosts.length}</p><p className="text-[10px] text-muted-foreground">Published posts</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><Sparkles size={16}/><p className="mt-2 text-lg font-bold">{totals.qualified.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Qualified views</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><p className="text-sm font-bold">↑ {totals.up} / ↓ {totals.down}</p><p className="mt-3 text-[10px] text-muted-foreground">Curation signals</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><Wallet size={16}/><p className="mt-2 text-lg font-bold">{economy ? fmt(economy.available ?? economy.balance) : "—"}</p><p className="text-[10px] text-muted-foreground">Available GHC</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3"><p className="text-lg font-bold">{fmt(creatorEconomy?.rewardAuthor)}</p><p className="text-[10px] text-muted-foreground">Author reward recorded</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><p className="text-lg font-bold">{fmt(creatorEconomy?.rewardCuration)}</p><p className="text-[10px] text-muted-foreground">Curation allocation</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><p className="text-lg font-bold">{fmt(creatorEconomy?.tipGhcSettled)}</p><p className="text-[10px] text-muted-foreground">GHC tips settled</p></div>
        <div className="rounded-2xl border border-border bg-card p-3"><p className="text-lg font-bold">{fmt(creatorEconomy?.tipPiGross)}</p><p className="text-[10px] text-muted-foreground">Verified Pi tips</p></div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Creator status</p><p className="text-sm font-semibold">{creator.exists ? "Enabled" : "Not enabled yet"}</p></div>{rep ? <div className="text-right"><p className="text-xs font-bold">L{rep.level} · {rep.levelName}</p><p className="text-[10px] text-muted-foreground">{n(rep.totalPoints).toLocaleString()} reputation points</p></div> : null}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tipsEnabled} onChange={(e) => setTipsEnabled(e.target.checked)}/>Allow creator tips</label>
        <button type="button" disabled={busy} onClick={() => void enableStudio()} className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{creator.exists ? "Save settings" : "Enable Creator Studio"}</button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Content performance</p><p className="text-[10px] text-muted-foreground">{totals.comments} comments · {totals.shares} shares</p></div>
        {filteredPosts.length === 0 ? <p className="text-sm text-muted-foreground">No published posts yet.</p> : <ul className="max-h-80 space-y-2 overflow-y-auto">{filteredPosts.map((p) => <li key={p.id}><button type="button" onClick={() => openPost(p.id)} className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted/60"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 font-medium text-foreground">{p.content || "(media post)"}</p>{p.community_name ? <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-700">{p.community_name}</span> : null}</div><p className="mt-1 tabular-nums text-muted-foreground">views {p.view_count ?? 0} · qualified {p.qualified_view_count ?? 0} · likes {p.like_count ?? 0} · comments {p.comment_count ?? 0} · shares {p.share_count ?? 0} · ↑{p.upvote_count ?? 0}/↓{p.downvote_count ?? 0}</p></button></li>)}</ul>}
      </div>

      <UnifiedActivityCenter limit={12} />

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
        {economy ? <>Wallet values come from the server economy snapshot. Creator reward/tip totals are read-only server records; they are not estimates. Curation is {economy.server?.curationRedistributeEnabled ? "wallet-funded" : "currently disabled"}; social actions do not mint GHC. Pi tips become creator-payable only after provider verification, while GHC tips require the feature-gated atomic ledger transfer.</> : <>Wallet/economy state is unavailable, so Creator Studio does not estimate or invent earnings.</>}
      </div>
    </>}
  </div>
}
