"use client"

/**
 * Profile — Facebook-style photo/cover interaction.
 * Tap cover or avatar → action sheet (Change photo / Remove).
 * Full-width layout: no left gutter shift.
 */
import { useMemo, useState, useCallback } from "react"
import { useGHCProfile } from "@/contexts/ghc-context"
import { IdentityLayersStrip } from "./identity-layers-strip"
import { ProfileMoreNav } from "./profile-more-nav"
import { SetupChecklist } from "./setup-checklist"
import { EditProfileModal } from "./profile-components"
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
  const p = ghc.profile || ({} as Profile)
  const name = p.displayName || "Member"
  const photos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : []
  const photo = photos[0] || ""
  const cover = p.coverPhoto || ""
  const interests = Array.isArray(p.interests) ? p.interests.filter(Boolean) : []
  const intents = Array.isArray(p.connectionIntents) ? p.connectionIntents.filter(Boolean) : []
  const posts = Array.isArray(ghc.posts) ? ghc.posts : []
  const [editOpen, setEditOpen] = useState(false)
  const [photoSheet, setPhotoSheet] = useState<PhotoTarget>(null)

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

  const openEdit = useCallback(() => setEditOpen(true), [])

  const handleSave = useCallback(
    (updates: Partial<Profile>) => {
      try {
        ghc.updateProfile?.(updates)
        ghc.addToast?.("Profile updated", "success")
      } catch {
        ghc.addToast?.("Could not save profile", "error")
      }
    },
    [ghc]
  )

  const pickImage = useCallback(
    (kind: "photo" | "cover") => {
      setPhotoSheet(null)
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
              ghc.addToast?.("Profile photo updated", "success")
            } else {
              ghc.updateProfile?.({ coverPhoto: dataUrl })
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
    const text = `${name} · ${ghDisplay} on GreenHaven`
    try {
      if (navigator.share) {
        await navigator.share({ title: "GreenHaven Profile", text })
        return
      }
      await navigator.clipboard.writeText(text)
      ghc.addToast?.("Profile link copied", "success")
    } catch {
      ghc.addToast?.("Share profile", "info")
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground contain-content">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-border/40 px-3 pb-1.5 pt-[max(0.35rem,env(safe-area-inset-top))]">
        <h1 className="text-base font-bold tracking-tight">Profile</h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onOpenWallet?.()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
            aria-label="Wallet"
          >
            <Wallet size={18} />
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      <div
        className="gh-scroll-root gh-scroll-stable min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* COVER — full width, tap to change */}
        <button
          type="button"
          onClick={() => setPhotoSheet("cover")}
          className="relative block h-[7.5rem] w-full overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 sm:h-36"
          aria-label="Change cover photo"
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Camera size={12} />
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
              <span className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-emerald-600 text-white shadow-md">
                <Camera size={14} />
              </span>
            </button>

            <div className="mb-1 flex gap-2">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[12px] font-bold text-white shadow-sm"
              >
                <Pencil size={13} />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => void shareProfile()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[12px] font-bold text-foreground"
              >
                <Share2 size={13} />
                Share
              </button>
            </div>
          </div>

          {/* Name block — full width under avatar (not side-shifted) */}
          <div className="mt-3 w-full">
            <h2 className="flex flex-wrap items-center gap-1.5 text-[1.35rem] font-black tracking-tight text-foreground">
              <span>{name}</span>
              {p.verified ? (
                <BadgeCheck size={18} className="shrink-0 text-sky-600" aria-label="Verified" />
              ) : null}
            </h2>
            <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">{handle}</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
              {ghDisplay}
            </p>
            {locationLine ? (
              <p className="mt-1 text-[12px] text-muted-foreground">📍 {locationLine}</p>
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

            {/* Stats */}
            <div className="mt-3 flex gap-4">
              {[
                { label: "Posts", value: posts.length },
                { label: "Friends", value: Array.isArray(ghc.friends) ? ghc.friends.length : 0 },
                { label: "Following", value: Array.isArray(ghc.following) ? ghc.following.length : 0 },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-[15px] font-black tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GH ID card */}
        <div className="mt-4 w-full px-4">
          <SignatureGhIdCard
            userId={meId}
            displayName={name}
            onToast={ghc.addToast}
          />
        </div>

        {intents.length > 0 ? (
          <section className="mt-4 w-full px-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Looking for
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {intents.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                >
                  {i}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-4 w-full px-4">
          <IdentityLayersStrip
            userId={meId}
            onOpenWallet={onOpenWallet}
            onOpenMembership={() => {
              try {
                window.dispatchEvent(new CustomEvent("ghc:open-membership", { detail: {} }))
              } catch {
                /* */
              }
            }}
          />
        </div>

        <section className="mt-4 w-full px-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Interests
          </p>
          {interests.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground"
                >
                  {i}
                </span>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={openEdit}
              className="mt-1.5 w-full rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-left text-[12px] text-muted-foreground"
            >
              Add interests so Discover can recommend better matches.
            </button>
          )}
        </section>

        <section className="mt-4 w-full px-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Posts
            </p>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {posts.length}
            </span>
          </div>
          {posts.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                } catch {
                  /* */
                }
              }}
              className="mt-1.5 w-full rounded-xl border border-dashed border-border bg-card px-3 py-4 text-center"
            >
              <p className="text-[13px] font-bold text-foreground">Nothing here yet</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Share a thought, photo, or win with your network.
              </p>
            </button>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {posts.slice(0, 4).map((post, idx) => {
                const body = String(post.content || post.text || "").trim()
                const preview =
                  body
                    .replace(/^📊\s*POLL[^\n]*\n?/i, "Poll · ")
                    .replace(/^🏆\s*CHALLENGE[^\n]*\n?/i, "Challenge · ")
                    .slice(0, 140) || "Shared a post"
                return (
                  <li
                    key={post.id || idx}
                    className="rounded-xl border border-border/70 bg-card px-3 py-2.5"
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
                  </li>
                )
              })}
            </ul>
          )}
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
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl"
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
