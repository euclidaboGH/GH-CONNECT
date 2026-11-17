"use client"

import { DurableImage } from "./durable-image"
import { confirmDialog } from "@/lib/ui/global-interactions"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRegionalContext } from "@/contexts/regional-context"
import { getWorkflowMessage } from "@/lib/i18n/workflows"
import { Image as ImageIcon, Video, X, Globe, Users, Lock, FileText, BarChart3, Save } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { IdentityService } from "@/lib/identity/identity-service"
import { validateImageFiles, validateMediaFile } from "@/lib/media-validation"
import { compressImage } from "@/lib/ghc-data"
import { compressImageFile } from "@/lib/media/compress-image"
import { uploadDurableMedia, isMediaStorageUnavailable, mediaUploadErrorMessage } from "@/lib/media/upload-client"
import { getPostDraft, listPostDrafts, removePostDraft, upsertPostDraft } from "@/lib/creator/post-drafts"
import { mediaUserMessage, MEDIA_PROGRESS } from "@/lib/media/user-messages"
import { isDurableMediaUrl, isBlobUrl, isSmallDataUrl } from "@/lib/media/durable-url"
import { validatePulseVideo } from "@/lib/media/video-inspection"
import type { PostDraft, StoryItem } from "@/lib/ghc-types"
import { COMPOSE_LIMITS, textMaxForMode } from "@/lib/composer/compose-limits"
import { a11y } from "@/lib/accessibility"
import { prefersReducedMotion } from "@/lib/ui/prefers-reduced-motion"
import { ComposeMediaStrip, ComposeUploadProgress, ComposeDraftBanner } from "./compose-media-strip"
import { MediaLightbox } from "./media-lightbox"
import { DurableVideo } from "./durable-video"

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

