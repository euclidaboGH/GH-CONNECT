"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, Loader2 } from "lucide-react"
import { socialListCommunities } from "@/lib/social/client"

type ListedCommunity = {
  id: string
  name: string
  purpose?: string
  description?: string
  category?: string
  memberCount?: number
}

function normalizeListed(raw: unknown): ListedCommunity | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const id = String(r.id || "").trim()
  const name = String(r.name || "").trim()
  if (!id || !name) return null
  return {
    id,
    name,
    purpose: r.purpose != null ? String(r.purpose) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    category: r.category != null ? String(r.category) : undefined,
    memberCount:
      typeof r.memberCount === "number"
        ? r.memberCount
        : typeof r.member_count === "number"
          ? r.member_count
          : undefined,
  }
}

/**
 * Discover chip strip for communities.
 * Wired to GET /api/communities via socialListCommunities — no fabricated groups.
 */
export function CommunitiesSection({
  onViewCommunity,
}: {
  onViewCommunity: (name: string) => void
}) {
  const [items, setItems] = useState<ListedCommunity[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading")
  const [durable, setDurable] = useState(false)

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await socialListCommunities(24)
      const list = (res.communities || [])
        .map(normalizeListed)
        .filter((c): c is ListedCommunity => c != null)
      setDurable(Boolean(res.durable))
      setItems(list)
      if (!res.ok && list.length === 0) {
        setStatus("error")
        return
      }
      setStatus(list.length === 0 ? "empty" : "ok")
    } catch {
      setItems([])
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-2xl bg-white px-4 py-5" aria-labelledby="communities-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#7C3AED]" aria-hidden="true" />
          <h2 id="communities-heading" className="text-lg font-bold text-black">
            Communities
          </h2>
        </div>
        {status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading communities" />
        ) : null}
      </div>

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading communities…</p>
      ) : null}

      {status === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Could not load communities right now.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-semibold text-emerald-700 underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {status === "empty" ? (
        <p className="text-sm text-muted-foreground">
          {durable
            ? "No public communities yet. Create one from Community."
            : "Communities will appear here when the server directory is available."}
        </p>
      ) : null}

      {status === "ok" ? (
        <ul className="flex flex-wrap gap-2" role="list">
          {items.slice(0, 12).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onViewCommunity(c.name)}
                className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-emerald-300 hover:bg-emerald-50"
                title={c.purpose || c.description || c.name}
              >
                {c.name}
                {typeof c.memberCount === "number" && c.memberCount > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">{c.memberCount}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
