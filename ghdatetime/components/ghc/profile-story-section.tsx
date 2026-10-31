"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download,
  ArrowLeft, ArrowRight, Camera, Check, Clock3, Eye, ImagePlus, LoaderCircle,
  Palette, Plus, Send, ShieldCheck, Sparkles, Type, Video, X,
} from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { socialListStoryViewers, socialViewStory, socialToggleStoryReaction } from "@/lib/social/client"
import { compressImage } from "@/lib/ghc-data"
import { uploadDurableMedia } from "@/lib/media/upload-client"
import { toRelativeMediaFacadeUrl, resolveDisplayMediaUrl, isMediaFacadeUrl } from "@/lib/media/resolve-display-url"
import { isBlobUrl } from "@/lib/media/durable-url"
import { mediaUserMessage } from "@/lib/media/user-messages"
import type { StoryAudience, StoryItem } from "@/lib/ghc-types"
import { LazyImage } from "./lazy-image"
import { downloadMedia } from "@/lib/media/download-media"
import { prefetchStoryMediaUrls } from "@/lib/media/prefetch-story-media"
import { prefersReducedMotion } from "@/lib/ui/prefers-reduced-motion"

type StoryMode = "choose" | "text" | "camera"
type StoryViewerRecord = Record<string, unknown>

const STORY_BACKGROUNDS = [
  { name: "Aurora", value: "linear-gradient(145deg,#064e3b 0%,#047857 48%,#0f172a 100%)" },
  { name: "Sunset", value: "linear-gradient(145deg,#7c2d12 0%,#db2777 52%,#4c1d95 100%)" },
  { name: "Ocean", value: "linear-gradient(145deg,#082f49 0%,#0369a1 52%,#312e81 100%)" },
  { name: "Golden", value: "linear-gradient(145deg,#713f12 0%,#ca8a04 52%,#9a3412 100%)" },
  { name: "Berry", value: "linear-gradient(145deg,#4a044e 0%,#a21caf 55%,#831843 100%)" },
  { name: "Night", value: "linear-gradient(145deg,#111827 0%,#334155 52%,#020617 100%)" },
]

const STORY_AUDIENCES: Array<{ id: StoryAudience; title: string; detail: string }> = [
  { id: "everyone", title: "Everyone", detail: "Anyone who can discover your profile" },
  { id: "followers", title: "Followers", detail: "People who follow you" },
  { id: "friends", title: "Friends", detail: "Your mutual connections" },
  { id: "private", title: "Only me", detail: "Keep this moment private" },
]

function isInlineImage(url: string | undefined) {
  return Boolean(url && url.startsWith("data:image/"))
}

/**
 * Modern, mobile-first Stories experience. Story ownership and engagement are
 * server-backed where available; UI never reports a local-only reaction as sent.
 */
export default function ProfileStorySection({ scope = "profile", creatorHost = false }: { scope?: "profile" | "feed"; creatorHost?: boolean }) {
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

  const isOwnStory = useCallback((story: StoryItem) => {
    return story.ownerId === "current-user" || Boolean(profile.id && story.ownerId === profile.id)
  }, [profile.id])

  const ownStory = stories
    .filter((story) => isOwnStory(story) && (story.expiresAt == null || story.expiresAt > Date.now()))
    .sort((a, b) => b.createdAt - a.createdAt)[0]

  const profileAvatar =
    (Array.isArray(profile?.photos) && profile.photos.find((u: string) => typeof u === "string" && u && !u.startsWith("blob:"))) ||
    ""

  const followingSet = new Set(following.map(String))
  const friendSet = new Set(friends.map((friend: unknown) => {
    if (typeof friend === "string") return friend
    if (friend && typeof friend === "object") {
      const item = friend as { id?: string; userId?: string; friendId?: string }
      return String(item.userId || item.friendId || item.id || "")
    }
    return ""
  }).filter(Boolean))

  const otherStories = scope === "feed" ? stories
    .filter((story) => {
      if (!story.ownerId || isOwnStory(story) || (story.expiresAt != null && story.expiresAt <= Date.now())) return false
      if (story.audience === "private" || story.audience === "matches-only") return false
      if (story.audience === "friends") return friendSet.has(String(story.ownerId))
      if (story.audience === "followers") return followingSet.has(String(story.ownerId)) || friendSet.has(String(story.ownerId))
      return followingSet.has(String(story.ownerId)) || friendSet.has(String(story.ownerId)) || story.audience === "everyone" || !story.audience
    })
    .sort((a, b) => b.createdAt - a.createdAt) : []

  const queue = [ownStory, ...otherStories].filter((item): item is StoryItem => Boolean(item))

  const storyPrefetchKey = queue.map((q) => q?.id || "").join("|")
  useEffect(() => {
    const urls: string[] = []
    for (const item of queue) {
      const u = item?.media?.url
      if (u && item.media?.type === "image") urls.push(String(u))
      if (item?.photo) urls.push(String(item.photo))
    }
    prefetchStoryMediaUrls(urls)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefetch when story ids change
  }, [storyPrefetchKey])

  const [creatorOpen, setCreatorOpen] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryMode>("choose")
  const [text, setText] = useState("")
  const [media, setMedia] = useState<{ type: "image" | "video"; url: string; localPreview?: string } | null>(null)
  const [background, setBackground] = useState(STORY_BACKGROUNDS[0].value)
  const [audience, setAudience] = useState<StoryAudience>("followers")
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [viewing, setViewing] = useState<StoryItem | null>(null)
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([])
  const [highlights, setHighlights] = useState<string[]>([])
  const [replyText, setReplyText] = useState("")
  const [replying, setReplying] = useState(false)
  const [viewerUsers, setViewerUsers] = useState<StoryViewerRecord[]>([])
  const [storyReactionOverrides, setStoryReactionOverrides] = useState<Record<string, Record<string, number>>>({})
  const [loadingViewers, setLoadingViewers] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ghc-story-seen")
      if (raw) setSeenStoryIds(JSON.parse(raw))
      const savedHighlights = window.localStorage.getItem("ghc-story-highlights")
      if (savedHighlights) setHighlights(JSON.parse(savedHighlights))
    } catch { /* optional local story preferences */ }
  }, [])

  const toggleHighlight = (storyId: string) => {
    setHighlights((previous) => {
      const next = previous.includes(storyId)
        ? previous.filter((id) => id !== storyId)
        : [...previous, storyId].slice(-20)
      try { window.localStorage.setItem("ghc-story-highlights", JSON.stringify(next)) } catch { /* optional local preference */ }
      addToast?.(next.includes(storyId) ? "Saved to this device’s story highlights" : "Removed from this device’s highlights", "success")
      return next
    })
  }

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (media?.type === "video" && media.url.startsWith("blob:")) URL.revokeObjectURL(media.url)
  }, [media])

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current || !cameraStreamRef.current) return
    cameraVideoRef.current.srcObject = cameraStreamRef.current
    void cameraVideoRef.current.play().catch(() => undefined)
  }, [cameraOpen])

  useEffect(() => {
    if (!viewing) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewing(null)
      if (event.key === "ArrowRight") navigateStory(1)
      if (event.key === "ArrowLeft") navigateStory(-1)
    }
    window.addEventListener("keydown", handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = previousOverflow
    }
    // navigation is stable for this view's queue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing?.id, queue.length])

  const openCreator = () => {
    setText("")
    setMedia(null)
    setStoryMode("choose")
    setCameraError("")
    setCreatorOpen(true)
  }

  const closeCreator = () => {
    stopCamera()
    setCreatorOpen(false)
    setCameraError("")
  }

  useEffect(() => {
    if (!creatorHost) return
    const open = () => {
      setText("")
      setMedia(null)
      setStoryMode("choose")
      setCameraError("")
      setCreatorOpen(true)
    }
    const close = () => {
      stopCamera()
      setCreatorOpen(false)
    }
    window.addEventListener("ghc:open-story-creator", open)
    window.addEventListener("ghc:close-transient-ui", close)
    window.addEventListener("ghc:tab-change", close)
    return () => {
      window.removeEventListener("ghc:open-story-creator", open)
      window.removeEventListener("ghc:close-transient-ui", close)
      window.removeEventListener("ghc:tab-change", close)
    }
  }, [creatorHost, stopCamera])

  const readMedia = async (file: File | undefined, type: "image" | "video") => {
    if (!file) return
    const maxBytes = type === "video" ? 40 * 1024 * 1024 : 25 * 1024 * 1024
    if (file.size > maxBytes) {
      addToast?.(type === "video" ? "Choose a video under 40 MB so it can upload reliably." : "Choose a photo smaller than 25 MB so it can be optimized safely.", "error")
      return
    }
    setUploading(type)
    try {
      let uploadBlob: Blob = file
      let preview = ""
      if (type === "image") {
        preview = await compressImage(file)
        if (preview) uploadBlob = await (await fetch(preview)).blob()
      }
      const uploaded = await uploadDurableMedia(uploadBlob, { fileName: file.name, category: type === "video" ? "videos" : "images" })
      if (uploaded.ok && uploaded.url && uploaded.kind === type) {
        setMedia({ type, url: toRelativeMediaFacadeUrl(uploaded.url), localPreview: type === "image" ? preview || undefined : undefined })
        setStoryMode("choose")
        addToast?.(`${type === "image" ? "Photo" : "Video"} ready`, "success")
      } else {
        addToast?.(
          uploaded.ok === false
            ? (uploaded.userMessage || mediaUserMessage(uploaded.error || "STORAGE_ERROR"))
            : mediaUserMessage("STORAGE_ERROR"),
          "error"
        )
      }
    } catch {
      addToast?.(`Could not prepare this ${type}`, "error")
    } finally {
      setUploading(null)
    }
  }

  const startCamera = async () => {
    setCameraError("")
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera is not available here. Choose a photo or video from your device instead.")
      return
    }
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false })
      cameraStreamRef.current = stream
      setCameraOpen(true)
      setStoryMode("camera")
    } catch {
      setCameraError("Camera access was blocked or unavailable. You can still choose media from your device.")
    }
  }

  const captureCameraPhoto = async () => {
    const video = cameraVideoRef.current
    const canvas = cameraCanvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Try again in a moment.")
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88))
    if (!blob) {
      setCameraError("Could not capture the photo. Please try again.")
      return
    }
    stopCamera()
    await readMedia(new File([blob], `greenhaven-story-${Date.now()}.jpg`, { type: "image/jpeg" }), "image")
  }

  const publish = async () => {
    if (publishing || uploading) return
    const cleanText = text.trim()
    if (!cleanText && !media) {
      addToast?.("Add a photo, video, or a text moment first", "error")
      return
    }
    if (media && isBlobUrl(media.url)) {
      addToast?.("Media is still preparing — wait for the upload to finish", "error")
      return
    }
    setPublishing(true)
    try {
      const now = Date.now()
      const publishMedia = media
        ? { type: media.type, url: media.url }
        : undefined
      const next: StoryItem = {
        id: `story-${now}`,
        ownerId: "current-user",
        name: profile.displayName || "You",
        photo: profile.photos?.[0],
        text: cleanText,
        media: publishMedia,
        background: !media ? background : undefined,
        createdAt: now,
        status: "published",
        audience,
        expiresAt: now + 24 * 60 * 60 * 1000,
      }
      const result = await publishStory?.(next)
      if (!result?.ok) {
        addToast?.(result?.error || "Could not publish your story. Please try again.", "error")
        return
      }
      if (result.durable === false) {
        closeCreator()
        addToast?.(result.error || "Your story is saved locally, but the server did not confirm it. It may not be visible to other people yet.", "error")
        return
      }
      closeCreator()
      addToast?.("Your story is live · expires in 24 hours", "success")
    } catch {
      addToast?.("Could not publish your story. Please try again.", "error")
    } finally {
      setPublishing(false)
    }
  }

  const openStory = (story: StoryItem) => {
    setViewing(story)
    setReplyText("")
    setViewersOpen(false)
    setViewerUsers([])
    if (!isOwnStory(story)) {
      void socialViewStory(String(story.id)).catch(() => undefined)
      setSeenStoryIds((prev) => {
        if (prev.includes(story.id)) return prev
        const next = [...prev, story.id].slice(-120)
        try { window.localStorage.setItem("ghc-story-seen", JSON.stringify(next)) } catch { /* optional */ }
        return next
      })
    }
  }

  const navigateStory = (direction: number) => {
    if (!viewing || !queue.length) return
    const index = queue.findIndex((story) => story.id === viewing.id)
    const next = queue[index + direction]
    if (next) openStory(next)
    else setViewing(null)
  }

  const loadViewers = async (story: StoryItem) => {
    setLoadingViewers(true)
    setViewersOpen(true)
    try {
      const result = await socialListStoryViewers(story.id, 100)
      if (!result.ok) {
        addToast?.(result.error || "Could not load viewers", "error")
        setViewerUsers([])
      } else setViewerUsers(result.users)
    } catch {
      addToast?.("Could not load viewers", "error")
    } finally {
      setLoadingViewers(false)
    }
  }

  const sendStoryReaction = async (emoji: string) => {
    if (!viewing?.ownerId || isOwnStory(viewing) || replying) return
    setReplying(true)
    try {
      const result = await socialToggleStoryReaction(viewing.id, emoji)
      if (!result.ok || result.durable === false) {
        throw new Error(result.error || "Story reaction could not be saved")
      }
      const counts = result.reactionCounts || {}
      setStoryReactionOverrides((previous) => ({ ...previous, [viewing.id]: counts }))
      setViewing((previous) => previous && previous.id === viewing.id
        ? { ...previous, reactionCounts: counts, viewerReactions: result.viewerReactions || previous.viewerReactions || [] }
        : previous)
      // Keep the existing private notification as a best-effort extra; the durable
      // reaction remains saved even if messaging is unavailable.
      if (result.active) {
        try {
          const conversationId = await startConversation?.(viewing.ownerId, viewing.name || "Member", viewing.photo || "")
          if (conversationId && sendMessage) await sendMessage(conversationId, `${emoji} Reacted to your story`)
        } catch { /* a durable story reaction does not depend on private messaging */ }
      }
      addToast?.(result.active ? "Story reaction saved" : "Story reaction removed", "success")
    } catch (error) {
      addToast?.(error instanceof Error ? error.message : "Could not save story reaction", "error")
    } finally {
      setReplying(false)
    }
  }

  const sendReply = async () => {
    const body = replyText.trim()
    if (!body || !viewing?.ownerId || isOwnStory(viewing) || replying) return
    setReplying(true)
    try {
      const preview = viewing.text?.slice(0, 80) || (viewing.media ? "Photo/video story" : "Story")
      const convId = await startConversation?.(viewing.ownerId, viewing.name || "Member", viewing.photo || "")
      if (!convId || !sendMessage) throw new Error("Messaging unavailable")
      const accepted = await sendMessage(convId, `📷 Story reply\n> ${preview}\n\n${body}`)
      if (!accepted) throw new Error("Reply was not accepted")
      setReplyText("")
      setViewing(null)
      setTab?.("messages")
      addToast?.("Reply sent privately", "success")
    } catch {
      addToast?.("Could not send reply", "error")
    } finally {
      setReplying(false)
    }
  }

  const rail = (
    <div className="space-y-3" aria-label="Stories from your community">
      {scope === "feed" ? (
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">Stories</h2>
            <p className="text-[11px] text-muted-foreground">Moments from people you follow · 24h</p>
          </div>
        </div>
      ) : (
        <div className="px-0">
          <h2 className="text-[13px] font-extrabold tracking-tight text-foreground">Your moments</h2>
          <p className="text-[11px] text-muted-foreground">Stories disappear after 24 hours</p>
        </div>
      )}
      <div className="gh-stories-rail flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {/* Own story / add */}
        <button
          type="button"
          onClick={() => (ownStory ? setViewing(ownStory) : openCreator())}
          className="group relative flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [content-visibility:auto] [contain-intrinsic-size:88px_110px]"
          aria-label={ownStory ? "View your story" : "Add a story"}
        >
          <span
            className={`relative h-[88px] w-[88px] overflow-hidden rounded-[1.35rem] border-2 shadow-sm transition group-active:scale-[0.98] ${
              ownStory
                ? "border-emerald-500 ring-2 ring-emerald-500/20"
                : "border-dashed border-border/80 bg-muted/40"
            }`}
          >
            {ownStory?.media?.url && !String(ownStory.media.url).startsWith("blob:") ? (
              ownStory.media.type === "video" ? (
                <video src={ownStory.media.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay loop />
              ) : (
                <LazyImage src={ownStory.media.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )
            ) : ownStory ? (
              profileAvatar ? (
                <>
                  <LazyImage src={profileAvatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <p className="line-clamp-4 whitespace-pre-wrap text-center text-[11px] font-bold leading-snug text-white drop-shadow">
                      {ownStory.text || "Your moment"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-2" style={{ background: ownStory.background || STORY_BACKGROUNDS[0].value }}>
                  <p className="line-clamp-4 whitespace-pre-wrap text-center text-[11px] font-bold leading-snug text-white drop-shadow">
                    {ownStory.text || "Your moment"}
                  </p>
                </div>
              )
            ) : profileAvatar ? (
              <>
                <LazyImage src={profileAvatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/25 p-2 text-center text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-emerald-600 shadow">
                    <Plus size={18} />
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-700 to-teal-400">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/15">
                    <Plus size={18} />
                  </span>
                </div>
              </div>
            )}
            {!ownStory ? (
              <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-emerald-600 text-white shadow">
                <Plus size={12} strokeWidth={3} />
              </span>
            ) : null}
          </span>
          <span className="w-full truncate text-center text-[11px] font-semibold text-foreground">
            {ownStory ? "Your story" : "Add story"}
          </span>
        </button>

        {otherStories.map((item) => {
          const label = String(item.name || item.ownerId || "Member").trim() || "Member"
          const thumb = item.media?.url && !String(item.media.url).startsWith("blob:") ? item.media.url : null
          const avatar = typeof item.photo === "string" && item.photo ? item.photo : null
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewing(item)}
              className="group relative flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [content-visibility:auto] [contain-intrinsic-size:88px_110px]"
              aria-label={`View story from ${label}`}
            >
              <span className="relative h-[88px] w-[88px] overflow-hidden rounded-[1.35rem] border-2 border-transparent bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-[2px] shadow-sm transition group-active:scale-[0.98]">
                <span className="relative block h-full w-full overflow-hidden rounded-[1.2rem] bg-card">
                  {thumb ? (
                    item.media?.type === "video" ? (
                      <video src={thumb} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                    ) : (
                      <LazyImage src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )
                  ) : avatar ? (
                    <LazyImage src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-muted text-lg font-bold text-muted-foreground">
                      {label.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-semibold text-foreground">{label}</span>
            </button>
          )
        })}

        {scope === "feed" && otherStories.length === 0 && !ownStory ? (
          <button
            type="button"
            onClick={openCreator}
            className="flex h-[88px] min-w-[148px] shrink-0 snap-start flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-border/80 bg-muted/30 px-3 text-center text-[11px] text-muted-foreground transition hover:bg-muted/50"
          >
            <Sparkles size={18} className="mb-1.5 text-emerald-600" />
            Be the first to share a moment with your community.
          </button>
        ) : null}
      </div>
    </div>
  )

  const creator = creatorOpen ? (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#07110f] text-white" role="dialog" aria-modal="true" aria-label="Create a story">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={closeCreator} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Close story creator"><X size={20} /></button>
        <div className="min-w-0 text-center"><p className="text-sm font-bold tracking-wide">Create a story</p><p className="text-[11px] text-white/55">A moment that disappears in 24 hours</p></div>
        <button type="button" onClick={() => setAudienceOpen((open) => !open)} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold"><ShieldCheck size={14} />{STORY_AUDIENCES.find((a) => a.id === audience)?.title || "Audience"}</button>
      </header>

      {audienceOpen && <div className="absolute right-3 top-[4.5rem] z-20 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-[#12211d] p-2 shadow-2xl">
        <p className="px-3 py-2 text-xs font-bold text-white/70">Who can see this story?</p>
        {STORY_AUDIENCES.map((item) => <button key={item.id} type="button" onClick={() => { setAudience(item.id); setAudienceOpen(false) }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"><span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/40">{audience === item.id && <span className="h-2 w-2 rounded-full bg-emerald-400" />}</span><span className="flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="block text-[11px] text-white/55">{item.detail}</span></span></button>)}
      </div>}

      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-6">
        <div className="relative flex h-full max-h-[min(76vh,52rem)] w-full max-w-[27rem] flex-col overflow-hidden rounded-[1.8rem] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,.45)]" style={{ background: !media ? background : "#111827" }}>
          {cameraOpen ? <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black"><video ref={cameraVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" /><canvas ref={cameraCanvasRef} className="hidden" /><div className="absolute bottom-5 flex items-center gap-4"><button type="button" onClick={stopCamera} className="rounded-full bg-black/55 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void captureCameraPhoto()} className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-white/20 shadow-xl" aria-label="Take photo"><span className="h-10 w-10 rounded-full bg-white" /></button></div></div> : media?.url ? <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">{media.type === "image" ? <img src={media.localPreview || media.url} alt="Story preview" className="h-full w-full object-contain" /> : <video src={media.localPreview || media.url} controls playsInline className="h-full w-full object-contain" />}<button type="button" onClick={() => setMedia(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60" aria-label="Remove selected media"><X size={17} /></button></div> : storyMode === "text" ? <div className="flex min-h-0 flex-1 flex-col justify-center p-6 sm:p-8"><div className="mb-4 flex items-center gap-2 text-white/75"><Type size={17} /><span className="text-xs font-semibold uppercase tracking-[.18em]">Text story</span></div><textarea autoFocus value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="What’s on your mind?" maxLength={500} className="min-h-[13rem] w-full resize-none bg-transparent text-center text-2xl font-semibold leading-relaxed text-white outline-none placeholder:text-white/50 sm:text-3xl" /><p className="text-center text-xs text-white/60">{text.length}/500</p></div> : <div className="flex min-h-0 flex-1 flex-col justify-center p-6 sm:p-8"><div className="mb-5 flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"><Sparkles size={20} /></span><div><p className="text-lg font-bold">Make it a moment.</p><p className="text-xs text-white/65">Start with a photo, video or words.</p></div></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => void startCamera()} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"><Camera size={24} /><span><span className="block text-sm font-bold">Open camera</span><span className="text-[11px] text-white/60">Capture a moment now</span></span></button><button type="button" onClick={() => imageRef.current?.click()} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"><ImagePlus size={24} /><span><span className="block text-sm font-bold">Photo</span><span className="text-[11px] text-white/60">Choose from gallery</span></span></button><button type="button" onClick={() => videoRef.current?.click()} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"><Video size={24} /><span><span className="block text-sm font-bold">Video</span><span className="text-[11px] text-white/60">Choose a video clip</span></span></button><button type="button" onClick={() => { setStoryMode("text"); setMedia(null) }} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"><Type size={24} /><span><span className="block text-sm font-bold">Text story</span><span className="text-[11px] text-white/60">Words with a mood</span></span></button></div><p className="mt-5 text-center text-[11px] leading-relaxed text-white/50">Your original media stays yours. Choose who can see this moment before sharing.</p></div>}

          {!cameraOpen && (media || storyMode === "text") && <div className="shrink-0 space-y-3 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-4 pt-8 sm:p-5 sm:pt-8">
            {storyMode === "text" && !media && <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Text background themes">{STORY_BACKGROUNDS.map((item) => <button key={item.name} type="button" title={item.name} aria-label={`${item.name} background`} onClick={() => setBackground(item.value)} className={`h-8 w-8 shrink-0 rounded-full border-2 ${background === item.value ? "border-white ring-2 ring-white/30" : "border-white/25"}`} style={{ background: item.value }} />)}<span className="ml-1 flex items-center gap-1 text-[11px] text-white/65"><Palette size={13} /> Mood · {text.length}/500</span></div>}
            {media && <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="Add a caption…" rows={2} maxLength={500} className="w-full resize-none rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/40" />}
            <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setStoryMode("choose")} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">Change media</button><button type="button" disabled={publishing || !!uploading || (!text.trim() && !media)} onClick={() => void publish()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-extrabold text-[#06251a] shadow-lg transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{publishing ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={15} />}{publishing ? "Publishing…" : "Share story"}</button></div>
          </div>}
          {uploading && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75 text-center"><LoaderCircle size={30} className="animate-spin text-emerald-300" /><p className="text-sm font-semibold">Preparing your story…</p><p className="text-xs text-white/55">Keep this screen open while media uploads.</p></div>}
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-2 px-4 pb-4 text-[11px] text-white/50"><Clock3 size={13} /> Stories disappear after 24 hours <span>·</span> <ShieldCheck size={13} /> {STORY_AUDIENCES.find((item) => item.id === audience)?.title}</footer>
      {cameraError && <div role="status" className="mx-auto mb-3 max-w-md rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-center text-xs text-amber-100">{cameraError}</div>}
      <input ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { void readMedia(e.currentTarget.files?.[0], "image"); e.currentTarget.value = "" }} />
      <input ref={videoRef} type="file" accept="video/*" className="sr-only" onChange={(e) => { void readMedia(e.currentTarget.files?.[0], "video"); e.currentTarget.value = "" }} />
    </div>
  ) : null

  const viewer = viewing ? (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black text-white" role="dialog" aria-modal="true" aria-label={`${viewing.name || "Member"}'s story`} onClick={() => setViewing(null)} onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null }} onTouchEnd={(e) => { if (touchStartX.current == null) return; const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current; if (Math.abs(delta) > 65) navigateStory(delta < 0 ? 1 : -1); touchStartX.current = null }}>
      <div className="absolute inset-x-0 top-0 z-20 space-y-2.5 bg-gradient-to-b from-black/70 via-black/35 to-transparent p-3 pb-6 sm:px-6 sm:pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex min-w-0 flex-1 gap-1">
          {queue.map((item) => {
            const itemIndex = queue.findIndex((q) => q.id === item.id)
            const activeIndex = queue.findIndex((q) => q.id === viewing.id)
            const completed = itemIndex < activeIndex
            const active = item.id === viewing.id
            return (
              <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  className={`block h-full rounded-full ${completed ? "w-full bg-white" : active && viewing.media?.type !== "video" ? "bg-white" : "bg-transparent"}`}
                  style={active && viewing.media?.type !== "video" && !prefersReducedMotion() ? { animation: "gh-story-progress 7s linear forwards" } : active && viewing.media?.type !== "video" ? { width: "100%" } : undefined}
                  onAnimationEnd={active && viewing.media?.type !== "video" ? () => navigateStory(1) : undefined}
                />
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/40">
            {viewing.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold">{String(viewing.name || "M").slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{viewing.name || "Member"}</p>
            <p className="text-[11px] text-white/70">
              {viewing.createdAt ? new Date(viewing.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit" }) : "Story"}
              {viewing.audience ? ` · ${viewing.audience}` : ""}
            </p>
          </div>
          {viewing.media?.url ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void downloadMedia(viewing.media!.url, { kind: viewing.media?.type === "video" ? "video" : "image" })
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/35"
              aria-label="Download story media"
            >
              <Download size={18} />
            </button>
          ) : null}
          <button type="button" onClick={() => setViewing(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/35" aria-label="Close story">
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="relative flex h-full w-full max-w-5xl items-center justify-center sm:px-14" onClick={(e) => e.stopPropagation()}>
        {viewing.media?.url ? <div className="absolute inset-0 sm:inset-y-4 sm:rounded-[1.7rem] sm:bg-[#101010]" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); void downloadMedia(viewing.media!.url, { kind: viewing.media?.type === "video" ? "video" : "image" }) }} onPointerDown={(e) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest("button, video")) return; const el = e.currentTarget; const timer = window.setTimeout(() => { void downloadMedia(viewing.media!.url, { kind: viewing.media?.type === "video" ? "video" : "image" }); try { if ("vibrate" in navigator) navigator.vibrate(10) } catch { /* */ } }, 550); const clear = () => window.clearTimeout(timer); el.addEventListener("pointerup", clear, { once: true }); el.addEventListener("pointercancel", clear, { once: true }) }}>{viewing.media.type === "video" ? <video key={viewing.id} src={viewing.media.url} controls autoPlay playsInline className="h-full w-full object-contain sm:rounded-[1.7rem]" /> : <img src={viewing.media.url} alt="Story" className="h-full w-full object-contain sm:rounded-[1.7rem]" draggable={false} />}</div> : <div className="absolute inset-0 flex items-center justify-center p-8 sm:inset-y-4 sm:rounded-[1.7rem]" style={{ background: viewing.background || STORY_BACKGROUNDS[0].value }}><p className="max-w-xl whitespace-pre-wrap text-center text-3xl font-bold leading-relaxed drop-shadow-lg sm:text-5xl">{viewing.text}</p></div>}
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-16 sm:inset-x-4 sm:rounded-t-[1.7rem] sm:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/15">{viewing.photo ? <img src={viewing.photo} alt="" className="h-full w-full object-cover" /> : <span className="font-bold">{(viewing.name || "M").slice(0, 1).toUpperCase()}</span>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{isOwnStory(viewing) ? "Your story" : viewing.name || "Member"}</p><p className="text-[11px] text-white/75">{Math.max(0, Math.floor((Date.now() - viewing.createdAt) / 60000)) < 1 ? "Just now" : `${Math.floor((Date.now() - viewing.createdAt) / 60000)}m ago`} · {STORY_AUDIENCES.find((item) => item.id === viewing.audience)?.title || "Story"}</p></div>{isOwnStory(viewing) && <><button type="button" onClick={() => toggleHighlight(viewing.id)} className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-2 text-xs font-semibold"><Sparkles size={14} />{highlights.includes(viewing.id) ? "Highlighted" : "Highlight"}</button><button type="button" onClick={() => void loadViewers(viewing)} className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-2 text-xs font-semibold"><Eye size={15} /> Viewers</button></>}</div></div>
        {queue.findIndex((item) => item.id === viewing.id) > 0 && <button type="button" onClick={() => navigateStory(-1)} className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 sm:left-0" aria-label="Previous story"><ArrowLeft size={20} /></button>}
        {queue.findIndex((item) => item.id === viewing.id) < queue.length - 1 && <button type="button" onClick={() => navigateStory(1)} className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 sm:right-0" aria-label="Next story"><ArrowRight size={20} /></button>}
        {viewing.media && viewing.text && <p className="absolute bottom-28 left-4 right-4 z-10 whitespace-pre-wrap rounded-2xl bg-black/35 px-4 py-3 text-sm leading-relaxed sm:bottom-32 sm:left-8 sm:right-8">{viewing.text}</p>}
        {!isOwnStory(viewing) && <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-5 pt-12 sm:inset-x-4 sm:rounded-b-[1.7rem] sm:px-6 sm:pb-7" onClick={(e) => e.stopPropagation()}><div className="mb-3 flex items-center justify-center gap-3">{["💚", "🔥", "👏", "😂", "😍"].map((emoji) => { const counts = storyReactionOverrides[viewing.id] || viewing.reactionCounts || {}; const count = Number(counts[emoji] || 0); const active = (viewing.viewerReactions || []).includes(emoji); return <button key={emoji} type="button" disabled={replying} onClick={() => void sendStoryReaction(emoji)} className={`relative flex h-12 min-w-12 flex-col items-center justify-center rounded-full border text-lg transition hover:scale-110 disabled:opacity-50 ${active ? "border-emerald-300 bg-emerald-400/25 ring-2 ring-emerald-300/60" : "border-white/15 bg-white/10 hover:bg-white/20"}`} aria-label={`${active ? "Remove" : "Send"} ${emoji} reaction${count ? `; ${count} total` : ""}`} aria-pressed={active}>{emoji}{count > 0 ? <span className="text-[9px] font-bold leading-none text-white/90">{count}</span> : null}</button>})}</div><div className="flex items-center gap-2"><input value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, 300))} onKeyDown={(e) => { if (e.key === "Enter") void sendReply() }} placeholder="Reply privately…" aria-label="Reply to story" className="h-12 min-w-0 flex-1 rounded-full border border-white/20 bg-black/30 px-5 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/60" /><button type="button" onClick={() => void sendReply()} disabled={!replyText.trim() || replying} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#06251a] disabled:opacity-50" aria-label="Send reply">{replying ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}</button></div></div>}
        {isOwnStory(viewing) && <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-12 sm:inset-x-4 sm:rounded-b-[1.7rem] sm:px-6"><p className="text-center text-xs text-white/75"><Eye size={14} className="mr-1 inline" />Story insights · Open Viewers to see who watched</p></div>}
      </div>
      {viewersOpen && <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 sm:items-center" onClick={(e) => { e.stopPropagation(); setViewersOpen(false) }}><div className="max-h-[72vh] w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-[#101a17] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="font-bold">Story viewers</p><p className="text-xs text-white/55">People who watched this story</p></div><button type="button" onClick={() => setViewersOpen(false)} aria-label="Close viewers" className="rounded-full bg-white/10 p-2"><X size={17} /></button></div><div className="max-h-[55vh] overflow-y-auto p-3">{loadingViewers ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-white/70"><LoaderCircle size={18} className="animate-spin" />Loading viewers…</div> : viewerUsers.length ? viewerUsers.map((user, index) => <div key={String(user.userId || index)} className="flex items-center gap-3 rounded-xl px-3 py-3"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10">{typeof user.avatarUrl === "string" && user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span>{String(user.displayName || "M").slice(0, 1).toUpperCase()}</span>}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{String(user.displayName || "Member")}</span><Check size={16} className="text-emerald-300" /></div>) : <p className="p-8 text-center text-sm text-white/55">No viewers yet. When someone watches, they’ll appear here.</p>}</div></div></div>}
    </div>
  ) : null

  if (creatorHost) return <>{creator}</>

  return <section className={scope === "feed" ? "px-1 py-2" : "w-full px-4 py-2"} aria-label={scope === "feed" ? "Stories" : "Your stories"}>
    {rail}
    {creator}
    {viewer}
  </section>
}
