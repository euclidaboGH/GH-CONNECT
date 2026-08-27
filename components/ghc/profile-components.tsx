"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Camera,  Share2, MoreVertical, X, Edit2, Lock, HelpCircle, Eye, EyeOff, Heart, MessageCircle } from "lucide-react"
import type { Post, Profile } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"
import { EnhancedPostCard } from "./enhanced-post-card"
import { LocationPicker } from "./location-picker"
import { parseLegacyLocation, legacyCityCountry, type StructuredLocation, type LocationPrivacyLevel } from "@/lib/geography"

// Calculate profile completion percentage from real fields only
// Fields: displayName (valid), bio, age/birthDate, city+country, education, profession, ≥1 interest, profile photo (not placeholder), cover photo (not placeholder), verification
export function calculateProfileCompletion(profile: Profile | null | undefined | Record<string, unknown>): { percentage: number; missing: string[] } {
  const missing: string[] = []
  let completed = 0
  const total = 10
  if (!profile || typeof profile !== "object") {
    return { percentage: 0, missing: ["Display name", "Bio", "Photo", "Location", "Interests"] }
  }

  // 1. Display name (valid - not just placeholder)
  if (profile.displayName && profile.displayName.trim().length > 2 && profile.displayName !== "User") {
    completed++
  } else {
    missing.push("Display name")
  }

  // 2. Bio (not empty, meaningful length)
  if (profile.bio && profile.bio.trim().length >= 20) {
    completed++
  } else {
    missing.push("Bio")
  }

  // 3. Birth date / Age (not empty)
  if (profile.bornDate && profile.bornDate.toString().trim().length > 0) {
    completed++
  } else {
    missing.push("Birth date")
  }

  // 4. City + Country (both present)
  const hasCity = profile.city && profile.city.toString().trim().length > 0
  const hasCountry = profile.country && profile.country.toString().trim().length > 0
  if (hasCity && hasCountry) {
    completed++
  } else {
    missing.push("Location (city & country)")
  }

  // 5. Education (not empty)
  if (profile.education && profile.education.toString().trim().length > 0) {
    completed++
  } else {
    missing.push("Education")
  }

  // 6. Profession (not empty)
  if (profile.profession && profile.profession.toString().trim().length > 0) {
    completed++
  } else {
    missing.push("Profession")
  }

  // 7. At least 1 interest
  if (profile.interests && Array.isArray(profile.interests) && profile.interests.length >= 3) {
    completed++
  } else {
    missing.push("Interests (at least 3)")
  }

  // 8. Profile photo (not placeholder)
  const hasProfilePhoto = profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0 && 
                          profile.photos[0] && 
                          profile.photos[0] !== "/placeholder.svg?width=80&height=80" &&
                          !profile.photos[0]?.includes("placeholder")
  if (hasProfilePhoto) {
    completed++
  } else {
    missing.push("Profile photo")
  }

  // 9. Cover photo (not placeholder)
  const hasCoverPhoto = profile.coverPhoto && 
                        profile.coverPhoto.toString().trim().length > 0 &&
                        profile.coverPhoto !== "/placeholder.svg?width=400&height=150" &&
                        !profile.coverPhoto?.includes("placeholder")
  if (hasCoverPhoto) {
    completed++
  } else {
    missing.push("Cover photo")
  }

  // 10. Verification
  if (profile.verified === true) {
    completed++
  } else {
    missing.push("Verification")
  }

  const percentage = Math.round((completed / total) * 100)
  return { percentage, missing }
}

// Profile Completion Ring with animated percentage
export function ProfileCompletionRing({ percentage = 75, hasAchievements = false, profilePhoto = "" }: { percentage?: number; hasAchievements?: boolean; profilePhoto?: string }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  
  // Get first photo from profile or use placeholder
  const avatarSrc = profilePhoto || "/avatars/user.svg"

  return (
    <div className="relative h-[92px] w-[92px]">
      {/* Achievement badge if verified */}
      {hasAchievements && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-sm">
          ⭐
        </div>
      )}
      
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#gradientRing)"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        <defs>
          <linearGradient id="gradientRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <LazyImage src={avatarSrc} alt="Avatar" className="h-[76px] w-[76px] rounded-full border-[3px] border-white object-cover shadow-sm" />
      </div>
      
      {/* Percentage text */}
      <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
        {percentage}%
      </div>
    </div>
  )
}

