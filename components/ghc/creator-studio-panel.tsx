"use client"

/**
 * Phase 5 — minimal Creator Studio panel (non-financial).
 */
import { useCallback, useEffect, useState } from "react"

type CreatorState = {
  exists?: boolean
  tipsEnabled?: boolean
  displayName?: string | null
  tagline?: string | null
}

type PostRow = {
  id: string
  content?: string
  visibility?: string
  like_count?: number
  comment_count?: number
  view_count?: number
  qualified_view_count?: number
  upvote_count?: number
  downvote_count?: number
}

export function CreatorStudioPanel({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState<CreatorState>({})
  const [posts, setPosts] = useState<PostRow[]>([])
  const [rep, setRep] = useState<{ level?: number; levelName?: string } | null>(null)
  const [tipsEnabled, setTipsEnabled] = useState(false)
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/social/creator", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (data?.ok) {
        setCreator(data.creator || {})
        setTipsEnabled(Boolean(data.creator?.tipsEnabled))
        setPosts(Array.isArray(data.posts) ? data.posts : [])
        setRep(data.reputation || null)
      }
    } catch {
      /* fail-soft */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const enableStudio = async () => {
    setBusy(true)
    setMsg("")
    try {
      const res = await fetch("/api/social/creator", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipsEnabled }),
      })
      const data = await res.json()
      if (data?.ok) {
        setMsg("Creator Studio updated.")
        await load()
      } else {
        setMsg(String(data?.error || "Update failed"))
      }
    } catch {
      setMsg("Network error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Creator Studio</h2>
          <p className="text-xs text-muted-foreground">
            Manage your content · tips settlement deferred
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Creator status
            </p>
            <p className="text-sm font-semibold">
              {creator.exists ? "Enabled" : "Not enabled yet"}
            </p>
            {rep ? (
              <p className="text-xs text-muted-foreground">
                Reputation display: L{rep.level} · {rep.levelName} (informational only)
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tipsEnabled}
                onChange={(e) => setTipsEnabled(e.target.checked)}
              />
              Allow tip intents (no settlement yet)
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableStudio()}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {creator.exists ? "Save settings" : "Enable Creator Studio"}
            </button>
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              My content · insights
            </p>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published posts yet.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {posts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                  >
                    <p className="line-clamp-2 font-medium text-foreground">
                      {p.content || "(media post)"}
                    </p>
                    <p className="mt-1 tabular-nums text-muted-foreground">
                      views {p.view_count ?? 0} · q-views {p.qualified_view_count ?? 0} · likes{" "}
                      {p.like_count ?? 0} · comments {p.comment_count ?? 0} · ↑
                      {p.upvote_count ?? 0}/↓{p.downvote_count ?? 0}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tips: intents only. No Pi/GHC movement in this phase. Never shows fake completed
            earnings.
          </p>
        </>
      )}
    </div>
  )
}