function stableComposeSignature(value: unknown): string {
  const serialized = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `v1_${(hash >>> 0).toString(36)}_${serialized.length.toString(36)}`
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
  const regional = useRegionalContext()
  const t = (key: Parameters<typeof getWorkflowMessage>[0]) => getWorkflowMessage(key, regional.locale)
  const [mode, setMode] = useState<ComposeMode>(initialMode)
  const [text, setText] = useState("")
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null)
  const [storyMedia, setStoryMedia] = useState<StoryItem["media"]>(null)
  const [storyPreviewOpen, setStoryPreviewOpen] = useState(false)
  const [audience, setAudience] = useState<Audience>("public")
  const [showAudience, setShowAudience] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [storyMode, setStoryMode] = useState<"social" | "professional">("social")
  const [storyAudience, setStoryAudience] = useState<"everyone" | "followers" | "friends" | "private">("followers")
  const [isPublishing, setIsPublishing] = useState(false)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("")
  const [promptHint, setPromptHint] = useState(pickComposePrompt)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [savedDrafts, setSavedDrafts] = useState<PostDraft[]>([])
  const [showSavedDrafts, setShowSavedDrafts] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [failedAttachments, setFailedAttachments] = useState<Array<{ id: string; kind: "photo" | "video" | "file"; file: File; message: string }>>([])


  const publishingRef = useRef(false)
  const handlePublishRef = useRef<(() => void) | null>(null)
  const composeOwnerRef = useRef(IdentityService.getCurrentUserId())
  const composeGenerationRef = useRef(0)
  const activeUploadControllerRef = useRef<AbortController | null>(null)

  const rememberFailedAttachment = (file: File, kind: "photo" | "video" | "file", message: string) => {
    const id = `${kind}:${file.name}:${file.size}:${file.lastModified}`
    setFailedAttachments((previous) => {
      const withoutDuplicate = previous.filter((item) => item.id !== id)
      return [...withoutDuplicate, { id, kind, file, message }].slice(-8)
    })
  }

  const clearFailedAttachment = (file: File) => {
    const suffix = `:${file.name}:${file.size}:${file.lastModified}`
    setFailedAttachments((previous) => previous.filter((item) => !item.id.endsWith(suffix)))
  }

  const retryFailedAttachment = (attachment: { id: string; kind: "photo" | "video" | "file"; file: File }) => {
    setFailedAttachments((previous) => previous.filter((item) => item.id !== attachment.id))
    if (attachment.kind === "photo") {
      const transfer = new DataTransfer()
      transfer.items.add(attachment.file)
      void handleImages(transfer.files)
    } else if (attachment.kind === "video") {
      void handleVideo(attachment.file)
    } else {
      void handleDoc(attachment.file)
    }
  }

  const beginUpload = () => {
    activeUploadControllerRef.current?.abort()
    const controller = new AbortController()
    activeUploadControllerRef.current = controller
    return controller
  }

  // Drafts are account-scoped. If the authenticated account changes while the
  // composer is open (including during upload/publish), clear transient state
  // rather than showing one account's private draft/media to another account.
  useEffect(() => IdentityService.subscribe((identity) => {
    const nextOwner = String(identity.userId || "current-user")
    if (nextOwner === composeOwnerRef.current) return
    composeOwnerRef.current = nextOwner
    composeGenerationRef.current += 1
    activeUploadControllerRef.current?.abort()
    activeUploadControllerRef.current = null
    publishingRef.current = false
    postRequestRef.current = null
    storyRequestRef.current = null
    activeDraftIdRef.current = null
    pendingComposeRef.current = null
    setText("")
    setSelectedImages([])
    setSelectedVideo(null)
    setSelectedDoc(null)
    setSelectedDocName(null)
    setStoryMedia(null)
    setStoryPreviewOpen(false)
    setDraftRestored(false)
    setLastSavedAt(null)
    setSavedDrafts([])
    setShowSavedDrafts(false)
    setFailedAttachments([])
    setSelectedCommunityId("")
    setAudience("public")
    setShowAudience(false)
    setUploadProgress(null)
    setIsPublishing(false)
    setFailedAttachments([])
    setMode("post")
    onOpenChange(false)
    addToast("Composer closed because the active account changed. Reopen it to continue safely.", "info")
  }), [addToast, onOpenChange])
  useEffect(() => {
    const sync = () => setIsOffline(typeof navigator !== "undefined" && navigator.onLine === false)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])


  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const root = document.querySelector(".gh-world-compose") as HTMLElement | null
    if (!root) return
    const release = a11y.createFocusTrap(root)
    return () => release()
  }, [open])

  const activeDraftIdRef = useRef<string | null>(null)
  const postRequestRef = useRef<{ id: string; signature: string } | null>(null)
  const storyRequestRef = useRef<{ id: string; signature: string } | null>(null)
  const closeRef = useRef<() => void>(() => undefined)
  const pendingComposeRef = useRef<{ text?: string; draftId?: string } | null>(null)

  const communityOptions = useMemo(
    () => (conversations || [])
      .filter((c) => {
        const community = c as typeof c & { isCommunity?: boolean; kind?: string; communityId?: string }
        return community.isCommunity === true || community.kind === "community" || Boolean(community.communityId)
      })
      .map((c) => ({
        id: c.id,
        name: c.groupName || c.participantName || "Community",
      })),
    [conversations],
  )

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
    const closeComposer = () => closeRef.current()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploadProgress && !isPublishing) {
        closeComposer()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !uploadProgress && !isPublishing) {
        e.preventDefault()
        void handlePublishRef.current?.()
      }
    }
    window.addEventListener("ghc:tab-change", closeComposer)
    window.addEventListener("ghc:close-compose", closeComposer)
    window.addEventListener("ghc:close-transient-ui", closeComposer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("ghc:tab-change", closeComposer)
      window.removeEventListener("ghc:close-compose", closeComposer)
      window.removeEventListener("ghc:close-transient-ui", closeComposer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, initialMode, onOpenChange, uploadProgress, isPublishing])

  useEffect(() => {
    if (!open) return
    const dirty = Boolean(text.trim() || selectedImages.length || selectedVideo || selectedDoc)
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [open, text, selectedImages.length, selectedVideo, selectedDoc])

  useEffect(() => {
    if (open) {
      // Stories have a dedicated creator; this surface is always a post composer.
      setMode("post")
      if (initialMode === "post") {
        const pending = pendingComposeRef.current
        pendingComposeRef.current = null
        const saved = pending?.draftId
          ? getPostDraft(pending.draftId)
          : listPostDrafts()[0] || null
        activeDraftIdRef.current = saved?.id || null
        setText(saved?.content ?? pending?.text ?? "")
        setSelectedImages(saved?.images?.filter(isDurableMediaUrl) ?? [])
        setSelectedVideo(saved?.video && isDurableMediaUrl(saved.video) ? saved.video : null)
        setSelectedDoc(saved?.pdf && isDurableMediaUrl(saved.pdf) ? saved.pdf : null)
        setSelectedDocName(saved?.pdfName || null)
        setAudience(saved?.visibility || "public")
        setSelectedCommunityId(saved?.communityId || "")
        setDraftRestored(Boolean(saved))
        setLastSavedAt(saved?.lastEditedAt || null)
        setSavedDrafts(listPostDrafts())
        setShowSavedDrafts(false)
        postRequestRef.current = saved?.publishRequestId && saved?.publishRequestSignature
          ? { id: saved.publishRequestId, signature: saved.publishRequestSignature }
          : null
      setPromptHint(pickComposePrompt())
      const t = window.setTimeout(() => textareaRef.current?.focus(), 80)
      return () => window.clearTimeout(t)
      }
    }
  }, [open, initialMode])

  useEffect(() => {
    if (!open) return
    const refreshDrafts = () => setSavedDrafts(listPostDrafts())
    window.addEventListener("ghc:post-drafts-changed", refreshDrafts)
    refreshDrafts()
    return () => window.removeEventListener("ghc:post-drafts-changed", refreshDrafts)
  }, [open])

  // Complete drafts are stored under the current authenticated identity key.
  // Never use the legacy unscoped key: it can leak draft content across accounts.
  useEffect(() => {
    if (!open || mode !== "post") return
    const dirty = Boolean(text.trim() || selectedImages.length || selectedVideo || selectedDoc)
    if (!dirty) return
    const tId = window.setTimeout(() => {
      const saved = upsertPostDraft({
        id: activeDraftIdRef.current || undefined,
        content: text,
        images: selectedImages.filter(isDurableMediaUrl),
        video: selectedVideo && isDurableMediaUrl(selectedVideo) ? selectedVideo : null,
        pdf: selectedDoc && isDurableMediaUrl(selectedDoc) ? selectedDoc : null,
        pdfName: selectedDocName,
        visibility: audience,
        communityId: selectedCommunityId || null,
        communityName: communityOptions.find((item) => item.id === selectedCommunityId)?.name || null,
        publishRequestId: postRequestRef.current?.id || null,
        publishRequestSignature: postRequestRef.current?.signature || null,
      })
      activeDraftIdRef.current = saved.id
      setLastSavedAt(saved.lastEditedAt)
      setSavedDrafts(listPostDrafts())
    }, COMPOSE_LIMITS.autosaveMs)
    return () => window.clearTimeout(tId)
  }, [text, selectedImages, selectedVideo, selectedDoc, selectedDocName, audience, selectedCommunityId, communityOptions, open, mode])

  if (!open) return null

  const close = (options: { saveDraft?: boolean } = {}) => {
    activeUploadControllerRef.current?.abort()
    activeUploadControllerRef.current = null
    composeGenerationRef.current += 1
    const dirty = Boolean(text.trim() || selectedImages.length || selectedVideo || selectedDoc)
    if (options.saveDraft !== false && dirty) {
      const saved = upsertPostDraft({
        id: activeDraftIdRef.current || undefined,
        content: text,
        images: selectedImages.filter(isDurableMediaUrl),
        video: selectedVideo && isDurableMediaUrl(selectedVideo) ? selectedVideo : null,
        pdf: selectedDoc && isDurableMediaUrl(selectedDoc) ? selectedDoc : null,
        pdfName: selectedDocName,
        visibility: audience,
        communityId: selectedCommunityId || null,
        communityName: communityOptions.find((item) => item.id === selectedCommunityId)?.name || null,
        publishRequestId: postRequestRef.current?.id || null,
        publishRequestSignature: postRequestRef.current?.signature || null,
      })
      activeDraftIdRef.current = saved.id
      setSavedDrafts(listPostDrafts())
    }
    onOpenChange(false)
    setText("")
    setSelectedImages([])
    setSelectedVideo(null)
    setSelectedDoc(null)
    setSelectedDocName(null)
    setStoryMedia(null)
    setDraftRestored(false)
    setLastSavedAt(null)
    setSelectedCommunityId("")
    setAudience("public")
    setShowAudience(false)
    setMode("post")
    activeDraftIdRef.current = null
    postRequestRef.current = null
  }
  closeRef.current = () => close()



  const handleImages = async (files: FileList | null) => {
    if (!files?.length) return
    const generation = composeGenerationRef.current
    const controller = beginUpload()
    const expectedUserId = composeOwnerRef.current
    if (mode === "post" && selectedImages.length >= COMPOSE_LIMITS.maxImagesPerPost) {
      addToast(`You can attach up to ${COMPOSE_LIMITS.maxImagesPerPost} photos per post`, "info")
      return
    }
    setUploadProgress(MEDIA_PROGRESS.preparingPhoto)
    try {
      if (mode === "story") {
        const file = files[0]
        setUploadProgress(MEDIA_PROGRESS.compressing)
        const dataUrl = await compressImageFile(file, { purpose: "story", preferWebp: true }).catch(
          () => compressImage(file)
        )
        if (generation !== composeGenerationRef.current || controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId) return
        setUploadProgress(MEDIA_PROGRESS.uploading)
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const up = await uploadDurableMedia(blob, {
            fileName: file.name,
            onProgress: (label) => { if (generation === composeGenerationRef.current) setUploadProgress(label) },
            signal: controller.signal,
            expectedUserId,
          })
          if (generation !== composeGenerationRef.current) return
          if (up.ok && up.url && isDurableMediaUrl(up.url)) {
            clearFailedAttachment(file)
            setStoryMedia({ type: "image", url: up.url })
          } else {
            const offline = typeof navigator !== "undefined" && navigator.onLine === false
            const storageDown = !up.ok && isMediaStorageUnavailable(up.error)
            if ((offline || storageDown) && isSmallDataUrl(dataUrl, 1_800_000)) {
              setStoryMedia({ type: "image", url: dataUrl })
              rememberFailedAttachment(file, "photo", "Local story preview only — retry upload before publishing.")
              addToast(
                storageDown
                  ? "Server photo storage is offline — moment kept on this device for now"
                  : "You're offline — photo saved on this device until you reconnect",
                "info"
              )
            } else {
              const message = up.ok ? mediaUserMessage("STORAGE_ERROR") : mediaUploadErrorMessage(up)
              rememberFailedAttachment(file, "photo", message)
              addToast(message, "error")
              return
            }
          }
        } catch {
          if (generation !== composeGenerationRef.current || controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId) return
          const offline = typeof navigator !== "undefined" && navigator.onLine === false
          if (offline && isSmallDataUrl(dataUrl)) {
            setStoryMedia({ type: "image", url: dataUrl })
            rememberFailedAttachment(file, "photo", "Local story preview only — retry upload before publishing.")
            addToast("You're offline — photo saved as a draft on this device until you reconnect", "info")
          } else {
            const message = mediaUserMessage("NETWORK") + " — try again when connected"
            rememberFailedAttachment(file, "photo", message)
            addToast(message, "error")
            return
          }
        }
        setSelectedImages([])
        setSelectedVideo(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Photo ready", "success")
      } else {
        const selectedFiles = Array.from(files).slice(0, Math.max(0, COMPOSE_LIMITS.maxImagesPerPost - selectedImages.length))
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
            const message = mediaUserMessage("OPTIMIZE_FAILED")
            rememberFailedAttachment(file, "photo", message)
            addToast(message, "error")
            continue
          }
          if (generation !== composeGenerationRef.current || controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId) return
          setUploadProgress(MEDIA_PROGRESS.uploading)
          try {
            const blob = await (await fetch(dataUrl)).blob()
            const up = await uploadDurableMedia(blob, {
              fileName: file.name,
              onProgress: (label) => { if (generation === composeGenerationRef.current) setUploadProgress(label) },
              signal: controller.signal,
              expectedUserId,
            })
            if (generation !== composeGenerationRef.current) return
            if (up.ok && up.url && isDurableMediaUrl(up.url)) {
              clearFailedAttachment(file)
              images.push(up.url)
            } else if ((!up.ok && isMediaStorageUnavailable(up.error)) || (typeof navigator !== "undefined" && !navigator.onLine)) {
              // Feed posts require durable server media. Do not place a data URL
              // into the post attachment list: it cannot be shared or restored safely.
              const message = isSmallDataUrl(dataUrl, 1_800_000)
                ? "Photo was not attached because server storage is unavailable. Your text draft is safe; reconnect and retry this attachment."
                : mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR"))
              rememberFailedAttachment(file, "photo", message)
              addToast(message, "error")
            } else if (!up.ok) {
              const message = mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR"))
              rememberFailedAttachment(file, "photo", message)
              addToast(message, "error")
            } else {
              const message = mediaUserMessage("STORAGE_ERROR")
              rememberFailedAttachment(file, "photo", message)
              addToast(message, "error")
            }
          } catch {
            const message = mediaUserMessage("NETWORK") + " — photo not attached. Check connection and retry."
            rememberFailedAttachment(file, "photo", message)
            addToast(message, "error")
          }
        }
        if (generation !== composeGenerationRef.current) return
        if (images.length) {
          setSelectedImages((prev) => [...prev, ...images].slice(0, 10))
          setSelectedVideo(null)
          setStoryMedia(null)
          setUploadProgress(MEDIA_PROGRESS.ready)
          addToast(images.length === 1 ? "✓ Photo ready" : `✓ ${images.length} photos ready`, "success")
        }
      }
    } catch {
      if (generation === composeGenerationRef.current && !controller.signal.aborted) addToast(mediaUserMessage("OPTIMIZE_FAILED", "Unable to add photo — try a smaller file"), "error")
    } finally {
      const ownsUploadSlot = activeUploadControllerRef.current === controller
      if (ownsUploadSlot) activeUploadControllerRef.current = null
      if (ownsUploadSlot && generation === composeGenerationRef.current) setUploadProgress(null)
    }
  }

  const handleDoc = async (file: File | undefined) => {
    if (!file || mode !== "post") return
    const generation = composeGenerationRef.current
    const controller = beginUpload()
    const expectedUserId = composeOwnerRef.current
    setUploadProgress(MEDIA_PROGRESS.preparingFile)
    try {
      if (file.size > 50 * 1024 * 1024) {
        addToast(mediaUserMessage("FILE_TOO_LARGE"), "error")
        return
      }
      setUploadProgress(MEDIA_PROGRESS.uploading)
      const up = await uploadDurableMedia(file, {
        fileName: file.name,
        category: "documents",
        onProgress: (label) => { if (generation === composeGenerationRef.current) setUploadProgress(label) },
        signal: controller.signal,
        expectedUserId,
      })
      if (generation !== composeGenerationRef.current) return
      if (up.ok && up.url && isDurableMediaUrl(up.url)) {
        clearFailedAttachment(file)
        setSelectedDoc(up.url)
        setSelectedDocName(file.name || "attachment")
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ File ready", "success")
        return
      }
      // A local data URL cannot be delivered durably to other users. Never
      // show an attachment as ready unless the server has finalized its asset.
      const message = mediaUploadErrorMessage(up, "File upload could not be completed. Reconnect and retry.")
      rememberFailedAttachment(file, "file", message)
      addToast(message, "error")
    } catch {
      if (generation === composeGenerationRef.current && !controller.signal.aborted) {
        const message = mediaUserMessage("NETWORK", "Unable to attach file")
        rememberFailedAttachment(file, "file", message)
        addToast(message, "error")
      }
    } finally {
      const ownsUploadSlot = activeUploadControllerRef.current === controller
      if (ownsUploadSlot) activeUploadControllerRef.current = null
      if (ownsUploadSlot && generation === composeGenerationRef.current) setUploadProgress(null)
    }
  }

  const handleVideo = async (file: File | undefined) => {
    if (!file) return
    const generation = composeGenerationRef.current
    const controller = beginUpload()
    const expectedUserId = composeOwnerRef.current
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
      if (generation !== composeGenerationRef.current || controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId) return
    } catch (error) {
      const code = error instanceof Error ? error.message : "VIDEO_METADATA_INVALID"
      const message = code === "PULSE_VIDEO_TOO_LONG"
        ? "GH Pulse videos can be up to 3 minutes."
        : code === "PULSE_VIDEO_DIMENSIONS_TOO_LARGE"
          ? "This video is too high-resolution. Please choose a video up to 3840px."
          : code === "VIDEO_METADATA_TIMEOUT"
            ? "Video metadata could not be read in time. Please try the clip again."
            : "This video could not be prepared for GreenHaven."
      if (code === "VIDEO_METADATA_TIMEOUT") rememberFailedAttachment(file, "video", message)
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
        onProgress: (label) => { if (generation === composeGenerationRef.current) setUploadProgress(label) },
        signal: controller.signal,
        expectedUserId,
      })
      if (generation !== composeGenerationRef.current) return
      if (mode === "story") {
        if (up.ok && up.url && isDurableMediaUrl(up.url)) {
          clearFailedAttachment(file)
          setStoryMedia({ type: "video", url: up.url })
        } else {
          // Blob URLs are local to this browser session and must never be published as durable media.
          const message = mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR"))
          rememberFailedAttachment(file, "video", message)
          addToast(message, "error")
          return
        }
        setSelectedImages([])
        setSelectedVideo(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Video ready for story", "success")
        return
      }
      if (up.ok && up.url && isDurableMediaUrl(up.url)) {
        clearFailedAttachment(file)
        setSelectedVideo(up.url)
        setStoryMedia(null)
        setUploadProgress(MEDIA_PROGRESS.ready)
        addToast("✓ Video ready", "success")
        return
      }
      // Never persist a blob: URL in a post; it cannot be fetched by other users or after reload.
      const message = mediaUploadErrorMessage(up, mediaUserMessage("STORAGE_ERROR"))
      rememberFailedAttachment(file, "video", message)
      addToast(message, "error")
    } catch {
      if (generation === composeGenerationRef.current && !controller.signal.aborted) {
        const message = mediaUserMessage("NETWORK", "Upload interrupted. Retry this video without restarting your post.")
        rememberFailedAttachment(file, "video", message)
        addToast(message, "error")
      }
    } finally {
      const ownsUploadSlot = activeUploadControllerRef.current === controller
      if (ownsUploadSlot) activeUploadControllerRef.current = null
      if (ownsUploadSlot && generation === composeGenerationRef.current) setUploadProgress(null)
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
    const generation = composeGenerationRef.current
    publishingRef.current = true
    setIsPublishing(true)
    try { a11y.announce(mode === "post" ? "Publishing post" : "Sharing story", "polite") } catch { /* */ }
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
    if (storyMedia?.url && !isDurableMediaUrl(storyMedia.url)) {
      addToast(
        "This story photo is only a local preview and has not reached GreenHaven storage. Reconnect and re-attach it before publishing.",
        "error",
      )
      publishingRef.current = false
      setIsPublishing(false)
      return
    }
    try {
      const requestSignature = stableComposeSignature({
        content: text.trim(), images: selectedImages, video: selectedVideo, pdf: selectedDoc,
        visibility: audience, communityId: selectedCommunityId || null,
      })
      if (postRequestRef.current && postRequestRef.current.signature !== requestSignature) {
        postRequestRef.current = null
      }
      const requestId = postRequestRef.current?.id || (() => {
        const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "")
          : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
        return `post_${Date.now().toString(36)}_${randomPart}`
      })()
      postRequestRef.current = { id: requestId, signature: requestSignature }
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
          requestId,
        )
        if (generation !== composeGenerationRef.current) return
        if (created) {
          if (activeDraftIdRef.current) {
            removePostDraft(activeDraftIdRef.current)
            activeDraftIdRef.current = null
          }
          postRequestRef.current = null
          close({ saveDraft: false })
        }
      } else {
        const now = Date.now()
        const storySignature = stableComposeSignature({ text: text.trim(), media: storyMedia, audience: storyAudience, storyMode })
        if (storyRequestRef.current && storyRequestRef.current.signature !== storySignature) storyRequestRef.current = null
        if (!storyRequestRef.current) {
          const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID().replace(/-/g, "")
            : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
          storyRequestRef.current = { id: `story_${randomPart}`, signature: storySignature }
        }
        const next: StoryItem = {
          id: storyRequestRef.current.id,
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
        if (generation !== composeGenerationRef.current) return
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
        storyRequestRef.current = null
        close()
      }
    } catch {
      addToast(mode === "post" ? "Failed to create post" : "Could not publish story", "error")
    } finally {
      if (generation === composeGenerationRef.current) {
        publishingRef.current = false
        setIsPublishing(false)
      }
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


  handlePublishRef.current = () => {
    void handlePublish()
  }

  return (
    <div
      className={`gh-world-compose fixed inset-0 z-[70] flex flex-col bg-background text-foreground ${prefersReducedMotion() ? "" : "animate-in fade-in duration-200"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-compose-title"
    >
      {/* Top bar — full-screen New post */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/95 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button
          type="button"
          onClick={async () => {
              const dirty = Boolean(text.trim() || selectedImages.length || selectedVideo || selectedDoc)
              if (dirty && !(await confirmDialog({ title: "Close composer?", message: "Your draft is saved privately to this account on this device. You can continue editing it later.", confirmLabel: "Close composer" }))) return
              close()
            }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Close"
          disabled={isPublishing || Boolean(uploadProgress)}
        >
          <X size={22} />
        </button>
        <h1 id="unified-compose-title" className="flex-1 text-center text-[17px] font-extrabold tracking-tight text-foreground">
          {mode === "post" ? t("composeTitle") : t("newStory")}
        </h1>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish || isPublishing || Boolean(uploadProgress)}
          aria-busy={isPublishing || Boolean(uploadProgress)}
          className="min-h-9 rounded-full bg-[var(--gh-green)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          {isPublishing ? (mode === "post" ? t("posting") : t("sharing")) : mode === "post" ? t("publish") : t("share")}
        </button>
      </header>

      {isOffline ? (
        <div
          className="shrink-0 border-b border-amber-200/80 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {t("composeOffline")}
        </div>
      ) : null}

      {/* This composer is intentionally post-only. Stories have their own camera-first creator. */}
      {/* Scrollable body — long-form first-class */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

        {/* Optional community board target */}
        {mode === "post" && communityOptions.length > 0 && (
          <div className="px-3 pb-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("communityBoard")}
            </label>
            <select
              value={selectedCommunityId}
              onChange={(e) => setSelectedCommunityId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground"
              aria-label="Post to community"
            >
              <option value="">{t("personalFeed")}</option>
              {communityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCommunityId ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("alsoCommunity")}
              </p>
            ) : null}
          </div>
        )}

        <div className="px-4 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <DurableImage
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
                    pdf: selectedDoc && isDurableMediaUrl(selectedDoc) ? selectedDoc : null,
                    pdfName: selectedDocName,
                    visibility: audience,
                    communityId: selectedCommunityId || null,
                    communityName: communityOptions.find((item) => item.id === selectedCommunityId)?.name || null,
                    publishRequestId: postRequestRef.current?.id || null,
                    publishRequestSignature: postRequestRef.current?.signature || null,
                  })
                  activeDraftIdRef.current = saved.id
                  setSavedDrafts(listPostDrafts())
                  setLastSavedAt(saved.lastEditedAt)
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
            onChange={(e) => setText(e.target.value.slice(0, textMaxForMode(mode)))}
            placeholder={mode === "post" ? "What's on your mind?" : "Share a moment…"}
            className="min-h-[110px] max-h-[45vh] w-full resize-y bg-transparent text-[17px] leading-relaxed text-foreground placeholder-gray-400 focus:outline-none"
            onPaste={(e) => {
              if (mode !== "post" || isPublishing) return
              const items = e.clipboardData?.items
              if (!items) return
              const files: File[] = []
              for (let i = 0; i < items.length; i++) {
                const it = items[i]
                if (it.type.startsWith("image/")) {
                  const f = it.getAsFile()
                  if (f) files.push(f)
                }
              }
              if (files.length) {
                e.preventDefault()
                const dt = new DataTransfer()
                files.slice(0, COMPOSE_LIMITS.maxImagesPerPost - selectedImages.length).forEach((f) => dt.items.add(f))
                if (dt.files.length) void handleImages(dt.files)
              }
            }}
            rows={5}
          />
          <p id="post-character-count" className="text-right text-[11px] text-muted-foreground">
            {text.length}/{textMaxForMode(mode)}{textMaxForMode(mode) - text.length <= COMPOSE_LIMITS.textWarnRemaining && text.length > 0 ? (
              <span className="ml-2 font-semibold text-amber-600">· almost at limit</span>
            ) : null}
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

          {mode === "post" && lastSavedAt ? (
            <p className="mb-2 text-right text-[10px] font-medium text-muted-foreground" role="status" aria-live="polite">
              Draft saved {Math.max(0, Math.floor((Date.now() - lastSavedAt) / 60_000)) === 0 ? "just now" : `${Math.max(1, Math.floor((Date.now() - lastSavedAt) / 60_000))} min ago`}
            </p>
          ) : null}
          {mode === "post" && savedDrafts.length > 1 ? (
            <div className="mb-2 rounded-xl border border-border/70 bg-card/80 p-2.5">
              <button
                type="button"
                aria-expanded={showSavedDrafts}
                onClick={() => setShowSavedDrafts((value) => !value)}
                className="flex min-h-9 w-full items-center justify-between gap-2 text-left text-xs font-bold text-foreground"
              >
                <span>Saved drafts ({savedDrafts.length})</span>
                <span className="text-muted-foreground">{showSavedDrafts ? "Hide" : "Browse drafts"}</span>
              </button>
              {showSavedDrafts ? (
                <div className="mt-2 space-y-2" aria-label="Saved drafts on this device">
                  {savedDrafts.slice(0, 20).map((draft) => {
                    const isCurrent = draft.id === activeDraftIdRef.current
                    const preview = draft.content.trim().replace(/\s+/g, " ") || (draft.images.length ? "Photo draft" : draft.video ? "Video draft" : draft.pdfName || "Untitled draft")
                    return (
                      <div key={draft.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
                        <button
                          type="button"
                          disabled={isCurrent || isPublishing || Boolean(uploadProgress)}
                          onClick={() => {
                            if (isCurrent) return
                            const dirty = Boolean(text.trim() || selectedImages.length || selectedVideo || selectedDoc)
                            if (dirty) {
                              const current = upsertPostDraft({
                                id: activeDraftIdRef.current || undefined,
                                content: text,
                                images: selectedImages.filter(isDurableMediaUrl),
                                video: selectedVideo && isDurableMediaUrl(selectedVideo) ? selectedVideo : null,
                                pdf: selectedDoc && isDurableMediaUrl(selectedDoc) ? selectedDoc : null,
                                pdfName: selectedDocName,
                                visibility: audience,
                                communityId: selectedCommunityId || null,
                                communityName: communityOptions.find((item) => item.id === selectedCommunityId)?.name || null,
                                publishRequestId: postRequestRef.current?.id || null,
                                publishRequestSignature: postRequestRef.current?.signature || null,
                              })
                              activeDraftIdRef.current = current.id
                            }
                            const restored = getPostDraft(draft.id)
                            if (!restored) {
                              setSavedDrafts(listPostDrafts())
                              addToast("That draft is no longer available. Refreshing the list.", "info")
                              return
                            }
                            activeDraftIdRef.current = restored.id
                            setText(restored.content)
                            setSelectedImages(restored.images.filter(isDurableMediaUrl))
                            setSelectedVideo(restored.video && isDurableMediaUrl(restored.video) ? restored.video : null)
                            setSelectedDoc(restored.pdf && isDurableMediaUrl(restored.pdf) ? restored.pdf : null)
                            setSelectedDocName(restored.pdfName || null)
                            setAudience(restored.visibility || "public")
                            setSelectedCommunityId(restored.communityId || "")
                            setLastSavedAt(restored.lastEditedAt)
                            setDraftRestored(true)
                            postRequestRef.current = restored.publishRequestId && restored.publishRequestSignature
                              ? { id: restored.publishRequestId, signature: restored.publishRequestSignature }
                              : null
                            setShowSavedDrafts(false)
                            addToast("Draft restored", "success")
                          }}
                          className="min-w-0 flex-1 text-left disabled:opacity-60"
                        >
                          <span className="block truncate text-xs font-semibold text-foreground">{preview.slice(0, 100)}</span>
                          <span className="block text-[10px] text-muted-foreground">{new Date(draft.lastEditedAt).toLocaleString()} · {draft.visibility || "public"}{isCurrent ? " · Currently editing" : ""}</span>
                        </button>
                        {!isCurrent ? (
                          <button
                            type="button"
                            aria-label="Delete saved draft"
                            disabled={isPublishing || Boolean(uploadProgress)}
                            onClick={() => {
                              removePostDraft(draft.id)
                              setSavedDrafts(listPostDrafts())
                              addToast("Draft deleted from this device", "info")
                            }}
                            className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-500/10 disabled:opacity-50"
                          >Delete</button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <ComposeDraftBanner
            visible={draftRestored && mode === "post"}
            onDiscard={() => {
              setText("")
              setSelectedImages([])
              setSelectedVideo(null)
              setSelectedDoc(null)
              setSelectedDocName(null)
              setSelectedCommunityId("")
              setAudience("public")
              setDraftRestored(false)
              setLastSavedAt(null)
              postRequestRef.current = null
              if (activeDraftIdRef.current) {
                try { removePostDraft(activeDraftIdRef.current) } catch { /* */ }
                activeDraftIdRef.current = null
              }
            }}
          />
          {failedAttachments.length > 0 && (
            <section className="mb-3 space-y-2 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/30" aria-label="Attachments needing recovery">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-950 dark:text-amber-100">{failedAttachments.length} attachment{failedAttachments.length === 1 ? "" : "s"} need attention</p>
                <button type="button" className="text-xs font-semibold underline" onClick={() => setFailedAttachments([])}>Dismiss</button>
              </div>
              {failedAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-background/80 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{item.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.message}</p>
                  </div>
                  <button type="button" disabled={Boolean(uploadProgress) || isPublishing} className="min-h-9 shrink-0 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50" onClick={() => retryFailedAttachment(item)}>Retry</button>
                  <button type="button" aria-label={`Forget ${item.file.name}`} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-rose-700" onClick={() => setFailedAttachments((items) => items.filter((candidate) => candidate.id !== item.id))}>Remove</button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">Your text and other ready attachments stay in place. Retry uses the selected file from this session.</p>
            </section>
          )}
          <ComposeUploadProgress message={uploadProgress} />
          {mode === "post" ? (
            <ComposeMediaStrip
              images={selectedImages}
              video={selectedVideo}
              maxImages={COMPOSE_LIMITS.maxImagesPerPost}
              onRemoveImage={(i) => setSelectedImages((imgs) => imgs.filter((_, idx) => idx !== i))}
              onClearImages={() => setSelectedImages([])}
              onRemoveVideo={() => setSelectedVideo(null)}
            />
          ) : null}
          {mode === "story" && storyMedia?.type === "image" && (
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-black/5">
              <button type="button" onClick={() => setStoryPreviewOpen(true)} className="block w-full cursor-zoom-in" aria-label="Preview story photo full screen">
                                <DurableImage src={storyMedia.url} alt="Story photo preview" className="max-h-[min(62vh,34rem)] w-full object-contain" />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white">Tap to preview</span>
              </button>
              <button
                type="button"
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white"
                onClick={() => setStoryMedia(null)}
                aria-label="Remove story media"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {mode === "story" && storyMedia?.type === "video" && (
            <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-2.5">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                <span>Story video preview</span>
                <button type="button" onClick={() => setStoryMedia(null)} className="min-h-9 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Remove</button>
              </div>
              <DurableVideo src={storyMedia.url} controls playsInline muted={false} preload="none" className="max-h-[min(62vh,34rem)] w-full rounded-xl bg-black object-contain" />
            </div>
          )}
          <MediaLightbox
            open={storyPreviewOpen && mode === "story" && storyMedia?.type === "image"}
            url={storyMedia?.type === "image" ? storyMedia.url : null}
            caption="Story photo preview"
            onClose={() => setStoryPreviewOpen(false)}
          />
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
          {mode === "post" ? (
            <>
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
              <button
                type="button"
                onClick={() => {
                  close()
                  window.dispatchEvent(new CustomEvent("ghc:open-challenge"))
                }}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-orange-50 px-3 text-xs font-bold text-orange-700 transition hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300"
                aria-label="Create a challenge"
                title="Create a challenge"
              >
                <span className="text-sm" aria-hidden>
                  🎯
                </span>
              </button>
            </>
          ) : null}
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
            ? "Text, photos, video and files · Ctrl/⌘+Enter to post · photos up to 25 MB · videos up to 40 MB"
            : "Stories disappear after 24 hours"}
        </p>
      </footer>
    </div>
  )
}
