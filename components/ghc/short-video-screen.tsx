"use client"

/**
 * Short Video surface — vertical playback over existing gh_posts + durable media.
 * No monetization, ranking claims, or rewards.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { socialRecordAttention } from "@/lib/social/client"

type ShortPost = {
  id: string
  video?: string | null
  content?: string
  authorId?: string
  authorName?: string
  authorPhoto?: string
  createdAt?: number | string
}

interface ShortVideoScreenProps {
  open: boolean
  onClose: () => void
  /** Optional seed posts from local feed while durable list loads */
  seedPosts?: ShortPost[]
}

export function ShortVideoScreen({ open, onClose, seedPosts = [] }: ShortVideoScreenProps) {
  const [posts, setPosts] = useState<ShortPost[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qualifiedSent = useRef<Set<string>>(new Set())
  const completeSent = useRef<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/social/short-video?limit=24", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        posts?: ShortPost[]
        error?: string
      }
      if (res.ok && data.ok && Array.isArray(data.posts) && data.posts.length > 0) {
        setPosts(
          data.posts
            .filter((p) => p.id && p.video)
            .map((p) => ({
              id: String(p.id),
              video: p.video,
              content: p.content,
              authorId: p.authorId,
              authorName: p.authorName,
              authorPhoto: p.authorPhoto,
              createdAt: p.createdAt,
            }))
        )
        setIndex(0)
      } else {
        const seed = seedPosts.filter((p) => p.video && !String(p.video).startsWith("blob:"))
        setPosts(seed)
        if (seed.length === 0) {
          setError(data.error || "No short videos yet. Publish a video post to get started.")
        }
      }
    } catch {
      setError("Could not load short videos")
      const seed = seedPosts.filter((p) => p.video && !String(p.video).startsWith("blob:"))
      setPosts(seed)
    } finally {
      setLoading(false)
    }
  }, [seedPosts])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const current = posts[index] || null

  // Attention: view on activate; qualified after ~3s; complete near end
  useEffect(() => {
    if (!open || !current?.id) return
    void socialRecordAttention(current.id, "view")
    if (viewTimer.current) clearTimeout(viewTimer.current)
    viewTimer.current = setTimeout(() => {
      if (!qualifiedSent.current.has(current.id)) {
        qualifiedSent.current.add(current.id)
        void socialRecordAttention(current.id, "qualified_view")
      }
    }, 3000)
    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current)
    }
  }, [open, current?.id])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !current) return
    el.muted = muted
    if (playing) {
      void el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
    }
  }, [playing, muted, current, current?.id, index])

  const onTimeUpdate = () => {
    const el = videoRef.current
    if (!el || !current?.id || !el.duration || !Number.isFinite(el.duration)) return
    if (el.currentTime / el.duration >= 0.9 && !completeSent.current.has(current.id)) {
      completeSent.current.add(current.id)
      void socialRecordAttention(current.id, "complete")
    }
  }

  const go = (delta: number) => {
    setIndex((i) => {
      const next = i + delta
      if (next < 0 || next >= posts.length) return i
      setPlaying(true)
      return next
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Short videos"
    >
      <header className="flex items-center justify-between px-3 py-2 safe-area-pt">
        <p className="text-sm font-semibold tracking-wide">Short Video</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 hover:bg-white/20"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-white/80">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {!loading && error && posts.length === 0 && (
          <div className="max-w-xs px-6 text-center text-sm text-white/80">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && current?.video && (
          <div className="relative flex h-full w-full max-w-lg flex-col">
            <button
              type="button"
              className="relative min-h-0 flex-1"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
            >
              <video
                ref={videoRef}
                key={current.id}
                src={current.video}
                className="h-full w-full object-contain bg-black"
                playsInline
                loop
                muted={muted}
                onTimeUpdate={onTimeUpdate}
                onEnded={() => {
                  if (current.id && !completeSent.current.has(current.id)) {
                    completeSent.current.add(current.id)
                    void socialRecordAttention(current.id, "complete")
                  }
                  go(1)
                }}
              />
              {!playing && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/50 p-4">
                    <Play size={32} fill="currentColor" />
                  </span>
                </span>
              )}
            </button>

            <div className="space-y-2 px-4 pb-6 pt-2">
              <div className="flex items-center gap-2">
                {current.authorPhoto ? (
                  <img
                    src={current.authorPhoto}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                    {(current.authorName || "?").slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{current.authorName || "Member"}</p>
                  {current.content ? (
                    <p className="line-clamp-2 text-xs text-white/80">{current.content}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-white/15 p-2"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white/15 p-2"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="rounded-full bg-white/15 p-2 disabled:opacity-30"
                    disabled={index <= 0}
                    onClick={() => go(-1)}
                    aria-label="Previous"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white/15 p-2 disabled:opacity-30"
                    disabled={index >= posts.length - 1}
                    onClick={() => go(1)}
                    aria-label="Next"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] text-white/50">
                {posts.length ? `${index + 1} / ${posts.length}` : ""} · Chronological · Not ranked
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShortVideoScreen
