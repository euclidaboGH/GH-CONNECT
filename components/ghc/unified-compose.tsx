"use client"

import { useEffect, useRef, useState } from "react"
import { Image, Video, X, Globe, Users, Lock, MapPin, Tag } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { validateImageFiles, validateMediaFile } from "@/lib/media-validation"
import { compressImage } from "@/lib/ghc-data"
import type { StoryItem } from "@/lib/ghc-types"

export type ComposeMode = "post" | "story"
export type Audience = "public" | "followers" | "mutuals" | "private"

interface UnifiedComposeProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Initial tab when opening */
  initialMode?: ComposeMode
}

/**
 * Full-screen compose (Facebook-class New post).
 * Single pipeline for Feed FAB and Profile "What's on your mind?" / Add story.
 * Long-form text, multi-photo, audience, Post | Story — one product surface.
 */
export function UnifiedCompose({ open, onOpenChange, initialMode = "post" }: UnifiedComposeProps) {
  const { createPost, publishStory, profile, addToast, candidates, following, conversations } = useGHC()
  const [mode, setMode] = useState<ComposeMode>(initialMode)
  const [text, setText] = useState("")
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [storyMedia, setStoryMedia] = useState<StoryItem["media"]>(null)
  const [audience, setAudience] = useState<Audience>("public")
  const [showAudience, setShowAudience] = useState(false)
  const [postPreset, setPostPreset] = useState<"thought" | "question" | "win" | "opportunity" | null>(null)
  const [scheduleFor, setScheduleFor] = useState<string>("") // datetime-local value
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [storyMode, setStoryMode] = useState<"social" | "professional">("social")
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [storyAudience, setStoryAudience] = useState<"everyone" | "followers" | "friends" | "private">("followers")
  const [isPublishing, setIsPublishing] = useState(false)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("")

  const DRAFT_KEY = "ghc-post-draft-v1"
  const publishingRef = useRef(false)

  const communityOptions = (conversations || [])
    .filter(
      (c) =>
        c.conversationType === "group" ||
        Boolean((c as { isCommunity?: boolean }).isCommunity),
    )
    .map((c) => ({
      id: c.id,
      name: c.groupName || c.participantName || "Community",
    }))

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      if (initialMode === "post") {
        try {
          const raw = window.localStorage.getItem("ghc-post-draft-v1")
          if (raw) {
            const d = JSON.parse(raw) as { text?: string; audience?: Audience }
            if (d.text) setText(d.text)
            if (d.audience) setAudience(d.audience)
          }
        } catch { /* ignore */ }
      }
      const t = window.setTimeout(() => textareaRef.current?.focus(), 80)
      return () => window.clearTimeout(t)
    }
  }, [open, initialMode])

  // Autosave post draft
  useEffect(() => {
    if (!open || mode !== "post") return
    try {
      if (text.trim()) {
        window.localStorage.setItem("ghc-post-draft-v1", JSON.stringify({ text, audience, at: Date.now() }))
      }
    } catch { /* ignore */ }
  }, [text, audience, open, mode])

  if (!open) return null

  const close = () => {
    onOpenChange(false)
    setText("")
    setSelectedImages([])
    setSelectedVideo(null)
    setStoryMedia(null)
    setAudience("public")
    setShowAudience(false)
    setMode(initialMode)
  }

  const readFileAsDataUrl = (file: File, kind: "image" | "video") =>
    new Promise<string>((resolve, reject) => {
      try {
        validateMediaFile(file, kind)
      } catch (error) {
        reject(error)
        return
      }
      const reader = new FileReader()
      reader.onload = () =>
        typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read media"))
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read media"))
      reader.readAsDataURL(file)
    })

  const handleImages = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadProgress("Preparing media…")
    try {
      if (mode === "story") {
        const file = files[0]
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
        if (file.size > 12 * 1024 * 1024) {
          addToast(`Large file (${sizeMb} MB) — compressing for smooth upload…`, "info")
        }
        const url = await compressImage(file)
        setStoryMedia({ type: "image", url })
        setSelectedImages([])
        setSelectedVideo(null)
        addToast(`Photo ready (${sizeMb} MB → optimized)`, "success")
      } else {
        const images = await Promise.all(
          validateImageFiles(Array.from(files)).map((file) => readFileAsDataUrl(file, "image")),
        )
        setSelectedImages((prev) => [...prev, ...images].slice(0, 10))
        setSelectedVideo(null)
        setStoryMedia(null)
      }
    } catch {
      addToast("Unable to add photo — try a smaller file", "error")
    } finally {
      setUploadProgress(null)
    }
  }

  const handleVideo = async (file: File | undefined) => {
    if (!file) return
    try {
      if (mode === "story") {
        const url = URL.createObjectURL(file)
        setStoryMedia({ type: "video", url })
        setSelectedImages([])
        setSelectedVideo(null)
      } else {
        setSelectedVideo(await readFileAsDataUrl(file, "video"))
        setSelectedImages([])
        setStoryMedia(null)
      }
    } catch {
      addToast("Unable to add video", "error")
    }
  }

  
  const hashSuggestions = (() => {
    const m = text.match(/#(\w{1,24})$/)
    if (!m) return [] as string[]
    const q = m[1].toLowerCase()
    const pool = [
      ...(profile.interests || []),
      "growth", "community", "opportunity", "mentor", "tech", "lagos", "nigeria", "ghconnect",
    ]
    return Array.from(new Set(pool.map(String)))
      .filter((t) => t.toLowerCase().includes(q) || t.toLowerCase().startsWith(q))
      .slice(0, 6)
  })()

  const mentionSuggestions = (() => {
    const m = text.match(/@(\w{0,24})$/)
    if (!m) return [] as { id: string; name: string }[]
    const q = m[1].toLowerCase()
    const people = (candidates || []).slice(0, 40).map((c: { id: string; name?: string }) => ({
      id: c.id,
      name: typeof c.name === "string" ? c.name : "Member",
    }))
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
  })()

  const canPublish =
    mode === "post"
      ? Boolean(text.trim() || selectedImages.length > 0 || selectedVideo)
      : Boolean(text.trim() || storyMedia)

  const handlePublish = async () => {
    if (publishingRef.current || isPublishing || !canPublish) return
    publishingRef.current = true
    setIsPublishing(true)
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
          addToast("You are offline — we will post when you are back online", "info")
        }
      if (mode === "post") {
        const community =
          selectedCommunityId
            ? communityOptions.find((c) => c.id === selectedCommunityId) || null
            : null
        const created = await createPost(
          text.trim(),
          selectedImages,
          selectedVideo,
          null,
          null,
          audience,
          community,
        )
        if (created) {
          try { window.localStorage.removeItem("ghc-post-draft-v1") } catch { /* ignore */ }
          if (scheduleFor) {
            try {
              const when = new Date(scheduleFor).getTime()
              if (when > Date.now()) {
                const q = JSON.parse(window.localStorage.getItem("ghc-scheduled-posts") || "[]")
                q.push({ content: text.trim(), when, at: Date.now() })
                window.localStorage.setItem("ghc-scheduled-posts", JSON.stringify(q.slice(-20)))
                addToast("Also saved to local schedule list", "info")
              }
            } catch { /* ignore */ }
          }
          setPostPreset(null)
          setScheduleFor("")
          close()
        }
      } else {
        const now = Date.now()
        const next: StoryItem = {
          id: `story-${now}`,
          ownerId: "current-user",
          name: profile.displayName || "You",
          photo: profile.photos?.[0],
          text: storyMode === "professional" && text.trim() && !text.includes("[Pro]") ? `[Pro] ${text.trim()}` : text.trim(),
          media: storyMedia,
          createdAt: now,
          status: "published",
          audience: storyAudience,
          expiresAt: now + 24 * 60 * 60 * 1000,
          // @ts-expect-error optional client field
          storyMode,
        }
        await publishStory(next)
        addToast(`Story shared · ${storyAudience === "everyone" ? "Public" : storyAudience} · 24h`, "success")
        close()
      }
    } catch {
      addToast(mode === "post" ? "Failed to create post" : "Could not publish story", "error")
    } finally {
      publishingRef.current = false
      setIsPublishing(false)
    }
  }

  const audienceLabel =
    audience === "public"
      ? "Public"
      : audience === "followers"
        ? "Followers"
        : audience === "mutuals"
          ? "Mutuals"
          : "Only me"

  const AudienceIcon =
    audience === "public" ? Globe : audience === "private" ? Lock : Users

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-compose-title"
    >
      {/* Top bar — full-screen New post */}
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
          aria-label="Close"
        >
          <X size={22} />
        </button>
        <h1 id="unified-compose-title" className="flex-1 text-center text-base font-bold text-gray-900">
          {mode === "post" ? "New post" : "New story"}
        </h1>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish || isPublishing}
          aria-busy={isPublishing}
          className="min-h-9 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {isPublishing ? "…" : mode === "post" ? "Post" : "Share"}
        </button>
      </header>

      {/* Mode tabs */}
      <div className="flex shrink-0 border-b border-gray-100 px-3" role="tablist" aria-label="Compose type">
        {(["post", "story"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => {
              setMode(tab)
              setSelectedImages([])
              setSelectedVideo(null)
              setStoryMedia(null)
            }}
            className={`min-h-11 flex-1 text-sm font-bold transition ${
              mode === tab
                ? "border-b-2 border-purple-600 text-purple-700"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab === "post" ? "Post" : "Story"}
          </button>
        ))}
      </div>

      {/* Scrollable body — long-form first-class */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

        {/* Optional community board target */}
        {mode === "post" && communityOptions.length > 0 && (
          <div className="px-3 pb-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Community board (optional)
            </label>
            <select
              value={selectedCommunityId}
              onChange={(e) => setSelectedCommunityId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground"
              aria-label="Post to community"
            >
              <option value="">Personal feed only</option>
              {communityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCommunityId ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Also shares to the community board. Still respects your visibility setting.
              </p>
            ) : null}
          </div>
        )}

        <div className="px-4 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <img
              src={profile.photos?.[0] || "/placeholder.svg?width=48&height=48"}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-2 ring-purple-100"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{profile.displayName || "You"}</p>
              {mode === "post" ? (
                <button
                  type="button"
                  onClick={() => setShowAudience((v) => !v)}
                  className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-200"
                >
                  <AudienceIcon size={12} />
                  {audienceLabel}
                </button>
              ) : (
                <p className="text-[11px] text-gray-500">Visible for 24 hours</p>
              )}
            </div>
          </div>

          {showAudience && mode === "post" && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {(
                [
                  { id: "public" as const, label: "Public", desc: "Anyone on GH Connect", Icon: Globe },
                  { id: "followers" as const, label: "Followers", desc: "People who follow you", Icon: Users },
                  { id: "mutuals" as const, label: "Mutuals", desc: "You both follow each other", Icon: Users },
                  { id: "private" as const, label: "Only me", desc: "Hidden from the feed", Icon: Lock },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAudience(opt.id)
                    setShowAudience(false)
                  }}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-purple-50 ${
                    audience === opt.id ? "bg-purple-50/80" : ""
                  }`}
                >
                  <opt.Icon size={18} className="mt-0.5 shrink-0 text-purple-600" />
                  <span>
                    <span className="block text-sm font-bold text-gray-900">{opt.label}</span>
                    <span className="block text-[11px] text-gray-500">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}


          {mode === "post" && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Post type">
              {(
                [
                  { id: "thought" as const, label: "Thought", hint: "Share an idea…" },
                  { id: "question" as const, label: "Question", hint: "Ask the community…" },
                  { id: "win" as const, label: "Win", hint: "Celebrate a win…" },
                  { id: "opportunity" as const, label: "Opportunity", hint: "Share an opening…" },
                ]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPostPreset(p.id)
                    if (!text.trim()) setText("")
                    const el = textareaRef.current
                    if (el && !text.trim()) el.placeholder = p.hint
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    postPreset === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-primary/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {text.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    try { window.localStorage.setItem("ghc-post-draft-v1", JSON.stringify({ text, audience, at: Date.now() })) } catch {}
                    addToast("Draft saved on this device", "success")
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  Save draft
                </button>
              )}
            </div>
          )}

          {mode === "story" && (
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Audience</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "everyone" as const, label: "Public" },
                    { id: "followers" as const, label: "Followers" },
                    { id: "friends" as const, label: "Friends" },
                    { id: "private" as const, label: "Only me" },
                  ]
                ).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setStoryAudience(a.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      storyAudience === a.id ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Stories expire in 24 hours. Replies open a private message.</p>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, mode === "story" ? 500 : 5000))}
            placeholder={mode === "post" ? "What's on your mind?" : "Share a moment…"}
            className="min-h-[140px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-gray-900 placeholder-gray-400 focus:outline-none"
            rows={8}
          />
          <p className="text-right text-[11px] text-gray-400">
            {text.length}/{mode === "story" ? 500 : 5000}

          {(hashSuggestions.length > 0 || mentionSuggestions.length > 0) && (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-2">
              {hashSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
                  onClick={() => setText((prev) => prev.replace(/#\w*$/, `#${tag.replace(/^#/, "")} `))}
                >
                  #{tag.replace(/^#/, "")}
                </button>
              ))}
              {mentionSuggestions.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground"
                  onClick={() => setText((prev) => prev.replace(/@\w*$/, `@${person.name.split(" ")[0]} `))}
                >
                  @{person.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}

          {mode === "post" && (
            <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 p-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduleFor}
                onChange={(e) => setScheduleFor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Leave empty to post now. Scheduled posts stay on this device until publish time.</p>
            </div>
          )}

          {mode === "story" && (
            <div className="mb-2 flex gap-1.5">
              <button type="button" onClick={() => setStoryMode("social")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${storyMode === "social" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Social</button>
              <button type="button" onClick={() => setStoryMode("professional")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${storyMode === "professional" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>Professional</button>
            </div>
          )}

          {uploadProgress && (
            <p className="mb-2 text-[11px] font-medium text-primary" role="status">{uploadProgress}</p>
          )}
          </p>

          {/* Media previews */}
          {mode === "post" && selectedImages.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedImages.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1.5 text-white"
                    onClick={() => setSelectedImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                    aria-label="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {mode === "post" && selectedVideo && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700">
              <span>Video attached</span>
              <button type="button" onClick={() => setSelectedVideo(null)} className="text-purple-600">
                Remove
              </button>
            </div>
          )}
          {mode === "story" && storyMedia?.type === "image" && (
            <div className="relative mt-3 overflow-hidden rounded-2xl">
              <img src={storyMedia.url} alt="" className="max-h-64 w-full object-cover" />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                onClick={() => setStoryMedia(null)}
                aria-label="Remove media"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {mode === "story" && storyMedia?.type === "video" && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700">
              <span>Video ready for story</span>
              <button type="button" onClick={() => setStoryMedia(null)} className="text-purple-600">
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tools — always visible like Facebook */}
      <footer className="shrink-0 border-t border-gray-200 bg-white px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple={mode === "post"}
          className="sr-only"
          onChange={(e) => {
            void handleImages(e.target.files)
            e.currentTarget.value = ""
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => {
            void handleVideo(e.target.files?.[0])
            e.currentTarget.value = ""
          }}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98]"
          >
            <Image size={18} aria-hidden /> Photo
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-50 text-sm font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98]"
          >
            <Video size={18} aria-hidden /> Video
          </button>
          {mode === "post" && (
            <button
              type="button"
              onClick={() => setShowAudience((v) => !v)}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-200"
              aria-label="Audience"
            >
              <AudienceIcon size={16} />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          {mode === "post"
            ? "Long posts, photos & video · safer audiences than open social defaults"
            : "Stories disappear after 24 hours"}
        </p>
      </footer>
    </div>
  )
}
