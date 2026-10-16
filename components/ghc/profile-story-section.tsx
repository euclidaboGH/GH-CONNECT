"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { socialViewStory } from "@/lib/social/client"
import { compressImage } from "@/lib/ghc-data"
import { uploadDurableMedia } from "@/lib/media/upload-client"
import { isDurableMediaUrl, isBlobUrl } from "@/lib/media/durable-url"
import { mediaUserMessage } from "@/lib/media/user-messages"
import type { StoryItem } from "@/lib/ghc-types"
import { LazyImage } from "./lazy-image"

/**
 * Moments strip — one design for feed and profile.
 * - scope="feed": own ring + followed people
 * - scope="profile": owner-only (personal control surface)
 */
export default function ProfileStorySection({ scope = "profile" }: { scope?: "profile" | "feed" }) {
  const ghc = useGHC()
  const profile = ghc.profile
  const stories = Array.isArray(ghc.stories) ? ghc.stories : []
  const following = Array.isArray(ghc.following) ? ghc.following : []
  const friends = Array.isArray(ghc.friends) ? ghc.friends : []
  const publishStory = ghc.publishStory
  const addToast = ghc.addToast
  const startConversation = ghc.startConversation
  const sendMessage = ghc.sendMessage
  const setTab = ghc.setTab
  const conversations = ghc.conversations

  const ownStory = stories
    .filter((story) => story.ownerId === "current-user")
    .sort((a, b) => b.createdAt - a.createdAt)[0]

  const followingSet = new Set(following.map(String))
  const friendSet = new Set(
    friends
      .map((friend: unknown) => {
        if (typeof friend === "string") return friend
        if (friend && typeof friend === "object") {
          const item = friend as { id?: string; userId?: string; friendId?: string }
          return String(item.userId || item.friendId || item.id || "")
        }
        return ""
      })
      .filter(Boolean),
  )

  const otherStories =
    scope === "feed"
      ? stories.filter((story) => {
          if (!story.ownerId || story.ownerId === "current-user" || story.id === ownStory?.id) return false
          return followingSet.has(String(story.ownerId)) || friendSet.has(String(story.ownerId))
        })
      : []

  const [composerOpen, setComposerOpen] = useState(false)
  const [text, setText] = useState("")
  const [media, setMedia] = useState<{ type: "image" | "video"; url: string } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const [viewing, setViewing] = useState<StoryItem | null>(null)
  const [storyAudience, setStoryAudience] = useState<"everyone" | "followers" | "friends" | "private">("followers")
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([])
  const [replyText, setReplyText] = useState("")
  const [replying, setReplying] = useState(false)
  const [storyReaction, setStoryReaction] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ghc-story-seen")
      if (raw) setSeenStoryIds(JSON.parse(raw))
    } catch {
      /* */
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ghc-story-highlights")
      if (raw) setHighlights(JSON.parse(raw))
    } catch {
      /* */
    }
  }, [])

  useEffect(() => {
    return () => {
      if (media?.type === "video" && media.url.startsWith("blob:")) URL.revokeObjectURL(media.url)
    }
  }, [media])

  const readMedia = async (file: File | undefined, type: "image" | "video") => {
    if (!file) return
    setUploading(type)
    try {
      const preview = type === "image" ? await compressImage(file) : ""
      const uploadBlob = type === "image" ? await (await fetch(preview)).blob() : file
      const uploaded = await uploadDurableMedia(uploadBlob, { fileName: file.name })
      if (uploaded.ok && uploaded.url && uploaded.kind === type) {
        setMedia({ type, url: uploaded.url })
        addToast?.(`${type === "image" ? "Photo" : "Video"} ready to share`, "success")
      } else if (type === "image" && preview.length > 0 && preview.length <= 180_000) {
        setMedia({ type, url: preview })
        addToast?.("Photo ready to share", "success")
      } else {
        addToast?.(
          mediaUserMessage(uploaded.ok ? "STORAGE_ERROR" : uploaded.error, uploaded.ok ? undefined : uploaded.userMessage),
          "error",
        )
      }
    } catch {
      addToast?.(`Could not upload this ${type}`, "error")
    } finally {
      setUploading(null)
    }
  }

  const publish = async () => {
    if (publishing || uploading) return
    if (!text.trim() && !media) {
      addToast?.("Add a photo, video, or status first", "error")
      return
    }
    const mediaUrl = media?.url || ""
    if (isBlobUrl(mediaUrl)) {
      addToast?.("Media still preparing — wait for upload", "error")
      return
    }
    setPublishing(true)
    try {
      const now = Date.now()
      const next: StoryItem = {
        id: `story-${now}`,
        ownerId: "current-user",
        name: profile.displayName || "You",
        photo: profile.photos?.[0],
        text: text.trim(),
        media,
        createdAt: now,
        status: "published",
        audience: storyAudience,
        expiresAt: now + 24 * 60 * 60 * 1000,
      }
      await publishStory?.(next)
      setText("")
      setMedia(null)
      setComposerOpen(false)
      addToast?.("Moment shared · expires in 24h", "success")
    } catch {
      addToast?.("Could not publish moment", "error")
    } finally {
      setPublishing(false)
    }
  }

  const hoursLeft = (story: StoryItem) => {
    const exp = story.expiresAt || story.createdAt + 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((exp - Date.now()) / (60 * 60 * 1000)))
  }

  const toggleHighlight = (storyId: string) => {
    setHighlights((prev) => {
      const next = prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId].slice(0, 20)
      try {
        window.localStorage.setItem("ghc-story-highlights", JSON.stringify(next))
      } catch {
        /* */
      }
      addToast?.(next.includes(storyId) ? "Added to highlights" : "Removed from highlights", "success")
      return next
    })
  }

  const openStory = (story: StoryItem) => {
    setViewing(story)
    setStoryReaction(null)
    setReplyText("")
    if (story.ownerId !== "current-user") {
      try {
        void socialViewStory(String(story.id)).catch(() => {})
      } catch {
        /* */
      }
      setSeenStoryIds((prev) => {
        if (prev.includes(story.id)) return prev
        const next = [...prev, story.id].slice(-80)
        try {
          window.localStorage.setItem("ghc-story-seen", JSON.stringify(next))
        } catch {
          /* */
        }
        return next
      })
    }
  }

  /** Shared circular rail — identical chrome for feed & profile */
  const rail = (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {/* Own ring */}
      <button
        type="button"
        onClick={() => (ownStory ? openStory(ownStory) : setComposerOpen(true))}
        className="flex w-[4.25rem] shrink-0 snap-start flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={ownStory ? "View your moment" : "Add a moment"}
      >
        <span
          className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 ${
            ownStory
              ? "border-emerald-500"
              : "border-dashed border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/40"
          }`}
        >
          {ownStory?.media?.url && isDurableMediaUrl(ownStory.media.url) ? (
            <LazyImage src={ownStory.media.url} alt="" className="h-full w-full object-cover" />
          ) : profile.photos?.[0] ? (
            <LazyImage src={profile.photos[0]} alt="" className="h-full w-full object-cover opacity-90" />
          ) : (
            <Plus size={22} className="text-emerald-800" />
          )}
          {!ownStory ? (
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gh-green)] text-[11px] font-bold text-white">
              +
            </span>
          ) : null}
        </span>
        <span className="max-w-[4.25rem] truncate text-[10px] font-semibold text-muted-foreground">
          {ownStory ? "Yours" : "Add"}
        </span>
      </button>

      {/* Followed moments — feed only */}
      {scope === "feed" &&
        otherStories.map((story) => {
          const seen = seenStoryIds.includes(story.id)
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => openStory(story)}
              className="flex w-[4.25rem] shrink-0 snap-start flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={`View ${story.name || "member"}'s moment`}
            >
              <span
                className={`flex h-16 w-16 overflow-hidden rounded-full border-2 p-0.5 ${
                  seen ? "border-muted-foreground/40" : "border-emerald-500"
                }`}
              >
                <LazyImage
                  src={story.photo || story.media?.url || "/avatars/user.svg"}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              </span>
              <span className="max-w-[4.25rem] truncate text-[10px] font-semibold text-foreground">
                {story.name || "Member"}
              </span>
            </button>
          )
        })}

      {scope === "feed" && otherStories.length === 0 ? (
        <p className="flex min-h-16 max-w-[9rem] items-center text-[11px] leading-snug text-muted-foreground">
          Follow people to see their moments.
        </p>
      ) : null}
    </div>
  )

  /** Shared composer — same on feed & profile */
  const composer = composerOpen ? (
    <div className="mt-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">New moment</p>
        <button type="button" onClick={() => setComposerOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
          <X size={16} />
        </button>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {(
          [
            { id: "everyone" as const, label: "Public" },
            { id: "followers" as const, label: "Followers" },
            { id: "friends" as const, label: "Friends" },
            { id: "private" as const, label: "Only me" },
          ] as const
        ).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setStoryAudience(a.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              storyAudience === a.id ? "bg-[var(--gh-green)] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[10px] text-muted-foreground">Visible for 24 hours · Replies become private messages</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        placeholder="Share a moment…"
        rows={3}
        className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {media?.url && (isDurableMediaUrl(media.url) || media.url.startsWith("data:")) ? (
        <div className="relative mt-2 overflow-hidden rounded-lg">
          {media.type === "image" ? (
            <LazyImage src={media.url} alt="" className="max-h-40 w-full object-cover" />
          ) : (
            <video src={media.url} className="max-h-40 w-full object-cover" controls />
          )}
          <button
            type="button"
            onClick={() => setMedia(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
            aria-label="Remove media"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void readMedia(e.target.files?.[0], "image")
            e.currentTarget.value = ""
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => {
            void readMedia(e.target.files?.[0], "video")
            e.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          disabled={!!uploading}
          className="rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
        >
          {uploading === "image" ? "…" : "Photo"}
        </button>
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          disabled={!!uploading}
          className="rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
        >
          {uploading === "video" ? "…" : "Video"}
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing || !!uploading || (!text.trim() && !media)}
          className="ml-auto rounded-full bg-[var(--gh-green)] px-4 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
        >
          {publishing ? "…" : "Share"}
        </button>
      </div>
    </div>
  ) : null

  /** Shared viewer modal */
  const viewer = viewing ? (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setViewing(null)}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{viewing.name || "Moment"}</p>
            <p className="text-[10px] text-muted-foreground">
              {viewing.audience ? `${viewing.audience} · ` : ""}~{hoursLeft(viewing)}h left
            </p>
          </div>
          <button type="button" onClick={() => setViewing(null)} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {viewing.media?.type === "image" && viewing.media.url && isDurableMediaUrl(viewing.media.url) ? (
            <LazyImage src={viewing.media.url} alt="" className="max-h-[45vh] w-full rounded-xl object-cover" />
          ) : null}
          {viewing.media?.type === "video" && viewing.media.url ? (
            <video src={viewing.media.url} controls className="max-h-[45vh] w-full rounded-xl" />
          ) : null}
          {viewing.text ? <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{viewing.text}</p> : null}

          {viewing.ownerId === "current-user" ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>~{(viewing.viewIds?.length ?? 0) || "—"} views</span>
              <span>·</span>
              <span>{viewing.replyCount ?? 0} replies</span>
              <button type="button" className="underline" onClick={() => toggleHighlight(viewing.id)}>
                {highlights.includes(viewing.id) ? "In highlights" : "Add to highlights"}
              </button>
            </div>
          ) : null}

          {viewing.ownerId && viewing.ownerId !== "current-user" ? (
            <div className="mt-4 border-t border-border/50 pt-3">
              <div className="mb-2 flex gap-2">
                {["👏", "🔥", "💚", "🙌"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setStoryReaction(emoji)
                      addToast?.(`Reacted ${emoji}`, "success")
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                      storyReaction === emoji ? "bg-emerald-100 ring-2 ring-emerald-500" : "bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reply as message</p>
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.slice(0, 300))}
                  placeholder="Reply to this moment…"
                  className="min-w-0 flex-1 rounded-xl border border-border/70 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  aria-label="Moment reply"
                />
                <button
                  type="button"
                  disabled={!replyText.trim() || replying}
                  className="rounded-xl bg-[var(--gh-green)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  onClick={async () => {
                    const body = replyText.trim()
                    if (!body || !viewing.ownerId) return
                    setReplying(true)
                    try {
                      const preview = viewing.text?.slice(0, 80) || (viewing.media ? "Photo/video moment" : "Moment")
                      const msg = `📷 Moment reply\n> ${preview}\n\n${body}`
                      const convId = await startConversation?.(viewing.ownerId, viewing.name || "Member")
                      if (convId && sendMessage) await sendMessage(convId, msg)
                      setReplyText("")
                      setViewing(null)
                      setTab?.("messages")
                      addToast?.("Reply sent as message", "success")
                    } catch {
                      addToast?.("Could not send reply", "error")
                    } finally {
                      setReplying(false)
                    }
                  }}
                >
                  {replying ? "…" : "Send"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null

  // ── Feed: circular rail + composer + viewer ──
  if (scope === "feed") {
    return (
      <section className="px-1 py-2" aria-label="Moments">
        {rail}
        {composer}
        {viewer}
      </section>
    )
  }

  // ── Profile: same design, owner-only ──
  return (
    <section className="w-full px-4 py-2" aria-label="Your moments">
      {rail}
      {composer}
      {viewer}
    </section>
  )
}
