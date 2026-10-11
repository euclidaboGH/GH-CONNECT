"use client"

/**
 * Profile — Facebook-style photo/cover interaction.
 * Tap cover or avatar → action sheet (Change photo / Remove).
 * Full-width layout: no left gutter shift.
 */
import { useMemo, useState, useCallback, useEffect } from "react"
import { useGHCProfile, useGHCMessaging } from "@/contexts/ghc-context"
import { ProfileMyCommunities } from "./profile-my-communities"
import { ProfileEcosystemHub } from "./profile-ecosystem-hub"
import { ProfileMoreNav } from "./profile-more-nav"
import { SetupChecklist } from "./setup-checklist"
import { EditProfileModal, calculateProfileCompletion } from "./profile-components"
import { SignatureGhIdCard } from "./signature-gh-id"
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
} from "lucide-react"
import { LazyImage } from "./lazy-image"
import type { Profile } from "@/lib/ghc-types"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  formatGreenHavenIdDisplay,
  getOrCreateGreenHavenId,
} from "@/lib/domains/greenhaven-id"
import { shareText } from "@/lib/pi-native"
import { PiSupporterBadge } from "./pi-supporter-badge"
import { TrustBadge } from "./trust-badge"
import { getPublicSiteOrigin } from "@/lib/site-url"

type PhotoTarget = "photo" | "cover" | null