// Profile Completion Card — progressive disclosure: compact next-step by default when ≥60%
export function ProfileCompletionCard({
  percentage,
  missing,
  onCompleteClick,
  onAddCover,
}: {
  percentage: number
  missing: string[]
  onCompleteClick: () => void
  onAddCover?: () => void
}) {
  if (percentage === 100) return null

  // Default collapsed when profile is already meaningfully filled (reduces noise)
  const [expanded, setExpanded] = useState(percentage < 60)

  // Ordered journey — not a long unordered missing dump
  const JOURNEY: { id: string; label: string; match: RegExp; action: "cover" | "edit"; reward?: string }[] = [
    { id: "photo", label: "Add a profile photo", match: /profile photo|photo/i, action: "edit", reward: "+5 GHC" },
    { id: "bio", label: "Write a short bio", match: /^bio$/i, action: "edit", reward: "+5 GHC" },
    { id: "education", label: "Add education", match: /education/i, action: "edit", reward: "+3 GHC" },
    { id: "interests", label: "Pick interests", match: /interest/i, action: "edit", reward: "+3 GHC" },
    { id: "location", label: "Add location", match: /location|city/i, action: "edit", reward: "+3 GHC" },
    { id: "profession", label: "Add profession", match: /profession/i, action: "edit", reward: "+3 GHC" },
    { id: "cover", label: "Add a cover photo", match: /cover/i, action: "cover", reward: "+5 GHC" },
    { id: "name", label: "Set display name", match: /display name|name/i, action: "edit" },
    { id: "birth", label: "Add birth date", match: /birth/i, action: "edit" },
    { id: "verify", label: "Get verified (optional)", match: /verif/i, action: "edit" },
  ]

  const steps = JOURNEY.filter((step) => missing.some((m) => step.match.test(m))).slice(0, 4)

  const displaySteps =
    steps.length > 0
      ? steps
      : missing.slice(0, 3).map((m, i) => ({
          id: `m-${i}`,
          label: m,
          match: /.*/,
          action: (/cover/i.test(m) ? "cover" : "edit") as "cover" | "edit",
          reward: undefined as string | undefined,
        }))

  const next = displaySteps[0]
  if (!next) return null

  const runStep = (step: (typeof displaySteps)[0]) => {
    if (step.action === "cover" && onAddCover) onAddCover()
    else onCompleteClick()
  }

  // Compact collapsed view — one next action + progress
  if (!expanded) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-3 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-teal-950/30">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 text-left"
          aria-expanded={false}
        >
          <div className="relative h-10 w-10 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#d1fae5" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#059669"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(percentage / 100) * 94} 94`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-700">
              {percentage}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-foreground">Next: {next.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {displaySteps.length} step{displaySteps.length === 1 ? "" : "s"} left
              {next.reward ? ` · ${next.reward}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">
            Expand
          </span>
        </button>
        <button
          type="button"
          onClick={() => runStep(next)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          {next.label}
          {next.reward ? <span className="text-[11px] font-semibold text-emerald-100">{next.reward}</span> : null}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-teal-950/30">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">Profile journey</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {percentage}% complete · one step at a time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-emerald-700">{percentage}%</div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-stone-600 ring-1 ring-border"
            aria-expanded={true}
          >
            Collapse
          </button>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      <ol className="space-y-2">
        {displaySteps.map((step, idx) => {
          const isNext = idx === 0
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => runStep(step)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  isNext
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white/80 text-foreground ring-1 ring-border dark:bg-card/80"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isNext ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{step.label}</span>
                {step.reward ? (
                  <span className={`text-[11px] font-bold ${isNext ? "text-emerald-100" : "text-emerald-700"}`}>
                    {step.reward}
                  </span>
                ) : (
                  <span className={`text-[11px] font-bold ${isNext ? "text-white/90" : "text-emerald-700"}`}>
                    {isNext ? "Do this" : "Next"}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <p className="text-[11px] text-muted-foreground">
        Tip: finish <strong className="text-foreground">{next.label}</strong> first — stronger profiles get better discovery.
      </p>
    </div>
  )
}


export function ProfileHeaderActions({ onShare, onMoreClick, onEditCover }: { onShare: () => void; onMoreClick: () => void; onEditCover?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onShare}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-sm backdrop-blur transition hover:bg-white active:scale-95"
        title="Share profile"
        aria-label="Share profile"
      >
        <Share2 size={18} />
      </button>
      <button
        type="button"
        onClick={onMoreClick}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-sm backdrop-blur transition hover:bg-white active:scale-95"
        title="More profile actions"
        aria-label="More profile actions"
      >
        <MoreVertical size={18} />
      </button>
    </div>
  )
}

/**
 * Profile ⋮ menu — profile shortcuts only.
 * App Settings (Privacy, Help, Account, Wallet…) live on the gear ⚙️ icon — do not duplicate them here.
 */
export function MoreOptionsMenu({
  isOpen,
  onClose,
  onEditProfile,
  onWritePost,
  onShareProfile,
  onCopyLink,
  onPreview,
  onChangeCover,
}: {
  isOpen: boolean
  onClose: () => void
  onEditProfile?: () => void
  onWritePost?: () => void
  onShareProfile?: () => void
  onCopyLink?: () => void
  onPreview?: () => void
  onChangeCover?: () => void
}) {
  if (!isOpen) return null

  const item = (
    label: string,
    onClick: (() => void) | undefined,
    icon: ReactNode,
    hint?: string
  ) => {
    if (!onClick) return null
    return (
      <button
        type="button"
        onClick={() => {
          onClick()
          onClose()
        }}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-emerald-50/80 active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900">{label}</span>
          {hint ? <span className="block text-[11px] text-gray-500">{hint}</span> : null}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Profile actions">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-md space-y-0.5 rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl sm:px-5">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-200" aria-hidden />
        <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
          Profile
        </p>
        {item("Edit profile", onEditProfile, <span className="text-sm font-bold">✎</span>, "Name, bio, work, location")}
        {item("Write a post", onWritePost, <span className="text-sm font-bold">＋</span>, "Share an update or story")}
        {item("Change cover photo", onChangeCover, <span className="text-sm">📷</span>)}
        {item("Share profile", onShareProfile, <Share2 size={18} />)}
        {item("Copy profile link", onCopyLink, <span className="text-sm font-bold">🔗</span>)}
        {item("Preview public profile", onPreview, <span className="text-sm">👁</span>, "How others see you")}
        <p className="mx-4 mt-2 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">
          Account, privacy, wallet, notifications and help are in <span className="font-semibold text-stone-700">Settings</span> (gear icon).
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-200 active:scale-[0.99]"
        >
          <X size={18} />
          Close
        </button>
      </div>
    </div>
  )
}

// Mode Buttons (Icon-only with glow on active)
export function ModeButtons({ selectedMode, onModeChange }: { selectedMode: string; onModeChange: (mode: string) => void }) {
  const modes = [
    { value: "dating", emoji: "❤️", label: "Dating" },
    { value: "friendship", emoji: "👥", label: "Friendship" },
    { value: "networking", emoji: "💼", label: "Networking" },
  ]

  return (
    <div className="flex gap-3">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          className={`flex-1 h-12 rounded-full flex items-center justify-center text-2xl transition active:scale-90 ${
            selectedMode === mode.value
              ? "bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-pink-300/50"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title={mode.label}
        >
          {mode.emoji}
        </button>
      ))}
    </div>
  )
}

