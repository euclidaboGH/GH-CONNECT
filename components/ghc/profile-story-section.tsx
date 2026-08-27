"use client"

import { useEffect, useRef, useState } from "react"
import { Image, Plus, Video, X } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { compressImage } from "@/lib/ghc-data"
import type { StoryItem } from "@/lib/ghc-types"
import { LazyImage } from "./lazy-image"


/**
 * Stories strip.
 * - scope="profile" (default): only the current user's story — profile is personal control surface
 * - scope="feed": own story + people you follow (social feed)
 */
export default function ProfileStorySection({ scope = "profile" }: { scope?: "profile" | "feed" }) {
  const ghc = useGHC()
  const profile = ghc.profile
  const stories = Array.isArray(ghc.stories) ? ghc.stories : []
  const following = Array.isArray(ghc.following) ? ghc.following : []
  const publishStory = ghc.publishStory
  const addToast = ghc.addToast
  const startConversation = ghc.startConversation
  const sendMessage = ghc.sendMessage
  const setTab = ghc.setTab
  const conversations = ghc.conversations
  const blockedUsers = Array.isArray((ghc as { blockedUsers?: string[] }).blockedUsers)
    ? (ghc as { blockedUsers?: string[] }).blockedUsers!
    : []
  const settings = (ghc as { settings?: { blockedUsers?: string[] } }).settings
  const ownStory = stories
    .filter((story) => story.ownerId === "current-user")
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const followingSet = new Set(following)
  // On profile: never show other users' stories. On feed: show followed people.
  const otherStories =
    scope === "feed"
      ? stories
          .filter(
            (story) =>
              story.id !== ownStory?.id &&
              story.ownerId !== "current-user" &&
              (!story.ownerId || followingSet.size === 0 || followingSet.has(story.ownerId)),
          )
          .sort((a, b) => b.createdAt - a.createdAt)
      : []
  const [composerOpen, setComposerOpen] = useState(false)
  const [text, setText] = useState("")
  const [media, setMedia] = useState<StoryItem["media"]>(null)
  const [viewing, setViewing] = useState<StoryItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replying, setReplying] = useState(false)
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [storyAudience, setStoryAudience] = useState<"everyone" | "followers" | "friends" | "private">("followers")
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([])
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const raw = window.localStorage.getItem("ghc-story-seen")
      if (raw) setSeenStoryIds(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])
  const [storyReaction, setStoryReaction] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const raw = window.localStorage.getItem("ghc-story-highlights")
      if (raw) setHighlights(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (media?.type === "video" && media.url.startsWith("blob:")) URL.revokeObjectURL(media.url)
    }
  }, [media])

  const readMedia = async (file: File | undefined, type: "image" | "video") => {
    if (!file) return
    setUploading(type)
    try {
      const url = type === "image" ? await compressImage(file) : URL.createObjectURL(file)
      setMedia({ type, url })
      addToast(`${type === "image" ? "Photo compressed" : "Video"} ready to share`, "success")
    } catch {
      addToast(`Could not load this ${type}. Try another file.`, "error")
    } finally {
      setUploading(null)
    }
  }

  const publish = async () => {
    if (publishing || uploading) return
    if (!text.trim() && !media) {
      addToast("Add a photo, a video or a status before sharing", "error")
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
      await publishStory(next)
      setText("")
      setMedia(null)
      setComposerOpen(false)
      addToast("Story shared · expires in 24h", "success")
    } catch {
      addToast("Could not publish status", "error")
    } finally {
      setPublishing(false)
    }
  }


  const hoursLeft = (story: StoryItem) => {
    const exp = story.expiresAt || story.createdAt + 24 * 60 * 60 * 1000
    const h = Math.max(0, Math.ceil((exp - Date.now()) / (60 * 60 * 1000)))
    return h
  }

  const toggleHighlight = (storyId: string) => {
    setHighlights((prev) => {
      const next = prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId].slice(0, 20)
      try { window.localStorage.setItem("ghc-story-highlights", JSON.stringify(next)) } catch {}
      addToast(next.includes(storyId) ? "Added to highlights" : "Removed from highlights", "success")
      return next
    })
  }

  // Feed: compact Instagram-style rings only (no large "Share a moment" chrome)
  if (scope === "feed") {
    return (
      <section className="bg-background px-3 py-2.5" aria-label="Stories">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Tip: Community events near you can appear as stories when communities share them — quality over view counts.
        </p>
        <div className="flex gap-3 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            type="button"
            onClick={() => (ownStory ? setViewing(ownStory) : setComposerOpen(true))}
            className="w-[4.5rem] shrink-0 text-center"
          >
            <div className="relative mx-auto h-[68px] w-[68px] rounded-full border-2 border-dashed border-emerald-500 bg-emerald-50 p-0.5 dark:bg-emerald-950/40">
              <LazyImage
                src={profile.photos?.[0] || "/avatars/user.svg"}
                alt="Your story"
                className="h-full w-full rounded-full border-2 border-white object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                <Plus size={11} strokeWidth={3} />
              </span>
            </div>
            <span className="mt-1.5 block truncate text-[11px] font-bold text-foreground">Your story</span>
          </button>
          {otherStories.map((story) => (
            <button key={story.id} type="button" onClick={() => {
                setViewing(story)
                setStoryReaction(null)
                setSeenStoryIds((prev) => {
                  if (prev.includes(story.id)) return prev
                  const next = [...prev, story.id].slice(-80)
                  try { window.localStorage.setItem("ghc-story-seen", JSON.stringify(next)) } catch {}
                  return next
                })
              }} className="w-[4.5rem] shrink-0 text-center">
              <div className={`mx-auto h-[68px] w-[68px] rounded-full p-[2.5px] ${
                seenStoryIds.includes(story.id)
                  ? "bg-stone-300"
                  : "bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400"
              }`}>
                <LazyImage
                  src={story.photo || `/avatars/${story.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`}
                  alt={`${story.name}'s story`}
                  className="h-full w-full rounded-full border-2 border-white object-cover"
                />
              </div>
              <span className="mt-1.5 block truncate text-[11px] font-semibold text-foreground">{story.name}</span>
            </button>
          ))}
        </div>
        {composerOpen && (
          <div className="mt-2 rounded-xl border border-purple-100 bg-purple-50/50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-900">New story</p>
              <button type="button" onClick={() => setComposerOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
                {([
                  { id: "everyone" as const, label: "Public" },
                  { id: "followers" as const, label: "Followers" },
                  { id: "friends" as const, label: "Friends" },
                  { id: "private" as const, label: "Only me" },
                ]).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setStoryAudience(a.id)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      storyAudience === a.id ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-[10px] text-gray-500">Visible for 24 hours · Replies become private messages</p>
<textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="Share a status…"
              className="mt-2 min-h-16 w-full resize-none rounded-lg border border-gray-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="mt-2 flex gap-2">
              <input ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { void readMedia(e.target.files?.[0], "image"); e.currentTarget.value = "" }} />
              <input ref={videoRef} type="file" accept="video/*" className="sr-only" onChange={(e) => { void readMedia(e.target.files?.[0], "video"); e.currentTarget.value = "" }} />
              <button type="button" onClick={() => imageRef.current?.click()} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold">Photo</button>
              <button type="button" onClick={() => videoRef.current?.click()} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold">Video</button>
              <button type="button" onClick={() => void publish()} disabled={publishing || (!text.trim() && !media)} className="ml-auto rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:bg-gray-300">
                {publishing ? "…" : "Share"}
              </button>
            </div>
          </div>
        )}
        {viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-950">{viewing.name}&apos;s story</p>
                <button type="button" onClick={() => setViewing(null)} aria-label="Close story"><X size={20} /></button>
              </div>
              {viewing.media?.type === "image" && <LazyImage src={viewing.media.url} alt="Story" className="mt-4 max-h-[45vh] w-full rounded-2xl object-cover" />}
              <p className="mt-2 text-center text-[11px] text-white/70">
                {viewing.audience ? `${viewing.audience} · ` : ""}Expires in ~{hoursLeft(viewing)}h
                {viewing.ownerId === "current-user" && (
                  <span className="block text-[10px] text-white/60">
                    Insights: ~{(viewing.viewIds?.length ?? 0) || "—"} views · {viewing.replyCount ?? 0} replies (private to you)
                  </span>
                )}
                {viewing.ownerId === "current-user" && (
                  <>
                    {" · "}
                    <button type="button" className="underline" onClick={() => toggleHighlight(viewing.id)}>
                      {highlights.includes(viewing.id) ? "In highlights" : "Add to highlights"}
                    </button>
                  </>
                )}
              </p>
              {viewing.media?.type === "video" && <video src={viewing.media.url} controls className="mt-4 max-h-[45vh] w-full rounded-2xl" />}
              {viewing.text && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{viewing.text}</p>}
              {viewing.ownerId && viewing.ownerId !== "current-user" && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="mb-3 flex gap-2">
                    {["👏", "🔥", "💚", "🙌"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setStoryReaction(emoji)
                          addToast(`Reacted ${emoji}`, "success")
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
                          storyReaction === emoji ? "bg-emerald-100 ring-2 ring-emerald-500" : "bg-gray-100"
                        }`}
                        aria-label={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reply as private message</p>
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-purple-50 px-2.5 py-2">
                    <LazyImage
                      src={viewing.photo || viewing.media?.url || "/placeholder.svg?width=40&height=40"}
                      alt=""
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold text-purple-800">Story from {viewing.name}</p>
                      <p className="truncate text-[10px] text-purple-600">
                        {viewing.text?.slice(0, 60) || "Photo/video story"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value.slice(0, 300))}
                      placeholder="Reply to this story…"
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                      aria-label="Story reply"
                    />
                    <button
                      type="button"
                      disabled={!replyText.trim() || replying}
                      className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      onClick={async () => {
                        const text = replyText.trim()
                        if (!text || !viewing.ownerId) return
                        const blocked = new Set([...(blockedUsers || []), ...((settings as { blockedUsers?: string[] })?.blockedUsers || [])])
                        if (blocked.has(viewing.ownerId)) {
                          addToast("You cannot reply — this user is blocked", "error")
                          return
                        }
                        setReplying(true)
                        try {
                          const preview = viewing.text?.slice(0, 80) || (viewing.media ? "Photo/video story" : "Story")
                          const body = `📷 Story reply\n> ${preview}\n\n${text}`
                          const convId = await startConversation?.(
                            viewing.ownerId,
                            viewing.name || "Member",
                            viewing.photo || "/placeholder.svg?width=40&height=40",
                          )
                          if (convId && sendMessage) {
                            await sendMessage(convId, body)
                            addToast("Reply sent as a private message", "success")
                            setReplyText("")
                            setViewing(null)
                            setTab?.("messages")
                          } else if (!convId) {
                            addToast("Could not open conversation", "error")
                          }
                        } catch {
                          addToast("Could not send story reply", "error")
                        } finally {
                          setReplying(false)
                        }
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="border-t border-gray-100 bg-white px-4 py-4 sm:px-6" aria-label="Your stories">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-purple-600">Your stories</p>
          <h3 className="mt-0.5 text-base font-bold text-gray-950">Share a moment</h3>
        </div>
        <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-purple-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 active:scale-95">
          <Plus size={15} /> Add
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <button type="button" onClick={() => ownStory && setViewing(ownStory)} disabled={!ownStory} className="w-20 shrink-0 text-center disabled:opacity-70">
          <div className="mx-auto h-[4.5rem] w-[4.5rem] rounded-full border-4 border-dashed border-purple-300 bg-purple-50 p-0.5 shadow-sm">
            <LazyImage src={profile.photos?.[0] || "/avatars/user.svg"} alt="Your story" className="h-full w-full rounded-full border-2 border-white object-cover" />
          </div>
          <span className="relative mx-auto mt-1 block w-fit truncate text-[11px] font-semibold text-gray-700">
            Your story
            <span className="absolute -right-4 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7C3AED] text-[11px] font-bold text-white">
              <Plus size={10} />
            </span>
          </span>
        </button>
      </div>
      {composerOpen && (
        <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Create a story</p>
            <button type="button" onClick={() => setComposerOpen(false)} aria-label="Close story composer"><X size={18} /></button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {([
              { id: "everyone" as const, label: "Public" },
              { id: "followers" as const, label: "Followers" },
              { id: "friends" as const, label: "Friends" },
              { id: "private" as const, label: "Only me" },
            ]).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setStoryAudience(a.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  storyAudience === a.id ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] text-gray-500">Visible for 24 hours · Replies become private messages</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 500))}
            placeholder="Share a status update"
            className="mt-3 min-h-20 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="mt-3 flex gap-2">
            <input ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { void readMedia(event.target.files?.[0], "image"); event.currentTarget.value = "" }} />
            <input ref={videoRef} type="file" accept="video/*" className="sr-only" onChange={(event) => { void readMedia(event.target.files?.[0], "video"); event.currentTarget.value = "" }} />
            <button type="button" onClick={() => imageRef.current?.click()} disabled={uploading !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-wait disabled:opacity-60">
              <Image size={15} /> {uploading === "image" ? "Loading…" : "Photo"}
            </button>
            <button type="button" onClick={() => videoRef.current?.click()} disabled={uploading !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-wait disabled:opacity-60">
              <Video size={15} /> {uploading === "video" ? "Loading…" : "Video"}
            </button>
            <button type="button" onClick={() => void publish()} disabled={uploading !== null || publishing || (!text.trim() && !media)} className="ml-auto rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white disabled:bg-gray-300">
              {publishing ? "Sharing…" : "Share"}
            </button>
          </div>
        </div>
      )}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-950">{viewing.name}&apos;s story</p>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close story"><X size={20} /></button>
            </div>
            {viewing.media?.type === "image" && <LazyImage src={viewing.media.url} alt="Story" className="mt-4 max-h-[45vh] w-full rounded-2xl object-cover" />}
              <p className="mt-2 text-center text-[11px] text-white/70">
                {viewing.audience ? `${viewing.audience} · ` : ""}Expires in ~{hoursLeft(viewing)}h
                {viewing.ownerId === "current-user" && (
                  <span className="block text-[10px] text-white/60">
                    Insights: ~{(viewing.viewIds?.length ?? 0) || "—"} views · {viewing.replyCount ?? 0} replies (private to you)
                  </span>
                )}
                {viewing.ownerId === "current-user" && (
                  <>
                    {" · "}
                    <button type="button" className="underline" onClick={() => toggleHighlight(viewing.id)}>
                      {highlights.includes(viewing.id) ? "In highlights" : "Add to highlights"}
                    </button>
                  </>
                )}
              </p>
            {viewing.media?.type === "video" && <video src={viewing.media.url} controls className="mt-4 max-h-[45vh] w-full rounded-2xl" />}
            {viewing.text && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{viewing.text}</p>}
            {viewing.ownerId && viewing.ownerId !== "current-user" && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reply as message</p>
                <div className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 300))}
                    placeholder="Reply to this story…"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    aria-label="Story reply"
                  />
                  <button
                    type="button"
                    disabled={!replyText.trim() || replying}
                    className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    onClick={async () => {
                      const text = replyText.trim()
                      if (!text || !viewing.ownerId) return
                      setReplying(true)
                      try {
                        const preview = viewing.text?.slice(0, 80) || (viewing.media ? "Photo/video story" : "Story")
                        const body = `📷 Story reply\n> ${preview}\n\n${text}`
                        const convId = await startConversation?.(
                          viewing.ownerId,
                          viewing.name || "Member",
                          viewing.photo || "/placeholder.svg?width=40&height=40",
                        )
                        if (convId && sendMessage) {
                          await sendMessage(convId, body)
                          addToast("Reply sent as a private message", "success")
                          setReplyText("")
                          setViewing(null)
                          setTab?.("messages")
                        } else if (!convId) {
                          addToast("Could not open conversation", "error")
                        }
                      } catch {
                        addToast("Could not send story reply", "error")
                      } finally {
                        setReplying(false)
                      }
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// Named export for bundlers that resolve either style
export { ProfileStorySection }