export function ProfileScreen({
  onSettings,
  onOpenWallet,
}: {
  onSettings: () => void
  onOpenWallet?: () => void
}) {
  const ghc = useGHCProfile() as {
    profile?: Profile
    posts?: { id?: string; text?: string; content?: string; createdAt?: number; images?: string[] }[]
    friends?: unknown[]
    following?: unknown[]
    updateProfile?: (updates: Partial<Profile>) => void
    addToast?: (m: string, t?: "success" | "error" | "info") => void
  }
  const messaging = useGHCMessaging() as { conversations?: unknown[] }
  const p = ghc.profile || ({} as Profile)
  const name = p.displayName || "Member"
  const photos = useMemo(() => (Array.isArray(p.photos) ? p.photos.filter(Boolean) : []), [p.photos])
  const photo = photos[0] || ""
  const cover = p.coverPhoto || ""
  const interests = Array.isArray(p.interests) ? p.interests.filter(Boolean) : []
  const intents = Array.isArray(p.connectionIntents) ? p.connectionIntents.filter(Boolean) : []
  const posts = Array.isArray(ghc.posts) ? ghc.posts : []
  const [profileActivityTab, setProfileActivityTab] = useState<"posts" | "media" | "activity">("posts")
  const mediaPosts = posts.filter(
    (post) => Array.isArray(post.images) && post.images.length > 0
  )
  const showMediaTab = mediaPosts.length > 0

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

  useEffect(() => {
    if (profileActivityTab === "media" && !showMediaTab) {
      setProfileActivityTab("posts")
    }
  }, [profileActivityTab, showMediaTab])

  const [editOpen, setEditOpen] = useState(false)
  const [photoSheet, setPhotoSheet] = useState<PhotoTarget>(null)
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

  const meId = IdentityService.getCurrentUserId()
  const ghDisplay = useMemo(
    () => formatGreenHavenIdDisplay(getOrCreateGreenHavenId(meId, null)),
    [meId]
  )

  const locationLine = [p.city, p.country].filter(Boolean).join(", ")
  const profileCompletion = useMemo(() => calculateProfileCompletion(p), [p])
  const extraPhotos = useMemo(() => photos.slice(1, 6), [photos])

  const openEdit = useCallback(() => setEditOpen(true), [])

  const handleSave = useCallback(
    (updates: Partial<Profile>) => {
      try {
        ghc.updateProfile?.(updates)
        setStatusMsg("Profile updated")
        window.setTimeout(() => setStatusMsg(null), 2000)
        ghc.addToast?.("Profile updated", "success")
      } catch {
        setStatusMsg("Could not save profile")
        window.setTimeout(() => setStatusMsg(null), 2500)
        ghc.addToast?.("Could not save profile", "error")
      }
    },
    [ghc]
  )

  const pickImage = useCallback(
    (kind: "photo" | "cover") => {
      setPhotoSheet(null)
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        ghc.addToast?.("You are offline. Choose a photo now — it saves on this device and may sync when you reconnect.", "info")
      }
      try {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/*"
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          if (file.size > 4 * 1024 * 1024) {
            ghc.addToast?.("Image must be under 4 MB", "error")
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result || "")
            if (!dataUrl) return
            if (kind === "photo") {
              const next = [dataUrl, ...photos.filter((x) => x !== dataUrl)].slice(0, 6)
              ghc.updateProfile?.({ photos: next })
              setStatusMsg("Profile photo updated")
              window.setTimeout(() => setStatusMsg(null), 2000)
              ghc.addToast?.("Profile photo updated", "success")
            } else {
              ghc.updateProfile?.({ coverPhoto: dataUrl })
              setStatusMsg("Cover photo updated")
              window.setTimeout(() => setStatusMsg(null), 2000)
              ghc.addToast?.("Cover photo updated", "success")
            }
          }
          reader.readAsDataURL(file)
        }
        input.click()
      } catch {
        ghc.addToast?.("Could not open gallery", "error")
      }
    },
    [ghc, photos]
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
    <div className="gh-profile-shell flex h-full min-h-0 w-full flex-col bg-background text-foreground contain-content">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-border/50 bg-card/95 px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <h1 className="text-[15px] font-bold tracking-tight text-foreground">Profile</h1>
        <div className="flex items-center gap-0.5">
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
          You are offline. Profile edits may save on this device and sync when you reconnect.
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
          className="relative block h-40 w-full overflow-hidden bg-gradient-to-br from-[var(--gh-balance-from)] via-[var(--gh-green)] to-[var(--gh-balance-to)] sm:h-48"
          aria-label="Change cover photo"
        >
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Camera size={12} aria-hidden />
            Cover
          </span>
        </button>

        {/* AVATAR row — overlaps cover; content is full width below */}
        <div className="relative z-[1] w-full px-4">
          <div className="-mt-12 flex items-end justify-between">
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
                  className="h-[5.5rem] w-[5.5rem] rounded-full object-cover ring-4 ring-background sm:h-24 sm:w-24"
                />
              ) : (
                <div
                  className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-xl font-black text-white ring-4 ring-background sm:h-24 sm:w-24"
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
                  try {
                    void navigator.clipboard?.writeText(ghDisplay)
                    setStatusMsg("GH ID copied")
                    window.setTimeout(() => setStatusMsg(null), 1500)
                    ghc.addToast?.("GH ID copied", "success")
                  } catch {
                    ghc.addToast?.("Could not copy GH ID", "error")
                  }
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
            <div className="mt-4 flex gap-1 rounded-[1.25rem] border border-border/50 bg-card p-1.5 shadow-[var(--gh-card-shadow)]">
              {[
                { label: "Posts", value: posts.length },
                { label: "Friends", value: Array.isArray(ghc.friends) ? ghc.friends.length : 0 },
                { label: "Following", value: Array.isArray(ghc.following) ? ghc.following.length : 0 },
              ].map((s) => (
                <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center py-2.5 text-center">
                  <p className="text-[15px] font-bold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
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

        {extraPhotos.length > 0 ? (
          <section className="mt-3 w-full px-4" aria-label="More photos">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {extraPhotos.map((src, i) => (
                <button
                  key={`${i}-${src.slice(0, 24)}`}
                  type="button"
                  onClick={() => setPhotoSheet("photo")}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm"
                  aria-label={`Photo ${i + 2}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* GH ID card */}
        <div className="mt-4 w-full px-4">
          <SignatureGhIdCard
            userId={meId}
            displayName={name}
            onToast={
              (() => {
                const addToast = ghc.addToast
                if (!addToast) return undefined
                return (msg: string, type?: string) => {
                  const kind =
                    type === "error" || type === "success" || type === "info"
                      ? type
                      : "info"
                  addToast(msg, kind)
                }
              })()
            }
          />
        </div>

        <ProfileMyCommunities
          conversations={messaging?.conversations}
          viewerId={meId}
        />

        {intents.length > 0 ? (
          <section className="mt-4 w-full px-4">
            <div className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Looking for
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {intents.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                >
                  {i}
                </span>
              ))}
            </div>
            </div>
          </section>
        ) : null}

        <div className="mt-4 w-full px-4">
          <ProfileEcosystemHub
            userId={meId}
            displayName={name}
            onOpenWallet={onOpenWallet}
            onShareProfile={() => void shareProfile()}
            onOpenMembership={() => {
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:open-settings", { detail: { section: "membership" } })
                )
              } catch {
                /* */
              }
            }}
            onOpenRewards={() => {
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:open-settings", { detail: { section: "rewards" } })
                )
              } catch {
                /* */
              }
            }}
          />
        </div>

        <section className="mt-4 w-full px-4">
          <div className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Interests
          </p>
          {interests.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border/40"
                >
                  {i}
                </span>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={openEdit}
              className="mt-2 w-full rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-left text-[12px] text-muted-foreground transition hover:bg-muted/50"
            >
              Add interests so Discover can recommend better matches.
            </button>
          )}
          </div>
        </section>

        
        <section className="mt-4 w-full px-4" aria-label="Personal activity">
          <div className="overflow-hidden rounded-[1.25rem] border border-border/50 bg-card shadow-sm">
          <div
            className="flex items-center gap-1 border-b border-border/60 px-1"
            role="tablist"
            aria-label="Profile activity"
            onKeyDown={(e) => {
              const tabs: ("posts" | "media" | "activity")[] = showMediaTab
                ? ["posts", "media", "activity"]
                : ["posts", "activity"]
              const idx = tabs.indexOf(profileActivityTab)
              if (idx < 0) return
              if (e.key === "ArrowRight") {
                e.preventDefault()
                setProfileActivityTab(tabs[(idx + 1) % tabs.length])
              } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                setProfileActivityTab(tabs[(idx - 1 + tabs.length) % tabs.length])
              }
            }}
          >
            {(
              [
                { id: "posts" as const, label: "Posts" as const },
                ...(showMediaTab
                  ? [{ id: "media" as const, label: "Media" as const }]
                  : []),
                { id: "activity" as const, label: "Activity" as const },
              ] as { id: "posts" | "media" | "activity"; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={profileActivityTab === tab.id}
                tabIndex={profileActivityTab === tab.id ? 0 : -1}
                onClick={() => setProfileActivityTab(tab.id)}
                className={`min-h-11 flex-1 px-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  profileActivityTab === tab.id
                    ? "border-b-2 border-[var(--gh-green)] text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(profileActivityTab === "posts" || profileActivityTab === "activity") && (
            <>
              {posts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: {} }))
                    } catch {
                      /* */
                    }
                  }}
                  className="m-3 w-[calc(100%-1.5rem)] rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center transition hover:bg-muted/40"
                >
                  <p className="text-[13px] font-semibold text-foreground">No posts yet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Share a thought, photo, or win with your network.
                  </p>
                </button>
              ) : (
                <>
                <p className="px-3 pt-2 text-[11px] font-medium text-muted-foreground" aria-live="polite">
                  {Math.min(posts.length, profileActivityTab === "activity" ? 12 : 8)} of {posts.length}{" "}
                  post{posts.length === 1 ? "" : "s"}
                </p>
                <ul className="space-y-2 p-3" role="list" aria-label="Your posts">
                  {posts.slice(0, profileActivityTab === "activity" ? 12 : 8).map((post, idx) => {
                    const body = String(post.content || post.text || "").trim()
                    const preview =
                      body
                        .replace(/^📊\s*POLL[^\n]*\n?/i, "Poll · ")
                        .replace(/^🏆\s*CHALLENGE[^\n]*\n?/i, "Challenge · ")
                        .slice(0, 140) || "Shared a post"
                    return (
                      <li
                        key={post.id || idx}
                        className="rounded-[1rem] border border-border/40 bg-background/80 px-3.5 py-3 shadow-sm"
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            if (!post.id) return
                            try {
                              window.dispatchEvent(
                                new CustomEvent("ghc:navigate-tab", { detail: "home" })
                              )
                              window.dispatchEvent(
                                new CustomEvent("ghc:open-post", { detail: { postId: post.id } })
                              )
                            } catch {
                              /* */
                            }
                          }}
                        >
                        <p className="line-clamp-2 text-[12px] leading-snug text-foreground">{preview}</p>
                        {post.createdAt ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(post.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                </>
              )}
            </>
          )}

          {profileActivityTab === "media" && showMediaTab && (
            mediaPosts.length === 0 ? (
              <p className="mt-3 px-1 text-center text-[12px] text-muted-foreground">
                No media posts yet. Photos you share on Feed appear here.
              </p>
            ) : (
            <ul className="grid grid-cols-3 gap-1.5 p-3" role="list" aria-label="Media posts">
              {mediaPosts.slice(0, 12).map((post, idx) => {
                const src = post.images?.[0]
                return (
                  <li
                    key={post.id || idx}
                    className="aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    {src ? (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </li>
                )
              })}
            </ul>
            )
          )}
          </div>
        </section>


        <div className="mt-4 w-full space-y-3 px-4 pb-8">
          <SetupChecklist
            onNavigate={(tab) => {
              try {
                window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
              } catch {
                /* */
              }
            }}
          />
          <ProfileMoreNav onOpenSettings={onSettings} onOpenWallet={onOpenWallet} />
        </div>
      </div>

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
