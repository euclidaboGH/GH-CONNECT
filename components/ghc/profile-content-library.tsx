"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, CalendarDays, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, Search, X } from "lucide-react"
import { POST_SYNC_EVENT, readPostSyncDetail } from "@/lib/social/post-sync"
import { downloadMedia } from "@/lib/media/download-media"

type LibraryKind = "all" | "posts" | "photos" | "videos" | "documents" | "history"
type HistoryEntry = { url: string; changedAt: number; caption?: string }
type LibraryPost = {
  id: string
  authorId?: string
  authorName?: string
  content?: string
  images?: string[] | null
  video?: string | null
  pdf?: string | null
  pdfName?: string | null
  visibility?: "public" | "followers" | "mutuals" | "private"
  createdAt?: number
  likes?: number
  commentCount?: number
  shares?: number
}

const TABS: Array<{ id: LibraryKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "Profile history" },
]

function formatDate(value?: number) {
  if (!value || !Number.isFinite(Number(value))) return "Date unavailable"
  try { return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) }
  catch { return "Date unavailable" }
}

function safeExternalUrl(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw || raw.length > 10 * 1024 * 1024) return ""
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(raw)) {
    return raw.length <= 6 * 1024 * 1024 ? raw : ""
  }
  if (/^data:video\/(?:mp4|webm);base64,/i.test(raw)) {
    return raw.length <= 10 * 1024 * 1024 ? raw : ""
  }
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return ""
    return parsed.href
  } catch {
    return ""
  }
}

function mediaKindForApi(kind: LibraryKind) {
  return kind === "history" ? "all" : kind
}