// Tappable Interests
export function InterestsPills({ interests, onEdit }: { interests: string[]; onEdit: (interests: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {interests.map((interest) => (
        <button
          key={interest}
          onClick={() => onEdit(interests.filter((i) => i !== interest))}
          className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-1 rounded-full text-sm font-semibold transition active:scale-90 flex items-center gap-2"
        >
          {interest}
          <X size={14} />
        </button>
      ))}
    </div>
  )
}

// Responsive Button Component
export function ResponsiveButton({
  variant = "primary",
  onClick,
  disabled = false,
  children,
  className = "",
}: {
  variant?: "primary" | "secondary" | "outline"
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  const baseStyles = "px-6 py-2.5 rounded-full font-bold text-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
  const variantStyles = {
    primary: "bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-lg",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border-2 border-pink-500 text-pink-500 hover:bg-pink-50",
  }

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </button>
  )
}

// Preview Public Profile Toggle
export function PreviewPublicProfileToggle({ isEnabled, onToggle }: { isEnabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!isEnabled)}
      className="flex items-center gap-3 w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition active:scale-95"
    >
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900">Preview Public Profile</p>
        <p className="text-sm text-gray-600">See how others view your profile</p>
      </div>
      {isEnabled ? <Eye size={20} className="text-purple-600" /> : <EyeOff size={20} className="text-gray-400" />}
    </button>
  )
}

