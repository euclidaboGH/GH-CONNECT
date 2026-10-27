"use client"

/**
 * Profile — owner identity and owner posts, with non-essential account tools grouped
 * inside a collapsed Dashboard. Profile post actions reuse the canonical feed card.
 */
import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react"
import { useGHCProfile, useGHCMessaging, useGHCFeed } from "@/contexts/ghc-context"
import { ProfileMyCommunities } from "./profile-my-communities"
import { ProfileEcosystemHub } from "./profile-ecosystem-hub"
import { ProfileMoreNav } from "./profile-more-nav"
import { SetupChecklist } from "./setup-checklist"
import { EditProfileModal, calculateProfileCompletion, OwnPostCard } from "./profile-components"
import {
  Settings as SettingsIcon,
  Wallet,
  Camera,
  Pencil,
  Share2,
  X,
  ImagePlus,
  Trash2,
  BadgeCheck,
  Crown,
} from "lucide-react"
import { LazyImage } from "./lazy-image"
import type { Post, Profile } from "@/lib/ghc-types"
import { isOwnProfilePost } from "@/lib/ownership"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  formatGreenHavenIdDisplay,
  getOrCreateGreenHavenId,
} from "@/lib/domains/greenhaven-id"
import { shareText } from "@/lib/pi-native"
import { PiSupporterBadge } from "./pi-supporter-badge"
import { PiConnectedBadge, PioneerIdentityStrip } from "./pi-connected-badge"
import { TrustBadge } from "./trust-badge"
import { getPublicSiteOrigin } from "@/lib/site-url"
import { uploadDurableMedia, isMediaStorageUnavailable } from "@/lib/media/upload-client"
import { toRelativeMediaFacadeUrl } from "@/lib/media/resolve-display-url"
import { compressImageFile } from "@/lib/media/compress-image"
import { ProfileContentLibrary } from "./profile-content-library"
import { ProfileSectionTabs, type ProfileSectionTab } from "./profile-section-tabs"
import { PremiumSurfaceActions } from "./premium-surface-actions"
import ProfileStorySection from "./profile-story-section"
import { UnifiedActivityCenter } from "./unified-activity-center"
import { ProfileIdentityOverview } from "./profile-identity-overview"

type PhotoTarget = "photo" | "cover" | null

function mapProfilePostComments(raw: unknown): Post["comments"] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {}
    return {
      id: String(row.id || ""),
      authorId: String(row.authorId || row.author_id || ""),
      authorName: String(row.authorName || row.author_name || "Member"),
      authorPhoto: String(row.authorPhoto || row.author_photo || ""),
      text: String(row.text || ""),
      createdAt: Number(row.createdAt ?? row.created_at) || 0,
      replyTo: row.replyTo || row.parentId || row.parent_id ? String(row.replyTo || row.parentId || row.parent_id) : undefined,
      replies: [],
      reactions: {},
      reactionCounts: row.reactionCounts && typeof row.reactionCounts === "object"
        ? Object.fromEntries(Object.entries(row.reactionCounts as Record<string, unknown>).map(([emoji, count]) => [emoji, Math.max(0, Number(count) || 0)]))
        : {},
      viewerReactions: Array.isArray(row.viewerReactions) ? row.viewerReactions.map(String) : [],
      isEdited: Boolean(row.isEdited ?? row.is_edited),
      editedAt: Number(row.editedAt ?? row.edited_at) || undefined,
      isPinned: Boolean(row.isPinned ?? row.is_pinned),
      mediaAttachments: Array.isArray(row.mediaAttachments) ? row.mediaAttachments as Post["comments"][number]["mediaAttachments"] : [],
    }
  }).filter((comment) => comment.id) as Post["comments"]
}

