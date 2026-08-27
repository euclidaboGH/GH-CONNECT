"use client"

/**
 * Unified Global Search — people, public IDs, communities, posts.
 * Debounced query, recent searches, privacy/block filters, stale-result guard.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { Search, X, Users, Newspaper, MessagesSquare, Hash, Clock, Trash2 } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { LazyImage } from "./lazy-image"
import { resolveAvatarUrl } from "@/lib/avatar"

type SearchTab = "all" | "people" | "posts" | "communities" | "ids"

const RECENT_KEY = "ghc-search-recent-v1"
const MAX_RECENT = 8

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function saveRecent(items: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)))
  } catch {
    /* ignore */
  }
}

export function GlobalSearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-full p-2 text-foreground/80 hover:bg-muted active:scale-95"
      aria-label="Search"
    >
      <Search size={18} />
    </button>
  )
}

export function GlobalSearchModal({
  open,
  onClose,
  onSelectPerson,
  onSelectPost,
  onSelectCommunity,
}: {
  open: boolean
  onClose: () => void
  onSelectPerson?: (id: string) => void
  onSelectPost?: (id: string) => void
  onSelectCommunity?: (id: string) => void
}) {
  const { candidates, posts, conversations, blockedUsers, mutedUsers, settings, matches, setTab } =
    useGHC()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [tab, setSearchTab] = useState<SearchTab>("all")
  const [recent, setRecent] = useState<string[]>([])
  const requestGen = useRef(0)
  const [resultGen, setResultGen] = useState(0)

  // Debounce — prevents stale rapid typing results
  useEffect(() => {
    const gen = ++requestGen.current
    const t = window.setTimeout(() => {
      if (gen !== requestGen.current) return
      setDebouncedQuery(query.trim())
      setResultGen(gen)
    }, 220)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (open) setRecent(loadRecent())
    else {
      setQuery("")
      setDebouncedQuery("")
      setSearchTab("all")
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    return onCloseTransientUI(() => onClose())
  }, [open, onClose])

  const blocked = useMemo(
    () =>
      new Set([
        ...(blockedUsers || []),
        ...((settings?.blockedUsers as string[]) || []),
      ]),
    [blockedUsers, settings?.blockedUsers],
  )
  const muted = useMemo(
    () =>
      new Set([
        ...(mutedUsers || []),
        ...(((settings as { mutedUsers?: string[] })?.mutedUsers) || []),
      ]),
    [mutedUsers, settings],
  )

  const q = debouncedQuery.toLowerCase()
  const stale = resultGen !== requestGen.current

  const people = useMemo(() => {
    if (!q || stale) return []
    return (candidates || [])
      .filter((c) => c?.id && !blocked.has(c.id) && !muted.has(c.id))
      .filter((c) => c.id !== "current-user")
      .filter((c) => {
        const name = (c.name || "").toLowerCase()
        const loc = `${c.location || ""} ${(c as { city?: string }).city || ""}`.toLowerCase()
        const bio = (c.bio || "").toLowerCase()
        const interests = (c.interests || []).join(" ").toLowerCase()
        const profession = String((c as { profession?: string }).profession || "").toLowerCase()
        return (
          name.includes(q) ||
          loc.includes(q) ||
          bio.includes(q) ||
          interests.includes(q) ||
          profession.includes(q)
        )
      })
      .slice(0, 16)
  }, [candidates, q, blocked, muted, stale])

  const idHits = useMemo(() => {
    if (!q || stale) return []
    const normalized = q.replace(/^gh-?/i, "").replace(/\s/g, "")
    return (candidates || [])
      .filter((c) => c?.id && !blocked.has(c.id) && !muted.has(c.id))
      .filter((c) => {
        const id = (c.id || "").toLowerCase()
        const publicId = String((c as { greenHavenId?: string; publicId?: string }).greenHavenId || (c as { publicId?: string }).publicId || "").toLowerCase()
        return (
          id.includes(q) ||
          id.includes(normalized) ||
          publicId.includes(q) ||
          publicId.includes(normalized) ||
          `gh-${id}`.includes(q)
        )
      })
      .slice(0, 12)
  }, [candidates, q, blocked, muted, stale])

  const postHits = useMemo(() => {
    if (!q || stale) return []
    return (posts || [])
      .filter((p) => p && !(p as { deletedAt?: number }).deletedAt)
      .filter((p) => !blocked.has(p.authorId) && !muted.has(p.authorId))
      .filter((p) => {
        // Private / followers-only posts: only show public in global search
        const vis = (p as { visibility?: string }).visibility || "public"
        if (vis === "private") return false
        const content = (p.content || "").toLowerCase()
        const author = (p.authorName || "").toLowerCase()
        return content.includes(q) || author.includes(q) || (q.startsWith("#") && content.includes(q.slice(1)))
      })
      .slice(0, 16)
  }, [posts, q, blocked, muted, stale])

  const communities = useMemo(() => {
    if (!q || stale) return []
    return (conversations || [])
      .filter(
        (c) =>
          c.conversationType === "group" ||
          Boolean((c as { isCommunity?: boolean }).isCommunity),
      )
      .filter((c) => {
        // Private invite-only: still discoverable by name only if public-ish
        const privacy = (c as { privacy?: string }).privacy
        if (privacy === "invite-only") return false
        const name = (c.groupName || c.participantName || "").toLowerCase()
        const desc = String((c as { description?: string }).description || "").toLowerCase()
        return name.includes(q) || desc.includes(q)
      })
      .slice(0, 12)
  }, [conversations, q, stale])

  const commitRecent = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT)
      saveRecent(next)
      return next
    })
  }, [])

  const closeAnd = useCallback(
    (fn?: () => void) => {
      if (debouncedQuery) commitRecent(debouncedQuery)
      onClose()
      fn?.()
    },
    [commitRecent, debouncedQuery, onClose],
  )

  if (!open) return null

  const showPeople = tab === "all" || tab === "people"
  const showPosts = tab === "all" || tab === "posts"
  const showCommunities = tab === "all" || tab === "communities"
  const showIds = tab === "all" || tab === "ids"
  const hasAny =
    (showPeople && people.length > 0) ||
    (showPosts && postHits.length > 0) ||
    (showCommunities && communities.length > 0) ||
    (showIds && idHits.length > 0)

  const tabBtn = (t: SearchTab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setSearchTab(t)}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
        tab === t ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/40" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90dvh] flex-col rounded-b-2xl bg-card text-foreground shadow-2xl sm:mx-auto sm:mt-8 sm:w-full sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Search size={18} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="People, GH ID, posts, communities…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Global search"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Clear query"
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-3 py-2 scrollbar-hide">
          {tabBtn("all", "All")}
          {tabBtn("people", "People")}
          {tabBtn("ids", "IDs")}
          {tabBtn("posts", "Posts")}
          {tabBtn("communities", "Communities")}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-busy={query !== debouncedQuery}>
          {!q && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent searches
              </p>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Try a name, city, interest, hashtag, or GreenHaven ID.
                </p>
              ) : (
                <ul className="space-y-1">
                  {recent.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => setQuery(term)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Clock size={14} className="text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{term}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {recent.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRecent([])
                    saveRecent([])
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Trash2 size={12} /> Clear recent
                </button>
              )}
            </div>
          )}

          {q && !hasAny && !stale && (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold">No results for “{debouncedQuery}”</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Private, blocked, or hidden profiles are not shown. Try another spelling or category.
              </p>
            </div>
          )}

          {showPeople && people.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Users size={12} /> People
              </p>
              <ul className="space-y-1">
                {people.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        closeAnd(() => {
                          onSelectPerson?.(c.id)
                          try {
                            setTab?.("discover" as any)
                            window.dispatchEvent(
                              new CustomEvent("ghc:navigate-tab", { detail: "discover" }),
                            )
                          } catch {
                            /* */
                          }
                        })
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                        <LazyImage
                          src={resolveAvatarUrl(c.photo, c.name)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[c.location, (c.interests || []).slice(0, 2).join(" · ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showIds && idHits.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Hash size={12} /> Public IDs
              </p>
              <ul className="space-y-1">
                {idHits.map((c) => (
                  <li key={`id-${c.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        closeAnd(() => {
                          onSelectPerson?.(c.id)
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:navigate-tab", { detail: "discover" }),
                            )
                          } catch {
                            /* */
                          }
                        })
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">
                        GH
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{c.id}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showPosts && postHits.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Newspaper size={12} /> Posts
              </p>
              <ul className="space-y-1">
                {postHits.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        closeAnd(() => {
                          onSelectPost?.(p.id)
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:navigate-tab", { detail: "home" }),
                            )
                          } catch {
                            /* */
                          }
                        })
                      }
                      className="w-full rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <p className="text-[11px] font-semibold text-muted-foreground">{p.authorName}</p>
                      <p className="line-clamp-2 text-sm">{p.content}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showCommunities && communities.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <MessagesSquare size={12} /> Communities
              </p>
              <ul className="space-y-1">
                {communities.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        closeAnd(() => {
                          onSelectCommunity?.(c.id)
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:navigate-tab", { detail: "communities" }),
                            )
                          } catch {
                            /* */
                          }
                        })
                      }
                      className="w-full rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <p className="text-sm font-semibold">
                        {c.groupName || c.participantName || "Community"}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {c.lastMessage || (c as { description?: string }).description || "Community"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
