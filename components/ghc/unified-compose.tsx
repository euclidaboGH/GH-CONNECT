"use client"

import { useEffect, useRef, useState } from "react"
import { Image as ImageIcon, Video, X, Globe, Users, Lock, FileText, BarChart3, Save } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { validateImageFiles, validateMediaFile } from "@/lib/media-validation"
import { compressImage } from "@/lib/ghc-data"
import { compressImageFile } from "@/lib/media/compress-image"
import { uploadDurableMedia, isMediaStorageUnavailable, mediaUploadErrorMessage } from "@/lib/media/upload-client"
import { getPostDraft, removePostDraft, upsertPostDraft } from "@/lib/creator/post-drafts"
import { mediaUserMessage, MEDIA_PROGRESS } from "@/lib/media/user-messages"
import { isDurableMediaUrl, isBlobUrl, isSmallDataUrl } from "@/lib/media/durable-url"
import { validatePulseVideo } from "@/lib/media/video-inspection"
import type { StoryItem } from "@/lib/ghc-types"
import { piLocalGet, piLocalSet, piLocalRemove } from "@/lib/pi-local-storage"

export type ComposeMode = "post" | "story"
export type Audience = "public" | "followers" | "mutuals" | "private"

/** Rotating contextual suggestions — fills empty vertical space with gentle prompts */
const COMPOSE_PROMPTS = [
  "Share something useful today",
  "💡 What's something you've learned recently?",
  "🎉 Celebrate a small win from this week",
  "🤝 Who inspired you lately?",
  "🌱 What's growing in your community?",
  "Ask a thoughtful question your network can answer",
  "Share an opportunity others might need",
] as const