export function ProfileContentLibrary({
  open,
  onClose,
  profileId,
  profileName,
  isOwner = false,
  profilePhotos = [],
  coverPhoto,
  profilePhotoHistory = [],
  coverPhotoHistory = [],
}: {
  open: boolean
  onClose: () => void
  profileId: string
  profileName: string
  isOwner?: boolean
  profilePhotos?: string[]
  coverPhoto?: string | null
  profilePhotoHistory?: HistoryEntry[]
  coverPhotoHistory?: HistoryEntry[]
}) {
  const [kind, setKind] = useState<LibraryKind>("all")
  const [query, setQuery] = useState("")
  const [posts, setPosts] = useState<LibraryPost[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])'
    ) || []).filter((node) => node.offsetParent !== null)
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const nodes = focusables()
      if (!nodes.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  // Keep an open profile timeline coherent with Feed/Community/Creator mutations
  // without issuing another network request for every local interaction.
  useEffect(() => {
    if (!open || !profileId || kind === "history") return
    const onPostSync = (event: Event) => {
      const detail = readPostSyncDetail(event)
      if (!detail) return
      setPosts((current) => {
        const index = current.findIndex((post) => post.id === detail.postId)
        if (detail.operation === "delete" || detail.operation === "archive") {
          return index >= 0 ? current.filter((post) => post.id !== detail.postId) : current
        }
        if (index < 0) return current
        return current.map((post) => post.id === detail.postId ? { ...post, ...(detail.patch || {}) } : post)
      })
    }
    window.addEventListener(POST_SYNC_EVENT, onPostSync as EventListener)
    return () => window.removeEventListener(POST_SYNC_EVENT, onPostSync as EventListener)
  }, [open, profileId, kind])

  useEffect(() => () => loadMoreAbortRef.current?.abort(), [])
  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreAbortRef.current = null
    setLoadingMore(false)
  }, [open, profileId, kind, query])

  useEffect(() => {
    if (!open || !profileId || kind === "history") return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setPosts([])
    setNextBefore(null)
    setNextBeforeId(null)
    setHasMore(false)
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "30", kind: mediaKindForApi(kind) })
        if (query.trim()) params.set("q", query.trim().slice(0, 120))
        const response = await fetch(`/api/social/profile/${encodeURIComponent(profileId)}/posts?${params.toString()}`, {
          credentials: "include", cache: "no-store", signal: controller.signal,
        })
        const data = await response.json().catch(() => ({})) as { ok?: boolean; posts?: LibraryPost[]; hasMore?: boolean; nextBefore?: number | null; nextBeforeId?: string | null; error?: string; message?: string }
        if (!response.ok || !data.ok) throw new Error(data.message || (data.error === "PROFILE_CONTENT_MIGRATION_REQUIRED" ? "Profile library is awaiting its Testnet database migration." : data.error) || `Content could not be loaded (${response.status})`)
        setPosts(Array.isArray(data.posts) ? data.posts : [])
        setHasMore(Boolean(data.hasMore))
        setNextBefore(typeof data.nextBefore === "number" ? data.nextBefore : null)
        setNextBeforeId(typeof data.nextBeforeId === "string" ? data.nextBeforeId : null)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Content could not be loaded")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query.trim() ? 280 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [open, profileId, kind, query, reloadTick])

  const loadMore = useCallback(async () => {
    if (!hasMore || nextBefore == null || !nextBeforeId || loadingMore || kind === "history") return
    setLoadingMore(true)
    setError(null)
    const controller = new AbortController()
    loadMoreAbortRef.current?.abort()
    loadMoreAbortRef.current = controller
    try {
      const params = new URLSearchParams({ limit: "30", kind: mediaKindForApi(kind), before: String(nextBefore), beforeId: nextBeforeId })
      if (query.trim()) params.set("q", query.trim().slice(0, 120))
      const response = await fetch(`/api/social/profile/${encodeURIComponent(profileId)}/posts?${params.toString()}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      const data = await response.json().catch(() => ({})) as { ok?: boolean; posts?: LibraryPost[]; hasMore?: boolean; nextBefore?: number | null; nextBeforeId?: string | null; error?: string; message?: string }
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || `More content could not be loaded (${response.status})`)
      const nextPosts = Array.isArray(data.posts) ? data.posts : []
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id))
        return [...current, ...nextPosts.filter((post) => !seen.has(post.id))]
      })
      setHasMore(Boolean(data.hasMore))
      setNextBefore(typeof data.nextBefore === "number" ? data.nextBefore : null)
      setNextBeforeId(typeof data.nextBeforeId === "string" ? data.nextBeforeId : null)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "More content could not be loaded")
    } finally {
      if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = null
      if (!controller.signal.aborted) setLoadingMore(false)
    }
  }, [hasMore, nextBefore, nextBeforeId, loadingMore, kind, profileId, query])

  const historyItems = useMemo(() => {
    const rows: Array<{ id: string; title: string; url: string; changedAt?: number; category: string }> = []
    if (coverPhoto) rows.push({ id: "cover-current", title: "Current cover photo", url: coverPhoto, category: "Cover photos" })
    coverPhotoHistory.forEach((item, index) => rows.push({ id: `cover-history-${index}-${item.changedAt}`, title: item.caption || "Previous cover photo", url: item.url, changedAt: item.changedAt, category: "Cover photos" }))
    profilePhotos.forEach((url, index) => rows.push({ id: `profile-photo-${index}`, title: index === 0 ? "Current profile photo" : "Profile photo", url, category: "Profile photos" }))
    profilePhotoHistory.forEach((item, index) => rows.push({ id: `profile-history-${index}-${item.changedAt}`, title: item.caption || "Previous profile photo", url: item.url, changedAt: item.changedAt, category: "Profile photos" }))
    return rows.filter((item) => safeExternalUrl(item.url))
  }, [coverPhoto, coverPhotoHistory, profilePhotos, profilePhotoHistory])

  const visiblePosts = useMemo(() => posts.filter((post) => {
    if (kind === "photos") return Array.isArray(post.images) && post.images.length > 0
    if (kind === "videos") return Boolean(post.video)
    if (kind === "documents") return Boolean(post.pdf)
    // The Posts tab is the chronological timeline (including posts with media),
    // while Photos/Videos/Documents are focused library views.
    return true
  }), [posts, kind])

  if (!open) return null

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="profile-content-library-title">
      <section className="flex max-h-[94dvh] min-h-[70dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><ImageIcon size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 id="profile-content-library-title" className="truncate text-base font-bold text-foreground">{profileName}'s content</h2>
            <p className="text-xs text-muted-foreground">Posts, photos, videos and published documents</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Close content library"><X size={20} /></button>
        </header>
        <div className="space-y-3 border-b border-border px-3 py-3 sm:px-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/30 px-3">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search posts, book titles or documents…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label="Search this profile's content" />
            {query ? <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button> : null}
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Content type">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={kind === tab.id} onClick={() => setKind(tab.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${kind === tab.id ? "bg-emerald-600 text-white" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {kind === "history" ? (
            historyItems.length ? (
              <div className="space-y-5">
                {(["Profile photos", "Cover photos"] as const).map((group) => {
                  const items = historyItems.filter((item) => item.category === group)
                  if (!items.length) return null
                  return <section key={group}><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><CalendarDays size={16} />{group}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card"><button type="button" onClick={() => setLightbox({ src: item.url, alt: item.title })} onContextMenu={(e) => { e.preventDefault(); if (item.url) void downloadMedia(item.url, { kind: "image", filename: item.title }) }} onPointerDown={(e) => { if (e.button !== 0) return; const el = e.currentTarget; const timer = window.setTimeout(() => { if (item.url) void downloadMedia(item.url, { kind: "image", filename: item.title }); try { if ("vibrate" in navigator) navigator.vibrate(10) } catch { /* */ } }, 500); const clear = () => window.clearTimeout(timer); el.addEventListener("pointerup", clear, { once: true }); el.addEventListener("pointercancel", clear, { once: true }) }} className="block w-full cursor-zoom-in" aria-label={`View ${item.title} full screen. Hold to download.`}><img src={item.url} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className={`w-full bg-muted object-cover pointer-events-none ${group === "Cover photos" ? "aspect-[16/9]" : "aspect-square"}`} /></button><div className="p-2.5"><p className="text-xs font-semibold">{item.title}</p>{item.changedAt ? <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.changedAt)}</p> : null}</div></article>)}</div></section>
                })}
                {!isOwner ? <p className="text-xs text-muted-foreground">Only profile and cover images shared with you are shown here.</p> : null}
              </div>
            ) : <EmptyLibrary title="No profile photo history yet" detail="Profile and cover photos will be grouped here as you change them." />
          ) : loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" />Loading content…</div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><p className="font-semibold">Could not load this content</p><p className="mt-1 text-muted-foreground">{error}</p><button type="button" onClick={() => setReloadTick((value) => value + 1)} className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Try again</button></div>
          ) : visiblePosts.length === 0 ? (
            <EmptyLibrary title={query ? "No matching content" : `No ${kind === "all" ? "publicly available content" : kind} yet`} detail={query ? "Try another keyword or switch content type." : "When posts or attachments are shared with this audience, they will appear here."} />
          ) : (
            <div className="space-y-3">
              {visiblePosts.map((post) => {
                const images = Array.isArray(post.images) ? post.images.map((value) => safeExternalUrl(value)).filter(Boolean) : []
                const video = safeExternalUrl(post.video)
                const pdf = safeExternalUrl(post.pdf)
                return <article key={post.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 px-3.5 pt-3.5">
                    <div className="min-w-0"><p className="text-xs font-semibold text-foreground">{post.authorName || profileName}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(Number(post.createdAt) || undefined)}{post.visibility === "public" ? " · Public" : " · Shared with permitted audience"}</p></div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold capitalize text-muted-foreground">{pdf ? "Document" : video ? "Video" : images.length ? "Photo" : "Post"}</span>
                  </div>
                  {post.content ? <p className="whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed text-foreground">{post.content}</p> : null}
                  {images.length ? <div className={`grid gap-1.5 px-3.5 pb-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{images.slice(0, 10).map((src, index) => <button key={`${post.id}-image-${index}`} type="button" onClick={() => setLightbox({ src, alt: `Photo ${index + 1} from ${formatDate(Number(post.createdAt) || undefined)}` })} className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted" aria-label={`View photo ${index + 1} full screen`}><img src={src} alt={`Photo ${index + 1} from ${formatDate(Number(post.createdAt) || undefined)}`} loading="lazy" referrerPolicy="no-referrer" className={`w-full object-cover ${images.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} /></button>)}</div> : null}
                  {video ? <div className="px-3.5 pb-3"><video src={video} controls preload="metadata" className="max-h-[28rem] w-full rounded-xl bg-black" aria-label="Post video" /></div> : null}
                  {pdf ? <div className="px-3.5 pb-3"><div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600"><FileText size={21} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{post.pdfName || "Published PDF document"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">PDF · Shared according to post permissions</p></div><a href={pdf} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted"><ExternalLink size={14} />Open</a></div></div> : null}
                </article>
              })}
              {hasMore ? <div className="flex justify-center py-2"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted disabled:opacity-60">{loadingMore ? <LoaderCircle size={16} className="animate-spin" /> : null}{loadingMore ? "Loading…" : "Load older content"}</button></div> : null}
            </div>
          )}
        </div>
      </section>
      {lightbox ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setLightbox(null)}>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); void downloadMedia(lightbox.src, { kind: "image", filename: lightbox.alt }) }} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Download photo"><Download size={20} /></button>
            <button type="button" onClick={() => setLightbox(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close photo viewer"><X size={22} /></button>
          </div>
          <img src={lightbox.src} alt={lightbox.alt} referrerPolicy="no-referrer" className="max-h-[92dvh] max-w-full object-contain" onClick={(event) => event.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); void downloadMedia(lightbox.src, { kind: "image", filename: lightbox.alt }) }} />
        </div>
      ) : null}
    </div>
  )
}

function EmptyLibrary({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 py-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FileText size={22} /></div><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{detail}</p></div>
}