// Own Posts Only Card
/** Own posts on Profile — same capabilities as Feed for the post owner */
export function OwnPostCard({
  post,
  onDelete,
  isLiked = false,
  onLike,
  onComment,
  onShare,
  onEdit,
  onArchive,
  onInsights,
}: {
  post: Post
  onDelete: (postId: string) => void
  isLiked?: boolean
  onLike?: (postId: string) => void
  onComment?: (postId: string) => void
  onShare?: (postId: string) => void
  onEdit?: (postId: string, content: string) => void
  onArchive?: (postId: string) => void
  onInsights?: (postId: string) => void
}) {
  return (
    <EnhancedPostCard
      post={post}
      isLiked={isLiked}
      isOwnPost
      onLike={onLike}
      onComment={() => onComment?.(post.id)}
      onShare={() => onShare?.(post.id)}
      onDelete={onDelete}
      onEdit={onEdit}
      onArchive={onArchive}
      onInsights={onInsights}
    />
  )
}

// Profile Edit Modal
export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
  onChangeCover,
  onChangePhoto,
}: {
  isOpen: boolean
  onClose: () => void
  profile: Profile
  onSave: (updates: Partial<Profile>) => void
  onChangeCover?: () => void
  onChangePhoto?: () => void
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [profession, setProfession] = useState(profile.profession || "")
  const [education, setEducation] = useState(profile.education || "")
  const [hometown, setHometown] = useState(profile.hometown || "")
  const [bornDate, setBornDate] = useState(profile.bornDate || "")
  const [city, setCity] = useState(profile.city || "")
  const [country, setCountry] = useState(profile.country || "")
  const [homeLoc, setHomeLoc] = useState<StructuredLocation | null>(
    () => profile.homeLocation || parseLegacyLocation(profile.city || "", profile.country || "")
  )
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacyLevel>(
    profile.locationPrivacy || "locality"
  )
  const [interests, setInterests] = useState(profile.interests)
  const [newInterest, setNewInterest] = useState("")

  // Keep local form in sync when profile changes while modal is closed
  useEffect(() => {
    if (!isOpen) {
      setDisplayName(profile.displayName)
      setBio(profile.bio)
      setProfession(profile.profession || "")
      setEducation(profile.education || "")
      setHometown(profile.hometown || "")
      setBornDate(profile.bornDate || "")
      setCity(profile.city || "")
      setCountry(profile.country || "")
      setHomeLoc(profile.homeLocation || parseLegacyLocation(profile.city || "", profile.country || ""))
      setLocationPrivacy(profile.locationPrivacy || "locality")
      setInterests(profile.interests || [])
    }
  }, [profile, isOpen])

  if (!isOpen) return null

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()])
      setNewInterest("")
    }
  }

  const handleSave = () => {
    onSave({
      displayName,
      bio,
      profession,
      education,
      hometown,
      bornDate,
      city,
      country,
      homeLocation: homeLoc,
      locationPrivacy,
      interests,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full bg-white rounded-t-3xl px-5 py-5 max-h-[85vh] overflow-y-auto space-y-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {(onChangeCover || onChangePhoto) && (
          <div className="grid grid-cols-2 gap-2">
            {onChangePhoto && (
              <button
                type="button"
                onClick={() => {
                  onChangePhoto()
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-800 hover:bg-white"
              >
                Change photo
              </button>
            )}
            {onChangeCover && (
              <button
                type="button"
                onClick={() => {
                  onChangeCover()
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-800 hover:bg-white"
              >
                Change cover
              </button>
            )}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Your name"
            maxLength={60}
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
            placeholder="Tell people about yourself..."
            maxLength={500}
          />
        </div>

        {/* About details — systematic like Facebook */}
        <div className="space-y-3 rounded-2xl bg-gray-50 p-3.5 ring-1 ring-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">About details</p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Work / Profession</label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Software Engineer"
              maxLength={80}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Education</label>
            <input
              type="text"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. University of Lagos"
              maxLength={100}
            />
          </div>
          <div className="rounded-xl border border-stone-100 bg-white p-2">
            <p className="mb-2 text-xs font-semibold text-gray-600">Home location</p>
            <LocationPicker
              variant="light"
              idPrefix="edit-profile"
              value={homeLoc}
              privacy={locationPrivacy}
              showPrivacy
              onPrivacyChange={setLocationPrivacy}
              onChange={(loc) => {
                setHomeLoc(loc)
                const leg = legacyCityCountry(loc)
                setCity(leg.city)
                setCountry(leg.country)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Hometown</label>
            <input
              type="text"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Where you're from"
              maxLength={80}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Birthday</label>
            <input
              type="text"
              value={bornDate}
              onChange={(e) => setBornDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. 26 February 1995"
              maxLength={40}
            />
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Interests</label>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddInterest()}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Add an interest"
              maxLength={30}
            />
            <button
              type="button"
              onClick={handleAddInterest}
              className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-700 active:scale-90"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => setInterests(interests.filter((i) => i !== interest))}
                className="flex items-center gap-1 rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700 transition hover:bg-pink-200 active:scale-90"
              >
                {interest}
                <X size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2 pb-2">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 font-bold text-white transition active:scale-95"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-900 transition hover:bg-gray-200 active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// Achievements Section
export function AchievementsSection({ verified = false, completionPercentage = 75 }: { verified?: boolean; completionPercentage?: number }) {
  const achievements = [
    { icon: "✓", label: "Profile Complete", unlocked: completionPercentage >= 75, description: "75% profile completion" },
    { icon: "✨", label: "Verified", unlocked: verified, description: "Account verified" },
    { icon: "❤️", label: "Social Butterfly", unlocked: false, description: "100+ followers" },
    { icon: "🎯", label: "Networking Pro", unlocked: false, description: "10 meaningful connections" },
  ]

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Achievements</p>
      <div className="grid grid-cols-4 gap-2">
        {achievements.map((achievement, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg text-center transition ${
              achievement.unlocked
                ? "bg-yellow-50 border border-yellow-300"
                : "bg-gray-100 border border-gray-300 opacity-50"
            }`}
            title={achievement.description}
          >
            <div className="text-2xl mb-1">{achievement.icon}</div>
            <p className="text-xs font-bold text-gray-900">{achievement.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Social Links Section
export function SocialLinksSection({ 
  socialLinks = {},
  onAddLink,
  onRemoveLink 
}: { 
  socialLinks?: Record<string, string>
  onAddLink?: (platform: string, url: string) => void
  onRemoveLink?: (platform: string) => void
}) {
  const platforms = ["instagram", "twitter", "linkedin", "facebook"]
  
  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Social Links</p>
      <div className="space-y-2">
        {platforms.map((platform) => (
          <div key={platform} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <span className="text-xl">
              {platform === "instagram" && "📷"}
              {platform === "twitter" && "🐦"}
              {platform === "linkedin" && "💼"}
              {platform === "facebook" && "👤"}
            </span>
            <span className="text-sm font-semibold text-gray-700 capitalize flex-1">{platform}</span>
            {socialLinks?.[platform] ? (
              <button
                onClick={() => onRemoveLink?.(platform)}
                className="text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 transition"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={() => onAddLink?.(platform, "")}
                className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
              >
                Add
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Activity History Section
export function ActivityHistorySection({ activities = [] }: { activities?: Array<{ type: string; description: string; timestamp: number }> }) {
  const recentActivities = activities.slice(0, 5)
  
  if (recentActivities.length === 0) {
    return (
      <div className="px-4 py-4 border-t border-gray-200">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Recent Activity</p>
        <div className="text-center py-4 text-gray-500 text-sm">No recent activity</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Recent Activity</p>
      <div className="space-y-2">
        {recentActivities.map((activity, idx) => (
          <div key={idx} className="text-sm p-2 bg-gray-50 rounded-lg">
            <p className="font-semibold text-gray-900">{activity.description}</p>
            <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Privacy Controls Section
export function PrivacyControlsSection({
  profileVisibility = "everyone",
  onVisibilityChange,
}: {
  profileVisibility?: "everyone" | "matches-only" | "hidden"
  onVisibilityChange?: (visibility: string) => void
}) {
  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Privacy</p>
      <div className="space-y-2">
        {(["everyone", "matches-only", "hidden"] as const).map((visibility) => (
          <label key={visibility} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="radio"
              name="visibility"
              value={visibility}
              checked={profileVisibility === visibility}
              onChange={() => onVisibilityChange?.(visibility)}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-900 capitalize">{visibility.replace("-", " ")}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Saved Posts Section
export function SavedPostsSection({ savedCount = 0, onViewSaved }: { savedCount?: number; onViewSaved?: () => void }) {
  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <button
        onClick={onViewSaved}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition active:scale-95"
      >
        <div className="text-left">
          <p className="font-semibold text-gray-900">Saved Posts</p>
          <p className="text-sm text-gray-600">{savedCount} posts saved</p>
        </div>
        <span className="text-2xl">💾</span>
      </button>
    </div>
  )
}

// Profile QR Code Share
export function ProfileQRCode({ profileUrl = "" }: { profileUrl?: string }) {
  return (
    <div className="p-6 bg-gray-50 rounded-lg text-center">
      <p className="text-sm font-semibold text-gray-900 mb-3">Share via QR Code</p>
      {/* Placeholder for QR code - in production would use qrcode library */}
      <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded-lg mx-auto flex items-center justify-center">
        <span className="text-4xl">📱</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">Scan to view profile</p>
    </div>
  )
}

// Expandable Bio with See More
export function ExpandableBio({ bio = "" }: { bio?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!bio) return null
  
  const isLong = bio.length > 120
  const displayBio = expanded ? bio : bio.substring(0, 120)
  
  return (
    <div>
      <p className={`text-sm leading-6 text-gray-700 ${!expanded ? "line-clamp-3" : ""}`}>
        {displayBio}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 rounded-full px-2 py-1 text-xs font-bold text-purple-600 transition hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          aria-expanded={expanded}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  )
}

// Profile Stats Row (Posts and Following)
export function ProfileStatsRow({ postsCount = 0, followingCount = 0 }: { postsCount?: number; followingCount?: number }) {
  return (
    <div className="flex gap-4 mb-4">
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-gray-600">Posts</span>
        <span className="font-bold text-gray-900">{postsCount}</span>
      </div>
      <div className="w-px bg-gray-200"></div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-gray-600">Following</span>
        <span className="font-bold text-gray-900">{followingCount}</span>
      </div>
    </div>
  )
}