export function ProfileScreen({
  onSettings,
  onOpenWallet,
}: {
  onSettings: () => void
  onOpenWallet?: () => void
}) {
  const ghc = useGHCProfile() as {
    profile?: Profile
    friends?: unknown[]
    following?: unknown[]
    updateProfile?: (updates: Partial<Profile>) => Promise<void>
    addToast?: (m: string, t?: "success" | "error" | "info") => void
  }
  const messaging = useGHCMessaging() as { conversations?: unknown[] }
  const feed = useGHCFeed()
  const p = useMemo(() => ghc.profile || ({} as Profile), [ghc.profile])
  const name = p.displayName || "Member"
  const photos = useMemo(() => (Array.isArray(p.photos) ? p.photos.filter(Boolean) : []), [p.photos])
  const photo = photos[0] || ""
  const cover = p.coverPhoto || ""
  const interests = Array.isArray(p.interests) ? p.interests.filter(Boolean) : []
  const intents = Array.isArray(p.connectionIntents) ? p.connectionIntents.filter(Boolean) : []
  const meId = IdentityService.getCurrentUserId()
  // The profile timeline is loaded from its own durable, viewer-authorized API;
  // the feed is only a temporary visual fallback while that request is in flight.
  const [timelinePosts, setTimelinePosts] = useState<Post[] | null>(null)
  const [timelineCursor, setTimelineCursor] = useState<{ before: number; beforeId: string } | null>(null)
  const [timelineHasMore, setTimelineHasMore] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timelineRetry, setTimelineRetry] = useState(0)
  const fallbackPosts = useMemo(
    () => (Array.isArray(feed.posts) ? feed.posts.filter((post) => isOwnProfilePost(post.authorId, post.authorName, meId, p)) : []),
    [feed.posts, meId, p],
  )
  const posts = timelinePosts ?? fallbackPosts
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [authoritativeFollowCounts, setAuthoritativeFollowCounts] = useState<{ followers: number; following: number } | null>(null)

  useEffect(() => {
    if (!meId) return
    const controller = new AbortController()
    setTimelineLoading(true)
    setTimelineError(null)
    setTimelinePosts(null)
    setTimelineCursor(null)
    setTimelineHasMore(false)
    void (async () => {
      try {
        const response = await fetch(`/api/social/profile/${encodeURIComponent(meId)}/posts?limit=30&kind=all`, {
          credentials: "include", cache: "no-store", signal: controller.signal,
        })
        const data = await response.json().catch(() => ({})) as {
          ok?: boolean; posts?: Array<Record<string, unknown>>; hasMore?: boolean;
          nextBefore?: number | null; nextBeforeId?: string | null; error?: string; message?: string
        }
        if (!response.ok || !data.ok) throw new Error(data.message || data.error || `Timeline unavailable (${response.status})`)
        const mapped = (Array.isArray(data.posts) ? data.posts : []).map((row): Post => {
          const likes = Math.max(0, Number(row.likes) || 0)
          const commentCount = Math.max(0, Number(row.commentCount) || 0)
          const shares = Math.max(0, Number(row.shares) || 0)
          return {
            id: String(row.id || ""), authorId: String(row.authorId || ""),
            authorName: String(row.authorName || "Member"), authorPhoto: String(row.authorPhoto || ""),
            content: String(row.content || ""), images: Array.isArray(row.images) ? row.images.map(String) : [],
            video: row.video == null ? null : String(row.video), pdf: row.pdf == null ? null : String(row.pdf),
            pdfName: row.pdfName == null ? null : String(row.pdfName), likes,
            comments: mapProfilePostComments(row.comments),
            createdAt: Number(row.createdAt) || 0, isEdited: Boolean(row.isEdited),
            shares, visibility: (String(row.visibility || "public") as Post["visibility"]),
            communityId: row.communityId == null ? undefined : String(row.communityId),
            communityName: row.communityName == null ? undefined : String(row.communityName),
            contentType: (String(row.contentType || "standard") as Post["contentType"]),
            upvoteCount: Math.max(0, Number(row.upvoteCount) || 0),
            downvoteCount: Math.max(0, Number(row.downvoteCount) || 0),
            viewerCurationChoice: row.viewerCurationChoice === "upvote" || row.viewerCurationChoice === "downvote" ? row.viewerCurationChoice : undefined,
            reactionCounts: row.reactionCounts && typeof row.reactionCounts === "object"
              ? Object.fromEntries(Object.entries(row.reactionCounts as Record<string, unknown>).map(([reaction, count]) => [reaction, Math.max(0, Number(count) || 0)]))
              : {},
            viewerReactions: Array.isArray(row.viewerReactions) ? row.viewerReactions.map(String) : [],
            engagement: { likes, comments: commentCount, shares, views: 0, saves: 0, clicks: 0, avgEngagementTime: 0 },
          }
        }).filter((post) => post.id && post.authorId === meId)
        setTimelinePosts(mapped)
        setTimelineHasMore(Boolean(data.hasMore))
        setTimelineCursor(typeof data.nextBefore === "number" && typeof data.nextBeforeId === "string"
          ? { before: data.nextBefore, beforeId: data.nextBeforeId } : null)
      } catch (error) {
        if (controller.signal.aborted) return
        setTimelineError(error instanceof Error ? error.message : "Your complete timeline could not be loaded")
      } finally {
        if (!controller.signal.aborted) setTimelineLoading(false)
      }
    })()
    return () => controller.abort()
  }, [meId, timelineRetry])

  const loadMoreTimeline = useCallback(async () => {
    if (!meId || !timelineCursor || !timelineHasMore || timelineLoadingMore) return
    setTimelineLoadingMore(true)
    setTimelineError(null)
    try {
      const params = new URLSearchParams({ limit: "30", kind: "all", before: String(timelineCursor.before), beforeId: timelineCursor.beforeId })
      const response = await fetch(`/api/social/profile/${encodeURIComponent(meId)}/posts?${params.toString()}`, {
        credentials: "include", cache: "no-store",
      })
      const data = await response.json().catch(() => ({})) as {
        ok?: boolean; posts?: Array<Record<string, unknown>>; hasMore?: boolean;
        nextBefore?: number | null; nextBeforeId?: string | null; error?: string; message?: string
      }
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || `More posts unavailable (${response.status})`)
      const mapped = (Array.isArray(data.posts) ? data.posts : []).map((row): Post => {
        const likes = Math.max(0, Number(row.likes) || 0)
        const commentCount = Math.max(0, Number(row.commentCount) || 0)
        const shares = Math.max(0, Number(row.shares) || 0)
        return {
          id: String(row.id || ""), authorId: String(row.authorId || ""), authorName: String(row.authorName || "Member"),
          authorPhoto: String(row.authorPhoto || ""), content: String(row.content || ""),
          images: Array.isArray(row.images) ? row.images.map(String) : [], video: row.video == null ? null : String(row.video),
          pdf: row.pdf == null ? null : String(row.pdf), pdfName: row.pdfName == null ? null : String(row.pdfName),
          likes, comments: mapProfilePostComments(row.comments), createdAt: Number(row.createdAt) || 0, isEdited: Boolean(row.isEdited), shares,
          visibility: String(row.visibility || "public") as Post["visibility"],
          communityId: row.communityId == null ? undefined : String(row.communityId),
          communityName: row.communityName == null ? undefined : String(row.communityName),
          contentType: String(row.contentType || "standard") as Post["contentType"],
          upvoteCount: Math.max(0, Number(row.upvoteCount) || 0), downvoteCount: Math.max(0, Number(row.downvoteCount) || 0),
          viewerCurationChoice: row.viewerCurationChoice === "upvote" || row.viewerCurationChoice === "downvote" ? row.viewerCurationChoice : undefined,
          reactionCounts: row.reactionCounts && typeof row.reactionCounts === "object"
            ? Object.fromEntries(Object.entries(row.reactionCounts as Record<string, unknown>).map(([reaction, count]) => [reaction, Math.max(0, Number(count) || 0)]))
            : {},
          viewerReactions: Array.isArray(row.viewerReactions) ? row.viewerReactions.map(String) : [],
          engagement: { likes, comments: commentCount, shares, views: 0, saves: 0, clicks: 0, avgEngagementTime: 0 },
        }
      }).filter((post) => post.id && post.authorId === meId)
      setTimelinePosts((current) => {
        const existing = current || []
        const seen = new Set(existing.map((post) => post.id))
        return [...existing, ...mapped.filter((post) => !seen.has(post.id))]
      })
      setTimelineHasMore(Boolean(data.hasMore))
      setTimelineCursor(typeof data.nextBefore === "number" && typeof data.nextBeforeId === "string"
        ? { before: data.nextBefore, beforeId: data.nextBeforeId } : null)
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "More posts could not be loaded")
    } finally {
      setTimelineLoadingMore(false)
    }
  }, [meId, timelineCursor, timelineHasMore, timelineLoadingMore])

  // Profile timeline cards can contain older posts that are not in the home-feed
  // store, so their writes go directly through the durable social API contracts.
  const handleTimelineDelete = useCallback(async (postId: string) => {
    try {
      const { socialDeletePost } = await import("@/lib/social/client")
      const result = await socialDeletePost(postId)
      if (!result.ok || !result.durable) throw new Error(result.error || "Server did not confirm deletion")
      setTimelinePosts((current) => current?.filter((post) => post.id !== postId) ?? null)
      ghc.addToast?.("Post deleted", "success")
    } catch (error) {
      ghc.addToast?.(error instanceof Error ? error.message : "Could not delete post", "error")
    }
  }, [ghc])

  const handleTimelineEdit = useCallback(async (postId: string, content: string, media?: { images?: string[]; video?: string | null }) => {
    try {
      const { socialEditPost } = await import("@/lib/social/client")
      const result = await socialEditPost(postId, content, media)
      if (!result.ok || !result.durable) throw new Error(result.error || "Server did not confirm the edit")
      setTimelinePosts((current) => current?.map((post) => post.id === postId ? {
        ...post, content,
        ...(media ? {
          images: media.images !== undefined ? media.images : post.images,
          video: media.video !== undefined ? media.video : post.video,
        } : {}),
        isEdited: true,
      } : post) ?? null)
      ghc.addToast?.("Post updated", "success")
    } catch (error) {
      ghc.addToast?.(error instanceof Error ? error.message : "Could not update post", "error")
    }
  }, [ghc])

  const handleTimelineArchive = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/archive`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }), cache: "no-store",
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; durable?: boolean; error?: string }
      if (!response.ok || !result.ok || !result.durable) throw new Error(result.error || "Server did not confirm archive")
      setTimelinePosts((current) => current?.filter((post) => post.id !== postId) ?? null)
      ghc.addToast?.("Post archived", "success")
    } catch (error) {
      ghc.addToast?.(error instanceof Error ? error.message : "Could not archive post", "error")
    }
  }, [ghc])

  const [socialList, setSocialList] = useState<"Posts" | "Friends" | "Following" | "Followers" | null>(null)
  const [profileSectionTab, setProfileSectionTab] = useState<ProfileSectionTab>("posts")
  const [profileListings, setProfileListings] = useState<
    Array<{ id: string; title: string; price: number; currency: string; media?: string[]; status?: string; location?: string }>
  >([])
  const [profileListingsLoading, setProfileListingsLoading] = useState(false)

  useEffect(() => {
    if (profileSectionTab !== "listings") return
    let cancelled = false
    setProfileListingsLoading(true)
    ;(async () => {
      try {
        const { socialFetchMarketplaceListings } = await import("@/lib/social/client")
        const remote = await socialFetchMarketplaceListings({ scope: "mine", limit: 24 })
        if (cancelled) return
        if (!remote.ok) {
          setProfileListings([])
          return
        }
        setProfileListings(
          remote.listings
            .map((row) => ({
              id: String(row.id || ""),
              title: String(row.title || "Listing"),
              price: Number(row.price) || 0,
              currency: String(row.currency || "GHC"),
              media: Array.isArray(row.media) ? row.media.map(String) : [],
              status: String(row.status || "active"),
              location: row.location ? String(row.location) : undefined,
            }))
            .filter((l) => l.id)
        )
      } catch {
        if (!cancelled) setProfileListings([])
      } finally {
        if (!cancelled) setProfileListingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileSectionTab])
  const [dashboardPageOpen, setDashboardPageOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsOffline(!navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  const [editOpen, setEditOpen] = useState(false)
  const [photoSheet, setPhotoSheet] = useState<PhotoTarget>(null)
  const [membershipTierLabel, setMembershipTierLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const headers: Record<string, string> = { Accept: "application/json" }
        try {
          Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
        } catch { /* */ }
        const res = await fetch("/api/membership/status", {
          credentials: "include",
          cache: "no-store",
          headers,
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled || !res.ok || !data?.ok) return
        const tier = String(data.entitlement?.tier || data.tier || "free").toLowerCase()
        if (tier === "vip" || tier === "vvip") {
          setMembershipTierLabel(tier.toUpperCase())
        } else {
          setMembershipTierLabel(null)
        }
      } catch {
        /* */
      }
    })()
    const onMembership = () => {
      // Soft re-check after activate
      void fetch("/api/membership/status", { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const tier = String(data?.entitlement?.tier || data?.tier || "free").toLowerCase()
          setMembershipTierLabel(tier === "vip" || tier === "vvip" ? tier.toUpperCase() : null)
        })
        .catch(() => {})
    }
    window.addEventListener("ghc:membership-activated", onMembership)
    return () => {
      cancelled = true
      window.removeEventListener("ghc:membership-activated", onMembership)
    }
  }, [])


  useEffect(() => {
    if (!photoSheet && !editOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (photoSheet) setPhotoSheet(null)
      else if (editOpen) setEditOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [photoSheet, editOpen])

  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const initials = useMemo(() => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "GH"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [name])

  const handle = useMemo(() => {
    if (p.username?.trim()) return `@${p.username.trim().replace(/^@/, "")}`
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24)
    return `@${base || "member"}`
  }, [p.username, name])

  const [serverGreenHavenId, setServerGreenHavenId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetch("/api/identity/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return
        const id = String(d.greenHavenId || "").trim()
        if (id) {
          setServerGreenHavenId(id)
          try {
            // Align local cache with server public id so referrals and Copy ID match
            getOrCreateGreenHavenId(meId, id)
          } catch { /* */ }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meId])
  const ghDisplay = useMemo(() => {
    const preferred = serverGreenHavenId || getOrCreateGreenHavenId(meId, null)
    return formatGreenHavenIdDisplay(preferred)
  }, [meId, serverGreenHavenId])

  const locationLine = [p.city, p.country].filter(Boolean).join(", ")
  const profileCompletion = useMemo(() => calculateProfileCompletion(p), [p])
  const extraPhotos = useMemo(() => photos.slice(1, 6), [photos])

  const openEdit = useCallback(() => setEditOpen(true), [])

  const handleSave = useCallback(
    async (updates: Partial<Profile>): Promise<boolean> => {
      try {
        if (!ghc.updateProfile) throw new Error("Profile updates are unavailable")
        await ghc.updateProfile(updates)
        setStatusMsg("Profile updated")
        window.setTimeout(() => setStatusMsg(null), 2000)
        ghc.addToast?.("Profile updated", "success")
        return true
      } catch {
        setStatusMsg("Could not save profile")
        window.setTimeout(() => setStatusMsg(null), 2500)
        ghc.addToast?.("Could not save profile", "error")
        return false
      }
    },
    [ghc]
  )

  const pickImage = useCallback(
    (kind: "photo" | "cover") => {
      setPhotoSheet(null)
      const offline = typeof navigator !== "undefined" && !navigator.onLine
      if (offline) {
        ghc.addToast?.("You are offline. The photo can be saved locally and synced when you reconnect.", "info")
      }
      try {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif"
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          if (!file.type.startsWith("image/")) {
            ghc.addToast?.("Choose a valid image file", "error")
            return
          }
          if (file.size > 25 * 1024 * 1024) {
            ghc.addToast?.("Image must be under 25 MB", "error")
            return
          }
          void (async () => {
            let imageUrl = ""
            try {
              if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem("ghc.media.health.warned")) {
                const h = await fetch("/api/media/health", { credentials: "include", cache: "no-store" })
                const hj = await h.json().catch(() => ({}))
                if (h.ok && hj && hj.ok === false) {
                  sessionStorage.setItem("ghc.media.health.warned", "1")
                  ghc.addToast?.(
                    "Photo storage is not fully configured yet — uploads may stay on this device only.",
                    "info"
                  )
                }
              }
            } catch {
              /* */
            }
            // Accept high-resolution source images, then compress before the Vercel
            // proxy upload so profile media stays below the durable-upload ceiling.
            const compressedDataUrl = await compressImageFile(file, {
              purpose: kind === "photo" ? "avatar" : "cover",
              preferWebp: true,
              maxInputBytes: 25 * 1024 * 1024,
            })
            const compressedBlob = await fetch(compressedDataUrl).then((r) => r.blob())
            const uploaded = offline ? null : await uploadDurableMedia(compressedBlob, { fileName: `${kind}-${Date.now()}.${compressedBlob.type === "image/webp" ? "webp" : "jpg"}`, category: "avatars" })
            if (uploaded?.ok && uploaded.kind === "image") {
              imageUrl = toRelativeMediaFacadeUrl(uploaded.url)
            } else if (offline || (uploaded && !uploaded.ok && isMediaStorageUnavailable(uploaded.error))) {
              // Offline/local fallback — not visible on other devices until durable upload succeeds.
              ghc.addToast?.(
                offline
                  ? "Photo saved on this device only until you are online"
                  : "Photo stored locally — durable storage not available yet",
                "info"
              )
              imageUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onerror = () => reject(new Error("Could not read this image. Try another file."))
                reader.onload = () => {
                  const value = String(reader.result || "")
                  if (!value.startsWith("data:image/")) reject(new Error("The selected image could not be processed."))
                  else resolve(value)
                }
                reader.readAsDataURL(compressedBlob)
              })
            } else {
              const detail =
                uploaded && uploaded.ok === false
                  ? (uploaded.userMessage || uploaded.error || "Upload failed")
                  : "This upload was not recognized as an image."
              // Prefer explicit toast so the red banner matches durable-media diagnostics
              ghc.addToast?.(detail, "error")
              throw new Error(detail)
            }
            const changedAt = Date.now()
            if (kind === "photo") {
              const previous = photos[0]
              const oldHistory = Array.isArray(p.profilePhotoHistory) ? p.profilePhotoHistory : []
              const history = previous && previous !== imageUrl && (previous.startsWith("http") || previous.includes("/api/media/"))
                ? [{ url: previous, changedAt, caption: "Previous profile photo" }, ...oldHistory.filter((item) => item.url !== previous)].slice(0, 24)
                : oldHistory.slice(0, 24)
              const next = [imageUrl, ...photos.filter((x) => x !== imageUrl)].slice(0, 6)
              await ghc.updateProfile?.({
                photos: next,
                profilePhotoHistory: history,
                profilePayload: { ...(p.profilePayload || {}), profilePhotoHistory: history, coverPhotoHistory: p.coverPhotoHistory || [] },
              })
              setStatusMsg("Profile photo updated")
              window.setTimeout(() => setStatusMsg(null), 2000)
              ghc.addToast?.("Profile photo updated", "success")
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:profile-media-updated", { detail: { kind: "photo" } }),
                )
              } catch { /* */ }
            } else {
              const previous = cover
              const oldHistory = Array.isArray(p.coverPhotoHistory) ? p.coverPhotoHistory : []
              const history = previous && previous !== imageUrl && (previous.startsWith("http") || previous.includes("/api/media/"))
                ? [{ url: previous, changedAt, caption: "Previous cover photo" }, ...oldHistory.filter((item) => item.url !== previous)].slice(0, 24)
                : oldHistory.slice(0, 24)
              await ghc.updateProfile?.({
                coverPhoto: imageUrl,
                coverPhotoHistory: history,
                profilePayload: { ...(p.profilePayload || {}), profilePhotoHistory: p.profilePhotoHistory || [], coverPhotoHistory: history },
              })
              setStatusMsg("Cover photo updated")
              window.setTimeout(() => setStatusMsg(null), 2000)
              ghc.addToast?.("Cover photo updated", "success")
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:profile-media-updated", { detail: { kind: "cover" } }),
                )
              } catch { /* */ }
            }
          })().catch((error) => {
            ghc.addToast?.(error instanceof Error ? error.message : "Could not update this image", "error")
          })
        }
        input.click()
      } catch {
        ghc.addToast?.("Could not open gallery", "error")
      }
    },
    [ghc, photos, p, cover]
  )

  const removeImage = useCallback(
    (kind: "photo" | "cover") => {
      setPhotoSheet(null)
      if (kind === "photo") {
        ghc.updateProfile?.({ photos: photos.slice(1) })
        ghc.addToast?.("Profile photo removed", "info")
      } else {
        ghc.updateProfile?.({ coverPhoto: null })
        ghc.addToast?.("Cover removed", "info")
      }
    },
    [ghc, photos]
  )

  const shareProfile = async () => {
    const text = `${name} · ${ghDisplay} on GreenHaven — connect on Pi Browser`
    const origin =
      getPublicSiteOrigin()
    const result = await shareText({
      title: "GreenHaven Profile",
      message: text,
      url: `${origin}/`,
    })
    if (result.ok) {
      if (result.method === "clipboard") {
        ghc.addToast?.("Profile link copied", "success")
      } else if (result.method === "pi.openShareDialog" || result.method === "pi.shareFile") {
        ghc.addToast?.("Opened Pi share sheet", "success")
      } else {
        ghc.addToast?.("Share sheet opened", "success")
      }
      return
    }
    if (!result.cancelled) {
      ghc.addToast?.(result.error || "Could not share profile", "info")
    }
  }

  return (
    <div className="gh-profile-shell gh-world-profile flex h-full min-h-0 w-full flex-col bg-background text-foreground contain-content" role="region" aria-label="Your GreenHaven profile">
      <header className="gh-page-header-slim gh-world-profile-header flex w-full shrink-0 items-center justify-between border-b border-border/50 bg-card/95 px-3 pb-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] backdrop-blur-md">
        <h1 className="text-[15px] font-bold tracking-tight text-foreground">Profile</h1>
        <div className="flex items-center gap-1">
          <PremiumSurfaceActions />
          <button
            type="button"
            onClick={() => onOpenWallet?.()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300"
            aria-label="Wallet"
          >
            <Wallet size={18} />
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg || ""}
      </div>
      {isOffline ? (
        <div
          className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          You are offline. Changes stay on this device and sync when you reconnect.
        </div>
      ) : null}

      <div
        className="gh-scroll-root gh-scroll-stable min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* COVER — full width, tap to change */}
        <button
          type="button"
          onClick={() => setPhotoSheet("cover")}
          className="gh-world-profile-cover relative block h-28 w-full overflow-hidden bg-gradient-to-br from-[var(--gh-balance-from)] via-[var(--gh-green)] to-[var(--gh-balance-to)] sm:h-36"
          aria-label="Change cover photo"
        >
          {cover ? (
            <LazyImage src={cover} alt={`${name} cover`} className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Camera size={12} aria-hidden />
            Cover
          </span>
        </button>

        {/* AVATAR row — overlaps cover; content is full width below */}
        <div className="gh-world-profile-identity gh-premium-profile-identity relative z-[1] w-full px-4">
          <div className="-mt-10 flex items-end justify-between">
            <button
              type="button"
              onClick={() => setPhotoSheet("photo")}
              className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Change profile photo"
            >
              {photo ? (
                <LazyImage
                  src={photo}
                  alt={`${name} photo`}
                  className="h-[4.75rem] w-[4.75rem] rounded-full object-cover ring-4 ring-background sm:h-20 sm:w-20"
                />
              ) : (
                <div
                  className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-lg font-black text-white ring-4 ring-background sm:h-20 sm:w-20"
                  aria-hidden
                >
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-[var(--gh-green)] text-white shadow-md">
                <Camera size={14} />
              </span>
            </button>

            <div className="mb-1 flex gap-2">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--gh-green)] px-4 text-[12px] font-bold text-white shadow-sm shadow-emerald-700/20 transition hover:brightness-105 active:scale-[0.98]"
              >
                <Pencil size={13} aria-hidden />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => void shareProfile()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 text-[12px] font-bold text-foreground shadow-sm transition hover:bg-muted active:scale-[0.98]"
              >
                <Share2 size={13} aria-hidden />
                Share
              </button>
            </div>
          </div>

          {/* Name block — full width under avatar (not side-shifted) */}
          <div className="mt-3.5 w-full">
            <h2 className="flex flex-wrap items-center gap-1.5 text-[1.35rem] font-black tracking-tight text-foreground">
              <span>{name}</span>
              {p.verified ? (
                <BadgeCheck size={18} className="shrink-0 text-sky-600" aria-label="Verified" />
              ) : null}
              <PiConnectedBadge />
              <PiSupporterBadge showCtaWhenNone />
              <TrustBadge userId={p.id || meId} showWhenNew />
            </h2>
            <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">{handle}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[12px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
                {ghDisplay}
              </p>
              <button
                type="button"
                className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => {
                  void (async () => {
                    try {
                      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable")
                      await navigator.clipboard.writeText(ghDisplay)
                      setStatusMsg("GH ID copied")
                      window.setTimeout(() => setStatusMsg(null), 1500)
                      ghc.addToast?.("GH ID copied", "success")
                    } catch {
                      ghc.addToast?.("Could not copy GH ID. You can select the ID and copy it manually.", "error")
                    }
                  })()
                }}
                aria-label="Copy GreenHaven ID"
              >
                Copy ID
              </button>
            </div>
            {locationLine ? (
              <p className="mt-1 text-[12px] text-muted-foreground">📍 {locationLine}</p>
            ) : null}
            {p.hometown ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">Home · {p.hometown}</p>
            ) : null}
            {p.education ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">🎓 {p.education}</p>
            ) : null}
            {p.bio ? (
              <p className="mt-2 text-[13px] leading-snug text-foreground/90">{p.bio}</p>
            ) : (
              <button
                type="button"
                onClick={openEdit}
                className="mt-2 text-left text-[13px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Add a short bio so people know what makes you unique.
              </button>
            )}
            {p.profession ? (
              <p className="mt-1.5 text-[12px] font-semibold text-muted-foreground">
                {p.profession}
                {p.primaryMode ? ` · ${p.primaryMode}` : ""}
              </p>
            ) : null}

            {/* Stats — real counts only */}
            <div className="gh-premium-profile-stats mt-4 grid grid-cols-4 gap-1 rounded-[1.25rem] border border-border/50 bg-card p-1.5 shadow-[var(--gh-card-shadow)]">
              {[
                { label: "Posts" as const, value: posts.length },
                { label: "Friends" as const, value: Array.isArray(ghc.friends) ? ghc.friends.length : 0 },
                { label: "Following" as const, value: authoritativeFollowCounts?.following ?? (Array.isArray(ghc.following) ? ghc.following.length : 0) },
                { label: "Followers" as const, value: authoritativeFollowCounts?.followers ?? (Array.isArray((ghc as { followers?: unknown[] }).followers) ? (ghc as { followers?: unknown[] }).followers!.length : 0) },
              ].map((s) => (
                <button key={s.label} type="button" onClick={() => setSocialList(s.label)} className="flex min-w-0 flex-col items-center rounded-xl py-2.5 text-center transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Open ${s.label.toLowerCase()} list`}>
                  <span className="text-[15px] font-bold tabular-nums text-foreground">{s.value}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
            {membershipTierLabel ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <Crown size={12} aria-hidden />
                {membershipTierLabel} member
              </div>
            ) : null}
            <ProfileIdentityOverview onCounts={setAuthoritativeFollowCounts} />
            <div className="mt-2"><PioneerIdentityStrip hideGreenHavenId /></div>
            {profileCompletion.percentage < 100 && profileCompletion.missing.length > 0 ? (
              <button
                type="button"
                onClick={openEdit}
                className="mt-2 w-full rounded-[1.25rem] border border-dashed border-emerald-200/80 bg-emerald-50/50 px-3.5 py-2.5 text-left transition hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              >
                <p className="text-[12px] font-bold text-foreground">
                  Profile {profileCompletion.percentage}% complete
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Add {profileCompletion.missing.slice(0, 2).join(" · ")}
                  {profileCompletion.missing.length > 2 ? "…" : ""} to improve discovery.
                </p>
              </button>
            ) : null}
          </div>
        </div>

        <ProfileSectionTabs
          active={profileSectionTab}
          onChange={setProfileSectionTab}
          counts={{
            posts: posts.length,
            media: posts.filter((post) => (Array.isArray((post as any).images) && (post as any).images.length > 0) || Boolean((post as any).video) || Boolean((post as any).pdf)).length,
          }}
        />

        {/* Compact tools — Dashboard only (wallet/rewards live here, not on public-looking chrome) */}
        <section id="gh-profile-tools" className="mt-2 w-full px-4" aria-label="Profile dashboard">
          <button
            type="button"
            aria-expanded={dashboardPageOpen}
            onClick={() => setDashboardPageOpen(true)}
            className="flex min-h-11 w-full items-center justify-between rounded-[1.1rem] border border-border/50 bg-card/80 px-3.5 py-2.5 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-foreground">Dashboard</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">Wallet · rewards · creator · settings</span>
            </span>
            <span className="ml-3 shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Open</span>
          </button>
        </section>

        {profileSectionTab === "about" ? (
          <section id="gh-profile-about" className="mt-3 w-full space-y-3 px-4 scroll-mt-14" aria-label="About">
            <div className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-foreground">About</h3>
              {p.bio ? <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{p.bio}</p> : (
                <button type="button" onClick={openEdit} className="mt-2 text-left text-[13px] text-muted-foreground underline-offset-2 hover:underline">Add a short bio</button>
              )}
              <dl className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
                {locationLine ? <div><dt className="inline font-semibold text-foreground">Location · </dt><dd className="inline">{locationLine}</dd></div> : null}
                {p.hometown ? <div><dt className="inline font-semibold text-foreground">Hometown · </dt><dd className="inline">{p.hometown}</dd></div> : null}
                {p.education ? <div><dt className="inline font-semibold text-foreground">Education · </dt><dd className="inline">{p.education}</dd></div> : null}
                {p.profession ? <div><dt className="inline font-semibold text-foreground">Profession · </dt><dd className="inline">{p.profession}{p.primaryMode ? ` · ${p.primaryMode}` : ""}</dd></div> : null}
              </dl>
              <button type="button" onClick={openEdit} className="mt-3 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Edit profile</button>
            </div>
          </section>
        ) : null}

        {profileSectionTab === "communities" ? (
          <div className="mt-2 scroll-mt-14" id="gh-profile-communities">
            <ProfileMyCommunities
              conversations={(ghc as { conversations?: unknown[] }).conversations}
              viewerId={meId}
              onOpenCommunity={(id) => {
                try {
                  window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "communities" }))
                  window.dispatchEvent(new CustomEvent("ghc:open-community", { detail: { communityId: id } }))
                } catch { /* */ }
              }}
            />
          </div>
        ) : null}

        {profileSectionTab === "listings" ? (
          <section id="gh-profile-listings" className="mt-3 w-full px-4 scroll-mt-14" aria-label="Your listings">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-bold text-foreground">Your listings</p>
                <p className="text-[11px] text-muted-foreground">Durable marketplace catalog · Pi or GHC</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "marketplace" }))
                    window.dispatchEvent(new CustomEvent("ghc:open-marketplace", { detail: { bucket: "sell" } }))
                  } catch { /* */ }
                }}
                className="min-h-9 shrink-0 rounded-full bg-emerald-600 px-3 text-[11px] font-bold text-white"
              >
                Sell
              </button>
            </div>
            {profileListingsLoading ? (
              <div className="rounded-2xl border border-border/50 p-6 text-center text-sm text-muted-foreground">
                Loading listings…
              </div>
            ) : profileListings.length ? (
              <div className="grid grid-cols-2 gap-2">
                {profileListings.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="overflow-hidden rounded-2xl border border-border/50 bg-card text-left shadow-sm"
                    onClick={() => {
                      try {
                        window.dispatchEvent(new CustomEvent("ghc:open-listing", { detail: { listingId: l.id } }))
                        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "marketplace" }))
                      } catch { /* */ }
                    }}
                  >
                    <div className="relative aspect-[4/3] bg-muted/50">
                      {l.media?.[0] ? (
                        <LazyImage src={l.media[0]} alt={l.title} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                          {l.status || "Listing"}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[12px] font-bold text-foreground">{l.title}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {(l.currency || "").toUpperCase() === "PI" ? `${l.price} π` : `₲ ${l.price}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.25rem] border border-border/60 bg-card p-4 text-center shadow-sm">
                <p className="text-[13px] font-bold text-foreground">No listings yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Sell goods or services with Pi or GHC.</p>
                <button
                  type="button"
                  onClick={() => {
                    try { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "marketplace" })) } catch { /* */ }
                  }}
                  className="mt-3 min-h-10 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white"
                >
                  Open Marketplace
                </button>
              </div>
            )}
          </section>
        ) : null}

        {profileSectionTab === "media" ? (
          <section id="gh-profile-media" className="mt-3 w-full px-4 scroll-mt-14" aria-label="Media">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-foreground">Media</h3>
              <button type="button" onClick={() => setLibraryOpen(true)} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Content library</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.flatMap((post) => {
                const imgs = Array.isArray((post as any).images) ? (post as any).images as string[] : []
                const vid = (post as any).video as string | null | undefined
                const cells: ReactNode[] = []
                imgs.forEach((src, i) => {
                  if (!src) return
                  cells.push(
                    <button key={`${post.id}-img-${i}`} type="button" className="aspect-square overflow-hidden rounded-xl bg-muted" onClick={() => setLibraryOpen(true)}>
                      <LazyImage src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  )
                })
                if (vid) {
                  cells.push(
                    <button key={`${post.id}-vid`} type="button" className="flex aspect-square items-center justify-center rounded-xl bg-muted text-[11px] font-bold text-muted-foreground" onClick={() => setLibraryOpen(true)}>
                      Video
                    </button>
                  )
                }
                return cells
              }).slice(0, 18)}
            </div>
            {posts.every((post) => !(Array.isArray((post as any).images) && (post as any).images.length) && !(post as any).video) ? (
              <p className="mt-3 text-center text-[12px] text-muted-foreground">Photos and videos from your posts appear here.</p>
            ) : null}
            <section className="mt-4" aria-label="Moments">
              <ProfileStorySection scope="profile" />
            </section>
          </section>
        ) : null}

        {profileSectionTab === "posts" ? (
          <>
        <section id="gh-profile-moments" className="mt-3 w-full px-4 scroll-mt-14" aria-label="Your stories and moments">
          <ProfileStorySection scope="profile" />
        </section>

        <section className="mt-3 w-full px-4" aria-label="Create a post">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))}
            className="flex w-full items-center gap-3 rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-3 text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-sm font-bold text-emerald-700" aria-hidden="true">
              {(name || "G").trim().slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 rounded-full bg-muted/70 px-4 py-2.5 text-[13px] text-muted-foreground">What would you like to share with GreenHaven?</span>
            <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white">Create</span>
          </button>
        </section>
          </>
        ) : null}

        {profileSectionTab === "posts" ? (
        <section id="gh-profile-posts" className="mt-3 w-full px-4 scroll-mt-14" aria-label="Your posts timeline">
          <div className="overflow-hidden rounded-[1.25rem] border border-border/50 bg-card shadow-sm">
            <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border/60 px-3.5">
              <div className="min-w-0"><h3 className="text-[13px] font-bold text-foreground">Posts</h3><span className="text-[11px] font-medium text-muted-foreground">{posts.length} in your timeline</span></div>
              <button type="button" onClick={() => setLibraryOpen(true)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-bold hover:bg-muted" aria-label="Open your posts, photos, videos and documents"><ImagePlus size={14} /> Content library</button>
            </div>
            {timelineLoading && timelinePosts === null ? (
              <div className="m-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-7 text-center" role="status">
                <p className="text-[13px] font-semibold text-foreground">Loading your full timeline…</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Your profile timeline loads independently from the home feed.</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="m-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-7 text-center">
                <p className="text-[13px] font-semibold text-foreground">Your timeline starts here</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Use the composer above to share a thought, photo, video or update.</p>
              </div>
            ) : (
              <ul className="space-y-3 p-3" role="list" aria-label="Your posts timeline">
                {posts.map((post) => (
                  <li key={post.id}>
                    <OwnPostCard
                      post={post}
                      isLiked={feed.likedPostIds.includes(post.id)}
                      onDelete={(postId) => { void handleTimelineDelete(postId) }}
                      onLike={(postId) => { void feed.likePost(postId) }}
                      onComment={(postId) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
                          window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId, action: "comment" } }))
                        } catch { /* */ }
                      }}
                      onShare={(postId) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
                          window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId, action: "share" } }))
                        } catch { /* */ }
                      }}
                      onSave={(postId) => { void feed.savePost(postId).catch(() => ghc.addToast?.("Could not save post", "error")) }}
                      onEdit={(postId, content, media?) => { void handleTimelineEdit(postId, content, media) }}
                      onArchive={(postId) => { void handleTimelineArchive(postId) }}
                      onInsights={(postId) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
                          window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId, action: "insights" } }))
                        } catch { /* */ }
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            {timelineError ? (
              <div className="mx-3 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3" role="status">
                <p className="text-[12px] font-semibold text-foreground">Complete timeline could not be verified</p>
                <p className="mt-1 break-words text-[11px] text-muted-foreground">{timelineError}. The posts shown may only be the currently loaded home-feed subset.</p>
                <button type="button" onClick={() => setTimelineRetry((value) => value + 1)} className="mt-2 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold hover:bg-muted">Retry timeline</button>
              </div>
            ) : null}
            {timelineHasMore && timelinePosts !== null ? (
              <div className="px-3 pb-3">
                <button type="button" disabled={timelineLoadingMore} onClick={() => void loadMoreTimeline()} className="min-h-10 w-full rounded-full border border-border px-4 py-2 text-[12px] font-bold hover:bg-muted disabled:opacity-50">
                  {timelineLoadingMore ? "Loading more posts…" : "Load older posts"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
        ) : null}
      </div>

      {dashboardPageOpen ? (
      <div className="fixed inset-0 z-[90] flex flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Dashboard">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button type="button" onClick={() => setDashboardPageOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Close dashboard"><X size={20} /></button>
            <div className="min-w-0"><h2 className="text-base font-bold">Dashboard</h2><p className="text-xs text-muted-foreground">Your GreenHaven tools and account activity</p></div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8">
            <ProfileEcosystemHub preferredGreenHavenId={serverGreenHavenId} userId={meId} displayName={name} onOpenWallet={() => { setDashboardPageOpen(false); onOpenWallet?.() }} onShareProfile={() => { setDashboardPageOpen(false); void shareProfile() }} onOpenMembership={() => { setDashboardPageOpen(false); window.dispatchEvent(new CustomEvent("ghc:open-settings", { detail: { section: "membership" } })) }} onOpenRewards={() => { setDashboardPageOpen(false); window.dispatchEvent(new CustomEvent("ghc:open-settings", { detail: { section: "rewards" } })) }} />
            <div className="mt-4"><UnifiedActivityCenter limit={40} /></div>
            <section className="mt-4 rounded-2xl border border-border/70 bg-card p-3" aria-label="Your communities">
              <h3 className="mb-2 text-sm font-bold">Your communities</h3>
              <ProfileMyCommunities conversations={messaging?.conversations} viewerId={meId} />
            </section>
            <section className="mt-4 rounded-2xl border border-border/70 bg-card p-3" aria-label="Account setup checklist">
              <h3 className="mb-2 text-sm font-bold">Account setup</h3>
              <SetupChecklist onNavigate={(tab) => { setDashboardPageOpen(false); window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab })) }} />
            </section>
            <div className="mt-4 rounded-2xl border border-border/70 bg-card p-3">
              <h3 className="mb-2 text-sm font-bold">More account tools</h3>
              <ProfileMoreNav onOpenSettings={() => { setDashboardPageOpen(false); onSettings() }} onOpenWallet={() => { setDashboardPageOpen(false); onOpenWallet?.() }} />
            </div>
            <div className="mt-4 space-y-2">
              <button type="button" onClick={() => { setDashboardPageOpen(false); setLibraryOpen(true) }} className="w-full rounded-xl border border-border p-3 text-left text-sm font-semibold hover:bg-muted">Photos, videos & documents <span className="float-right text-muted-foreground">Open</span></button>
              <button type="button" onClick={() => { setDashboardPageOpen(false); onSettings() }} className="w-full rounded-xl border border-border p-3 text-left text-sm font-semibold hover:bg-muted">Account settings <span className="float-right text-muted-foreground">Open</span></button>
            </div>
          </div>
        </div>
      ) : null}

      {socialList ? (() => {
        const list = socialList === "Posts" ? posts : socialList === "Friends" ? (Array.isArray(ghc.friends) ? ghc.friends : []) : socialList === "Following" ? (Array.isArray(ghc.following) ? ghc.following : []) : (Array.isArray((ghc as { followers?: unknown[] }).followers) ? (ghc as { followers?: unknown[] }).followers! : [])
        return <div className="fixed inset-0 z-[85] flex flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label={socialList}>
          <header className="flex items-center gap-2 border-b border-border px-3 py-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]"><button type="button" onClick={() => setSocialList(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Back to profile"><X size={20} /></button><h2 className="text-base font-bold">{socialList}</h2><span className="ml-auto text-xs text-muted-foreground">{list.length}</span></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{list.length ? list.map((entry, i) => { const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : null; const idValue = item?.id ?? item?.userId ?? item?.ownerId ?? item?.targetUserId ?? (typeof entry === "string" ? entry : null); const memberId = idValue == null ? "" : String(idValue).trim(); const label = socialList === "Posts" ? String(item?.content || item?.text || "Post") : String(item?.displayName || item?.name || item?.username || (memberId && !/^[a-f0-9-]{16,}$/i.test(memberId) ? memberId : "GreenHaven member")); const key = memberId || `entry-${i}`; const openEntry = () => { if (socialList === "Posts" && memberId) { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" })); window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId: memberId } })); setSocialList(null); return; } if (memberId) { window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId: memberId } })); setSocialList(null); } }; return <button type="button" key={key} onClick={openEntry} disabled={!memberId} className="flex w-full items-center gap-3 border-b border-border/60 px-2 py-3 text-left transition hover:bg-muted/50 disabled:cursor-default"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-sm font-bold text-emerald-700">{label.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{label}</p>{socialList === "Posts" && item?.createdAt ? <p className="text-xs text-muted-foreground">{new Date(Number(item.createdAt)).toLocaleDateString()}</p> : socialList !== "Posts" && item?.username ? <p className="truncate text-xs text-muted-foreground">@{String(item.username).replace(/^@/, "")}</p> : null}</div>{memberId ? <span className="text-xs font-semibold text-emerald-700">Open</span> : null}</button> }) : <div className="p-8 text-center text-sm text-muted-foreground">{socialList === "Posts" ? "Your posts will appear here." : `No ${socialList.toLowerCase()} to show yet.`}</div>}</div>
        </div>
      })() : null}

      <ProfileContentLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        profileId={meId}
        profileName={name}
        isOwner
        profilePhotos={photos}
        coverPhoto={cover}
        profilePhotoHistory={p.profilePhotoHistory || []}
        coverPhotoHistory={p.coverPhotoHistory || []}
      />

      {/* Photo / cover action sheet — Facebook-style */}
      {photoSheet ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={photoSheet === "cover" ? "Cover photo options" : "Profile photo options"}
          onClick={() => setPhotoSheet(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[1.25rem] border border-border/50 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[14px] font-bold text-foreground">
                {photoSheet === "cover" ? "Cover photo" : "Profile photo"}
              </p>
              <button
                type="button"
                onClick={() => setPhotoSheet(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2">
              <button
                type="button"
                onClick={() => pickImage(photoSheet)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-semibold text-foreground hover:bg-muted"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ImagePlus size={18} />
                </span>
                Upload new photo
              </button>
              {(photoSheet === "photo" ? photo : cover) ? (
                <button
                  type="button"
                  onClick={() => removeImage(photoSheet)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950">
                    <Trash2 size={18} />
                  </span>
                  Remove current
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setPhotoSheet(null)}
              className="w-full border-t border-border py-3 text-[13px] font-bold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={
          {
            displayName: name,
            bio: p.bio || "",
            profession: p.profession || "",
            education: p.education || "",
            hometown: p.hometown || "",
            bornDate: p.bornDate || "",
            city: p.city || "",
            country: p.country || "",
            homeLocation: p.homeLocation,
            locationPrivacy: p.locationPrivacy || "locality",
            interests,
            photos,
            username: p.username,
            coverPhoto: cover || null,
          } as Profile
        }
        onSave={handleSave}
        onChangePhoto={() => pickImage("photo")}
        onChangeCover={() => pickImage("cover")}
      />
    </div>
  )
}

export default ProfileScreen