function pickComposePrompt(): string {
  try {
    const i = Math.floor(Date.now() / (1000 * 60 * 30)) % COMPOSE_PROMPTS.length
    return COMPOSE_PROMPTS[i]
  } catch {
    return COMPOSE_PROMPTS[0]
  }
}


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
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null)
  const [storyMedia, setStoryMedia] = useState<StoryItem["media"]>(null)
  const [audience, setAudience] = useState<Audience>("public")
  const [showAudience, setShowAudience] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [storyMode, setStoryMode] = useState<"social" | "professional">("social")
  const [storyAudience, setStoryAudience] = useState<"everyone" | "followers" | "friends" | "private">("followers")
  const [isPublishing, setIsPublishing] = useState(false)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("")
  const [promptHint, setPromptHint] = useState(pickComposePrompt)


  const publishingRef = useRef(false)
  const activeDraftIdRef = useRef<string | null>(null)
  const pendingComposeRef = useRef<{ text?: string; draftId?: string } | null>(null)

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
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; body?: string }>).detail || {}
      const pre = String(d.text || d.body || "").trim()
      // A marketplace/chat prefill must not leak into a future unrelated post.
      if (open && pre) setText((current) => current.trim() ? current : pre)
    }
    const onOpenCompose = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; draftId?: string; mode?: string }>).detail || {}
      if (d.mode === "post" && (typeof d.draftId === "string" || typeof d.text === "string")) {
        pendingComposeRef.current = { text: d.text, draftId: d.draftId }
      }
    }
    window.addEventListener("ghc:compose-prefill", onPrefill)
    window.addEventListener("ghc:open-compose", onOpenCompose)
    return () => {
      window.removeEventListener("ghc:compose-prefill", onPrefill)
      window.removeEventListener("ghc:open-compose", onOpenCompose)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (initialMode === "story") {
      onOpenChange(false)
      window.dispatchEvent(new CustomEvent("ghc:open-story-creator"))
      return
    }
    setMode("post")
    const close = () => onOpenChange(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploadProgress && !isPublishing) close()
    }
    window.addEventListener("ghc:tab-change", close)
    window.addEventListener("ghc:close-compose", close)
    window.addEventListener("ghc:close-transient-ui", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("ghc:tab-change", close)
      window.removeEventListener("ghc:close-compose", close)
      window.removeEventListener("ghc:close-transient-ui", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, initialMode, onOpenChange, uploadProgress, isPublishing])

  useEffect(() => {
    if (open) {
      // Stories have a dedicated creator; this surface is always a post composer.
      setMode("post")
      if (initialMode === "post") {
        const pending = pendingComposeRef.current
        pendingComposeRef.current = null
        if (pending) {
          const saved = pending.draftId ? getPostDraft(pending.draftId) : null
          activeDraftIdRef.current = saved?.id || null
          setText(saved?.content ?? pending.text ?? "")
          setSelectedImages(saved?.images?.filter(isDurableMediaUrl) ?? [])
          setSelectedVideo(saved?.video && isDurableMediaUrl(saved.video) ? saved.video : null)
          if (saved) setAudience("public")
        } else {
          activeDraftIdRef.current = null
          void (async () => {
            try {
              const raw =
                (await piLocalGet("post-draft-v1")) ||
                (typeof window !== "undefined"
                  ? window.localStorage.getItem("ghc-post-draft-v1")
                  : null)
              if (raw) {
                const d = JSON.parse(raw) as { text?: string; audience?: Audience }
                if (d.text) setText(d.text)
                if (d.audience) setAudience(d.audience)
              }
            } catch {
              /* ignore */
            }
          })()
        }
      }
      setPromptHint(pickComposePrompt())
      const t = window.setTimeout(() => textareaRef.current?.focus(), 80)
      return () => window.clearTimeout(t)
    }
  }, [open, initialMode])

  // Autosave post draft — Pi local storage when available, else web localStorage
  // Never stores tokens, PIN, or payment secrets (safe key enforced by pi-local-storage)
  useEffect(() => {
    if (!open || mode !== "post") return
    if (!text.trim()) return
    const payload = JSON.stringify({ text, audience, at: Date.now() })
    const tId = window.setTimeout(() => {
      void piLocalSet("post-draft-v1", payload).catch(() => {
        try {
          window.localStorage.setItem("ghc-post-draft-v1", payload)
        } catch {
          /* */
        }
      })
    }, 400)
    return () => window.clearTimeout(tId)
  }, [text, audience, open, mode])

  if (!open) return null

  const close = () => {
    onOpenChange(false)
    setText("")
    setSelectedImages([])
    setSelectedVideo(null)
    setSelectedDoc(null)
    setSelectedDocName(null)
    setStoryMedia(null)
    setSelectedCommunityId("")
    setAudience("public")
    setShowAudience(false)
    setMode("post")
    activeDraftIdRef.current = null
  }

  const readFileAsDataUrl = (file: File, kind: "image" | "video" | "file") =>
    new Promise<string>((resolve, reject) => {
      try {
        if (kind !== "file") {
          validateMediaFile(file, kind)
        }
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
    setUploadProgress(MEDIA_PROGRESS.preparingPhoto)
    try {
      if (mode === "story") {
        const file = files[0]
        setUploadProgress(MEDIA_PROGRESS.compressing)
        const dataUrl = await compressImageFile(file, { purpose: "story", preferWebp: true }).catch(
          () => compressImage(file)
        )
        setUploadProgress(MEDIA_PROGRESS.uploading)
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const up = await uploadDurableMedia(blob, {
            fileName: file.name,
            onProgress: (label) => setUploadProgress(label),
          })
          if (up.ok && up.url && isDurableMediaUrl(up.url)) {
            setStoryMedia({ type: "image", url: up.url })
          } else {
            const offline = typeof navigator !== "undefined" && navigator.onLine === false
            const storageDown = !up.ok && isMediaStorageUnavailable(up.error)
            if ((offline || storageDown) && isSmallDataUrl(dataUrl, 1_800_000)) {
              setStoryMedia({ type: "image", url: dataUrl })
              addToast(
                storageDown
                  ? "Server photo storage is offline — moment kept on this device for now"
                  : "You're offline — photo saved on this device until you reconnect",
                "info"
              )
            } else {
              addToast(
                up.ok
                  ? mediaUserMessage("STORAGE_ERROR")
                  : mediaUploadErrorMessage(up),
                "error"
              )
              return
            }
          }
        } catch {
          const offline = typeof navigator !== "undefined" && navigator.onLine === false
          if (offline && isSmallDataUrl(dataUrl)) {
            setStoryMedia({ type: "image", url: dataUrl })
            addToast("You're offline — photo saved as a draft on this device until you reconnect", "info")
          } else {
            addToast(mediaUserMessage("NETWORK") + " — try again when connected", "error")
            return
          }
        }
        setSelectedImages([])
        setSelectedVideo(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Photo ready", "success")
      } else {
        const selectedFiles = Array.from(files)
        const validationError = validateImageFiles(selectedFiles)
        if (validationError) {
          addToast(validationError, "error")
          return
        }
        const images: string[] = []
        for (const file of selectedFiles) {
          setUploadProgress(MEDIA_PROGRESS.compressing)
          let dataUrl: string
          try {
            dataUrl = await compressImageFile(file, { purpose: "feed", preferWebp: true })
          } catch {
            addToast(mediaUserMessage("OPTIMIZE_FAILED"), "error")
            continue
          }
          setUploadProgress(MEDIA_PROGRESS.uploading)
          try {
            const blob = await (await fetch(dataUrl)).blob()
            const up = await uploadDurableMedia(blob, {
              fileName: file.name,
              onProgress: (label) => setUploadProgress(label),
            })
            if (up.ok && up.url && isDurableMediaUrl(up.url)) {
              images.push(up.url)
            } else if ((!up.ok && isMediaStorageUnavailable(up.error)) || (typeof navigator !== "undefined" && !navigator.onLine)) {
              if (isSmallDataUrl(dataUrl, 1_800_000)) {
                images.push(dataUrl)
                addToast("Photo kept on this device — server storage not available yet", "info")
              } else {
                addToast(mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR")), "error")
              }
            } else if (!up.ok) {
              addToast(mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR")), "error")
            } else {
              addToast(mediaUserMessage("STORAGE_ERROR"), "error")
            }
          } catch {
            addToast(mediaUserMessage("NETWORK") + " — photo not attached. Check connection and retry.", "error")
          }
        }
        if (images.length) {
          setSelectedImages((prev) => [...prev, ...images].slice(0, 10))
          setSelectedVideo(null)
          setStoryMedia(null)
          setUploadProgress(MEDIA_PROGRESS.ready)
          addToast(images.length === 1 ? "✓ Photo ready" : `✓ ${images.length} photos ready`, "success")
        }
      }
    } catch {
      addToast(mediaUserMessage("OPTIMIZE_FAILED", "Unable to add photo — try a smaller file"), "error")
    } finally {
      setUploadProgress(null)
    }
  }

  const handleDoc = async (file: File | undefined) => {
    if (!file || mode !== "post") return
    setUploadProgress(MEDIA_PROGRESS.preparingFile)
    try {
      if (file.size > 25 * 1024 * 1024) {
        addToast(mediaUserMessage("FILE_TOO_LARGE"), "error")
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        addToast(mediaUserMessage("MEDIA_DIRECT_UPLOAD_REQUIRED"), "error")
        return
      }
      setUploadProgress(MEDIA_PROGRESS.uploading)
      const up = await uploadDurableMedia(file, {
        fileName: file.name,
        category: "documents",
        onProgress: (label) => setUploadProgress(label),
      })
      if (up.ok && up.url && isDurableMediaUrl(up.url)) {
        setSelectedDoc(up.url)
        setSelectedDocName(file.name || "attachment")
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ File ready", "success")
        return
      }
      // Avoid large inline PDF payloads in post JSON
      if (file.size <= 400_000) {
        const url = await readFileAsDataUrl(file, "file")
        setSelectedDoc(url)
        setSelectedDocName(file.name || "attachment")
        addToast("File attached", "success")
      } else if (!up.ok) {
        addToast(mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR")), "error")
      }
    } catch {
      addToast(mediaUserMessage("NETWORK", "Unable to attach file"), "error")
    } finally {
      setUploadProgress(null)
    }
  }

  const handleVideo = async (file: File | undefined) => {
    if (!file) return
    const sizeMb = file.size / (1024 * 1024)
    try {
      validateMediaFile(file, "video")
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Choose a supported video file", "error")
      return
    }
    if (file.size > 40 * 1024 * 1024) {
      addToast("Video is too large (max 40 MB). Please choose a shorter clip.", "error")
      return
    }
    let videoMeta: { durationMs: number; width: number; height: number }
    try {
      videoMeta = await validatePulseVideo(file)
    } catch (error) {
      const code = error instanceof Error ? error.message : "VIDEO_METADATA_INVALID"
      const message = code === "PULSE_VIDEO_TOO_LONG"
        ? "GH Pulse videos can be up to 3 minutes."
        : code === "PULSE_VIDEO_DIMENSIONS_TOO_LARGE"
          ? "This video is too high-resolution. Please choose a video up to 3840px."
          : code === "VIDEO_METADATA_TIMEOUT"
            ? "Video metadata could not be read in time. Please try the clip again."
            : "This video could not be prepared for GreenHaven."
      addToast(message, "error")
      return
    }
    setUploadProgress(
      sizeMb > 8
        ? `${MEDIA_PROGRESS.preparingVideo} (${sizeMb.toFixed(0)} MB)`
        : MEDIA_PROGRESS.preparingVideo
    )
    try {
      setUploadProgress(MEDIA_PROGRESS.optimizingVideo)
      setUploadProgress(MEDIA_PROGRESS.uploading)
      const up = await uploadDurableMedia(file, {
        fileName: file.name,
        onProgress: (label) => setUploadProgress(label),
      })
      if (mode === "story") {
        if (up.ok && up.url) {
          setStoryMedia({ type: "video", url: up.url })
        } else {
          // Blob URLs are local to this browser session and must never be published as durable media.
          addToast(mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR")), "error")
          return
        }
        setSelectedImages([])
        setSelectedVideo(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Video ready for story", "success")
        return
      }
      if (up.ok && up.url && isDurableMediaUrl(up.url)) {
        setSelectedVideo(up.url)
        setStoryMedia(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Video ready", "success")
        return
      }
      // Never persist a blob: URL in a post; it cannot be fetched by other users or after reload.
      addToast(mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR")), "error")
    } catch {
      addToast(mediaUserMessage("OPTIMIZE_FAILED", "Unable to add video — try a shorter clip"), "error")
    } finally {
      setUploadProgress(null)
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
      ? Boolean(text.trim() || selectedImages.length > 0 || selectedVideo || selectedDoc)
      : Boolean(text.trim() || storyMedia)

  const handlePublish = async () => {
    if (publishingRef.current || isPublishing || !canPublish) return
    if (uploadProgress) {
      addToast("Wait for the media upload to finish before publishing", "info")
      return
    }
    publishingRef.current = true
    setIsPublishing(true)
    // Phase 2 — never publish blob: media
    const dirtyImages = selectedImages.filter((u) => !isDurableMediaUrl(u))
    if (dirtyImages.length) {
      addToast("Photos did not finish uploading to the server. Remove them, stay online, and re-attach. Tip: open /api/media/health while signed in if this keeps failing.", "error")
      publishingRef.current = false
      setIsPublishing(false)
      return
    }
    if (selectedVideo && !isDurableMediaUrl(selectedVideo)) {
      addToast("Video is not uploaded yet. Wait for Ready, or re-attach the video while online.", "error")
      publishingRef.current = false
      setIsPublishing(false)
      return
    }
    if (selectedDoc && !isDurableMediaUrl(selectedDoc)) {
      addToast("Attachment is not uploaded yet. Re-attach the file while online.", "error")
      publishingRef.current = false
      setIsPublishing(false)
      return
    }
    if (storyMedia?.url && isBlobUrl(storyMedia.url)) {
      addToast("Moment media still uploading — wait until Ready", "error")
      publishingRef.current = false
      setIsPublishing(false)
      return
    }
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
          selectedDoc,
          selectedDocName,
          audience,
          community,
        )
        if (created) {
          try { void piLocalRemove("post-draft-v1"); window.localStorage.removeItem("ghc-post-draft-v1") } catch { /* ignore */ }
          if (activeDraftIdRef.current) {
            removePostDraft(activeDraftIdRef.current)
            activeDraftIdRef.current = null
          }
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
        const storyResult = await publishStory(next)
        if (!storyResult?.ok) {
          addToast(storyResult?.error || "Could not publish story", "error")
          return
        }
        if (storyResult.durable) {
          addToast(
            `Story shared · ${storyAudience === "everyone" ? "Public" : storyAudience} · 24h`,
            "success"
          )
        } else {
          addToast(
            storyResult.error || "Story saved on this device — not published to server",
            "info"
          )
        }
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
      className="gh-world-compose fixed inset-0 z-[70] flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-compose-title"
    >
      {/* Top bar — full-screen New post */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/95 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button
          type="button"
          onClick={close}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Close"
          disabled={isPublishing || Boolean(uploadProgress)}
        >
          <X size={22} />
        </button>
        <h1 id="unified-compose-title" className="flex-1 text-center text-base font-bold text-foreground">
          {mode === "post" ? "New post" : "New story"}
        </h1>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish || isPublishing || Boolean(uploadProgress)}
          aria-busy={isPublishing || Boolean(uploadProgress)}
          className="min-h-9 rounded-full bg-[var(--gh-green)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          {isPublishing ? (mode === "post" ? "Posting…" : "Sharing…") : mode === "post" ? "Post" : "Share"}
        </button>
      </header>

      {/* This composer is intentionally post-only. Stories have their own camera-first creator. */}
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
              className="h-11 w-11 rounded-full object-cover ring-2 ring-emerald-100"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{profile.displayName || "You"}</p>
              {mode === "post" ? (
                <button
                  type="button"
                  onClick={() => setShowAudience((v) => !v)}
                  className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-foreground/90 transition hover:bg-muted/80"
                >
                  <AudienceIcon size={12} />
                  {audienceLabel}
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Visible for 24 hours</p>
              )}
            </div>
          </div>

          {showAudience && mode === "post" && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              {(
                [
                  { id: "public" as const, label: "Public", desc: "Anyone on GreenHaven", Icon: Globe },
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
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-emerald-50 ${
                    audience === opt.id ? "bg-emerald-50/80 dark:bg-emerald-950/30" : ""
                  }`}
                >
                  <opt.Icon size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                  <span>
                    <span className="block text-sm font-bold text-foreground">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}


          {mode === "post" && (text.trim() || selectedImages.length > 0 || selectedVideo || selectedDoc) && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Keep this as a draft</p>
                <p className="text-[11px] text-muted-foreground">Saved privately on this device until you publish.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const saved = upsertPostDraft({
                    id: activeDraftIdRef.current || undefined,
                    content: text,
                    images: selectedImages.filter(isDurableMediaUrl),
                    video: selectedVideo && isDurableMediaUrl(selectedVideo) ? selectedVideo : null,
                  })
                  activeDraftIdRef.current = saved.id
                  addToast("Draft saved on this device", "success")
                }}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted"
              >
                <Save size={14} aria-hidden /> Save draft
              </button>
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

          {mode === "post" && !text.trim() ? (
            <button
              type="button"
              onClick={() => {
                const next = pickComposePrompt()
                setPromptHint(next)
                setText((current) => current.trim() ? current : next)
                window.setTimeout(() => textareaRef.current?.focus(), 0)
              }}
              className="mb-2 flex w-full items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-left transition hover:bg-emerald-500/10"
            >
              <span className="text-[15px] leading-none" aria-hidden>
                💡
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-emerald-700/80">
                  Idea for you
                </span>
                <span className="mt-0.5 block text-[13px] font-medium leading-snug text-foreground/90">
                  {promptHint}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">Tap to start writing from this idea</span>
              </span>
            </button>
          ) : null}

          <textarea
            ref={textareaRef}
            aria-label="Post text"
            aria-describedby="post-character-count"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, mode === "story" ? 500 : 5000))}
            placeholder={mode === "post" ? "What's on your mind?" : "Share a moment…"}
            className="min-h-[110px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-foreground placeholder-gray-400 focus:outline-none"
            rows={5}
          />
          <p id="post-character-count" className="text-right text-[11px] text-muted-foreground">
            {text.length}/{mode === "story" ? 500 : 5000}
          </p>

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


          {mode === "story" && (
            <div className="mb-2 flex gap-1.5">
              <button type="button" onClick={() => setStoryMode("social")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${storyMode === "social" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Social</button>
              <button type="button" onClick={() => setStoryMode("professional")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${storyMode === "professional" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>Professional</button>
            </div>
          )}

          {uploadProgress && (
            <p className="mb-2 text-[11px] font-medium text-primary" role="status">{uploadProgress}</p>
          )}

          {/* Media previews */}
          {mode === "post" && selectedImages.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedImages.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <img src={src} alt={`Attached photo ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground/90">
              <span>Video attached</span>
              <button type="button" onClick={() => setSelectedVideo(null)} className="text-emerald-700">
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
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground/90">
              <span>Video ready for story</span>
              <button type="button" onClick={() => setStoryMedia(null)} className="text-emerald-700">
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tools — always visible like Facebook */}
      <footer className="shrink-0 border-t border-border/60 bg-card px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
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
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf"
          className="sr-only"
          onChange={(e) => {
            void handleDoc(e.target.files?.[0])
            e.currentTarget.value = ""
          }}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98]"
          >
            <ImageIcon size={18} aria-hidden /> Photo
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
              onClick={() => docInputRef.current?.click()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-50 text-sm font-bold text-sky-700 transition hover:bg-sky-100 active:scale-[0.98]"
            >
              <FileText size={18} aria-hidden /> File
            </button>
          )}
          {mode === "post" && (
            <button
              type="button"
              onClick={() => setShowAudience((v) => !v)}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-muted px-3 text-xs font-bold text-foreground/90 transition hover:bg-muted/80"
              aria-label="Choose post audience"
              title="Choose who can see this post"
            >
              <AudienceIcon size={16} />
            </button>
          )}
          {mode === "post" && (
            <button
              type="button"
              onClick={() => {
                close()
                window.dispatchEvent(new CustomEvent("ghc:open-poll"))
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-violet-50 px-3 text-xs font-bold text-violet-700 transition hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300"
              aria-label="Create a poll"
              title="Create a poll"
            >
              <BarChart3 size={16} aria-hidden />
            </button>
          )}
        </div>
        {mode === "post" && selectedDocName ? (
          <p className="mt-1.5 flex items-center justify-between rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800">
            <span className="truncate">📎 {selectedDocName}</span>
            <button type="button" className="font-bold" onClick={() => { setSelectedDoc(null); setSelectedDocName(null) }}>
              Remove
            </button>
          </p>
        ) : null}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {mode === "post"
            ? "Text, photos, video and files in one post · photos up to 25 MB · videos up to 40 MB"
            : "Stories disappear after 24 hours"}
        </p>
      </footer>
    </div>
  )
}
