"use client"

import { useState, useEffect } from "react"
import { ageFromBornDate, isAdultFromBornDate, maxBornDateForMinAge } from "@/lib/age-utils"
import { useGHC } from "@/contexts/ghc-context"
import { INTERESTS } from "@/lib/ghc-data"
import { compressForAvatar } from "@/lib/media/compress-image"
import type { OnboardingStep, Gender, PrimaryMode } from "@/lib/ghc-types"
import {
  Heart,
  Users,
  Briefcase,
  Plus,
  X,
  Sparkles,
  Camera,
  MessageCircle,
  TrendingUp,
  Shield,
  Image as ImageIcon,
  Rocket,
  Check,
  ChevronLeft,
} from "lucide-react"
import { BrandLogo } from "./brand-logo"
import { LazyImage } from "./lazy-image"
import { LocationPicker } from "./location-picker"
import {
  legacyCityCountry,
  parseLegacyLocation,
  type StructuredLocation,
} from "@/lib/geography"

const INTEREST_ICONS: Record<string, string> = {
  Reading: "📚",
  Gaming: "🎮",
  Cooking: "🍳",
  Photography: "📷",
  Fitness: "💪",
  Fashion: "👗",
  Food: "🍔",
  Music: "🎵",
  Travel: "✈️",
  Sports: "⚽",
  Tech: "💻",
  Finance: "💰",
  Healthcare: "🏥",
  Education: "🎓",
  Arts: "🎨",
  Entrepreneurship: "🚀",
  Wellness: "🧘",
  Nature: "🌿",
  Volunteering: "🤝",
  Pets: "🐾",
  Spirituality: "✨",
  Writing: "✍️",
}

/** Premium dark shell — deep green-black with soft emerald glow */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#050a08] text-white">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-teal-400/10 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[80px]" />
      {/* Subtle grid / world texture hint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(16,185,129,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(52,211,153,0.2) 0%, transparent 40%)",
        }}
      />
      {children}
    </div>
  )
}

function BrandHeader({ showBack, onBack }: { showBack?: boolean; onBack?: () => void }) {
  return (
    <div className="relative z-10 flex items-center justify-between px-4 pb-1 pt-[max(0.65rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-emerald-300 ring-1 ring-white/10 transition hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <BrandLogo size="bar" className="object-left drop-shadow-[0_0_18px_rgba(16,185,129,0.35)]" />
      </div>
    </div>
  )
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2.5" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 === current
              ? "w-7 bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
              : i + 1 < current
                ? "w-3 bg-emerald-500/70"
                : "w-1.5 bg-white/15"
          }`}
        />
      ))}
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 px-6 text-[15px] font-bold text-white shadow-[0_8px_28px_rgba(16,185,129,0.35)] transition active:scale-[0.98] disabled:from-gray-600 disabled:via-gray-600 disabled:to-gray-600 disabled:shadow-none disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-[15px] font-bold text-white/90 backdrop-blur transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-40"
    >
      {children}
    </button>
  )
}

const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white shadow-inner outline-none transition placeholder:text-white/35 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/25"

export function Onboarding() {
  const { profile, updateProfile, completeOnboarding } = useGHC()
  const safeProfile = profile || ({} as typeof profile)
  const [phase, setPhase] = useState<"splash" | "welcome" | "flow">("splash")

  useEffect(() => {
    if (phase !== "splash") return
    const timer = window.setTimeout(() => setPhase("welcome"), 3000)
    return () => window.clearTimeout(timer)
  }, [phase])
  const [step, setStep] = useState<OnboardingStep>(1)
  const [formData, setFormData] = useState({
    displayName: safeProfile.displayName || "",
    age: safeProfile.age || 18,
    bornDate: (safeProfile as any).bornDate || "",
    gender: safeProfile.gender || "prefer-not-to-say",
    city: safeProfile.city || "",
    country: safeProfile.country || "",
    state: "",
    structuredLocation: (safeProfile.city || safeProfile.country
      ? parseLegacyLocation(safeProfile.city || "", safeProfile.country || "")
      : null) as StructuredLocation | null,
    bio: safeProfile.bio || "",
    primaryMode: safeProfile.primaryMode || "friends",
    interests: safeProfile.interests || [],
    photos: safeProfile.photos || [],
  })
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [finishing, setFinishing] = useState(false)

  const validateStep = () => {
    const nextErrors: Record<string, string> = {}
    const cleanName = formData.displayName.trim().replace(/\s+/g, " ")
    const cleanCity = formData.city.trim().replace(/\s+/g, " ")
    const cleanCountry = formData.country.trim()
    const cleanState = formData.state.trim()
    const cleanBio = formData.bio.trim().replace(/\s+/g, " ")
    const looksLikeWords = (value: string) => /^[\p{L}][\p{L}\s'.-]*$/u.test(value)
    const hasMeaningfulText = (value: string, min: number) =>
      value.length >= min && new Set(value.toLowerCase().split(/\s+/)).size > 1 && !/(.)\1{4,}/u.test(value)

    if (step === 1) {
      if (cleanName.length < 2 || cleanName.length > 60 || !looksLikeWords(cleanName) || !hasMeaningfulText(cleanName, 2))
        nextErrors.displayName = "Use your real name with letters and spaces."
      const derived = formData.bornDate ? ageFromBornDate(formData.bornDate) : null
      const ageNum = derived !== null ? derived : Number(formData.age)
      if (formData.bornDate && !isAdultFromBornDate(formData.bornDate)) nextErrors.age = "You must be at least 18 years old."
      else if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 120) nextErrors.age = "You must be 18–120 years old."
      if (
        !formData.structuredLocation?.countryId ||
        !formData.structuredLocation?.admin1Id ||
        !(formData.structuredLocation?.localityName || formData.structuredLocation?.admin2Name || formData.city)
      ) {
        nextErrors.location = "Select your country, region, and city or town."
      }
    }
    if (step === 3 && formData.interests.length < 3) nextErrors.interests = "Choose at least 3 interests."
    if (step === 4 && formData.photos.length < 1) nextErrors.photos = "Add a profile photo to continue."
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = async () => {
    if (!validateStep()) return
    if (step === 1) {
      await updateProfile({
        displayName: formData.displayName.trim().replace(/\s+/g, " "),
        age: formData.bornDate ? (ageFromBornDate(formData.bornDate) ?? formData.age) : formData.age,
        bornDate: formData.bornDate,
        gender: formData.gender as Gender,
        city: formData.city.trim().replace(/\s+/g, " "),
        country: formData.country.trim(),
        homeLocation: formData.structuredLocation || null,
        locationPrivacy: "locality",
        bio: formData.bio.trim().replace(/\s+/g, " "),
      })
      setStep(2)
    } else if (step === 2) {
      await updateProfile({ primaryMode: formData.primaryMode as PrimaryMode })
      setStep(3)
    } else if (step === 3) {
      await updateProfile({ interests: formData.interests })
      setStep(4)
    } else if (step === 4) {
      await updateProfile({ photos: formData.photos })
      setStep(5)
    } else if (step === 5) {
      setFinishing(true)
      try {
        await updateProfile({
          photos: formData.photos,
          city: formData.city,
          country: formData.country,
          homeLocation: formData.structuredLocation || null,
          locationPrivacy: "locality",
          bio: formData.bio,
          interests: formData.interests,
          displayName: formData.displayName.trim().replace(/\s+/g, " "),
        })
        await completeOnboarding()
      } finally {
        setFinishing(false)
      }
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || formData.photos.length >= 6) return
    setUploading(true)
    try {
      const compressed = await compressForAvatar(file)
      setFormData((p) => ({ ...p, photos: [...p.photos, compressed] }))
      setErrors((p) => ({ ...p, photos: "" }))
    } catch (err) {
      console.error("[onboarding] Photo upload failed:", err)
      setErrors((p) => ({
        ...p,
        photos: err instanceof Error ? err.message : "Could not process photo. Try another image.",
      }))
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (index: number) => {
    setFormData((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== index) }))
  }

  /* ───────────── SPLASH (3s) ───────────── */
  if (phase === "splash") {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18)_0%,transparent_60%)]" />
        <div className="pointer-events-none absolute -left-16 top-24 h-56 w-56 rounded-full bg-emerald-500/20 blur-[90px]" />
        <div className="pointer-events-none absolute -right-12 bottom-32 h-48 w-48 rounded-full bg-teal-400/15 blur-[80px]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 scale-110 rounded-full bg-emerald-400/20 blur-3xl" />
            <BrandLogo size="hero" priority className="relative drop-shadow-[0_0_40px_rgba(16,185,129,0.45)]" />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
            Connect · Share · Grow
          </p>
          <div
            className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-400"
            role="status"
            aria-label="Loading"
          />
        </div>
      </div>
    )
  }

  /* ───────────── WELCOME ───────────── */
  if (phase === "welcome") {
    return (
      <Shell>
        <div className="pt-[max(0.75rem,env(safe-area-inset-top))]" aria-hidden />
        <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-4">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            {/* Centered official logo — transparent, no plate */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="relative mb-1">
                <div className="absolute inset-0 scale-125 rounded-full bg-emerald-400/15 blur-3xl" />
                <BrandLogo size="hero" priority className="relative drop-shadow-[0_0_32px_rgba(16,185,129,0.4)]" />
              </div>
              <h1 className="mt-2 text-[1.65rem] font-black leading-tight tracking-tight text-white">
                A better way to{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                  connect and grow
                </span>
              </h1>
              <p className="mx-auto mt-2.5 max-w-[18rem] text-[13px] leading-relaxed text-white/55">
                Meet people. Share ideas. Build meaningful connections.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: Users, title: "Connect", desc: "Meet amazing people and communities" },
                { icon: MessageCircle, title: "Share", desc: "Post, story, chat and more" },
                { icon: TrendingUp, title: "Grow", desc: "Learn, create and achieve more" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3.5 rounded-2xl border border-white/8 bg-white/[0.04] p-3.5 backdrop-blur-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">{item.title}</p>
                    <p className="text-[12px] text-white/45">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-3 pt-8">
              <PrimaryButton onClick={() => setPhase("flow")}>
                Get Started <Rocket size={18} />
              </PrimaryButton>
              <p className="text-center text-[12px] text-white/40">
                Already have an account?{" "}
                <span className="font-semibold text-emerald-400">Sign in</span>
              </p>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  /* ───────────── FLOW STEPS ───────────── */
  return (
    <Shell>
      <BrandHeader
        showBack={step > 1}
        onBack={() => setStep((s) => (s > 1 ? ((s - 1) as OnboardingStep) : 1))}
      />
      <StepDots current={step} total={5} />

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mx-auto w-full max-w-md">
          {/* STEP 1 — Profile */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <h1 className="text-[1.45rem] font-black tracking-tight text-white">Let&apos;s set up your profile</h1>
                <p className="mt-1 text-[13px] text-white/50">Tell us a little about yourself</p>
              </div>

              {/* Live profile preview */}
              <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white ring-2 ring-emerald-400/30">
                    {formData.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formData.photos[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (formData.displayName || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{formData.displayName || "Your name"}</p>
                    <p className="truncate text-[11px] text-white/50">
                      {[formData.city, formData.country].filter(Boolean).join(", ") || "Location"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 rounded-3xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-white/60">Display Name *</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="Your name"
                    maxLength={60}
                    autoComplete="name"
                    className={fieldClass}
                  />
                  {errors.displayName && <p className="mt-1 text-xs text-rose-400">{errors.displayName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-white/60">Date of birth *</label>
                    <input
                      type="date"
                      max={maxBornDateForMinAge(18)}
                      value={formData.bornDate}
                      onChange={(e) => {
                        const bornDate = e.target.value
                        const derived = ageFromBornDate(bornDate)
                        setFormData((p) => ({ ...p, bornDate, age: derived !== null ? derived : p.age }))
                        setErrors((p) => ({ ...p, age: "" }))
                      }}
                      className={`${fieldClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-white/60">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value as Gender }))}
                      className={`${fieldClass} [color-scheme:dark]`}
                    >
                      <option value="prefer-not-to-say">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non-binary">Non-binary</option>
                    </select>
                  </div>
                </div>
                {errors.age && <p className="text-xs text-rose-400">{errors.age}</p>}
                {formData.bornDate && (
                  <p className="text-[11px] text-white/40">
                    Age for discovery:{" "}
                    <strong className="text-emerald-300">{ageFromBornDate(formData.bornDate) ?? "—"}</strong> (private)
                  </p>
                )}

                <div>
                  <p className="mb-2 text-[12px] font-bold text-white/60">Location *</p>
                  <LocationPicker
                    variant="dark"
                    idPrefix="onboard"
                    value={formData.structuredLocation}
                    requireLocality
                    showPrivacy={false}
                    onChange={(loc) => {
                      const legacy = legacyCityCountry(loc)
                      setFormData((p) => ({
                        ...p,
                        structuredLocation: loc,
                        city: legacy.city,
                        country: legacy.country,
                        state: loc?.admin1Name || "",
                      }))
                      setErrors((p) => ({ ...p, location: "" }))
                    }}
                  />
                  {errors.location && <p className="mt-1.5 text-xs text-rose-400">{errors.location}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-white/60">
                    Bio (optional) · {formData.bio.length}/500
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, bio: e.target.value.slice(0, 500) }))
                      setErrors((p) => ({ ...p, bio: "" }))
                    }}
                    placeholder="Tell us about yourself…"
                    maxLength={500}
                    rows={3}
                    className={`${fieldClass} min-h-[88px] resize-none`}
                  />
                  {errors.bio && <p className="mt-1 text-xs text-rose-400">{errors.bio}</p>}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3.5 py-2.5 text-[11px] text-emerald-200/90">
                <Shield size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                Your information helps us connect you with the right people and communities.
              </div>
            </div>
          )}

          {/* STEP 2 — Mode */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <h1 className="text-[1.45rem] font-black tracking-tight text-white">What brings you here?</h1>
                <p className="mt-1 text-[13px] text-white/50">Choose your primary mode</p>
              </div>
              <div className="space-y-3">
                {[
                  { value: "dating", label: "Dating", desc: "Looking for romance", icon: Heart, accent: "from-rose-500 to-pink-500", ring: "ring-rose-400/40" },
                  { value: "friendship", label: "Friendship", desc: "Make genuine friends", icon: Users, accent: "from-violet-500 to-purple-500", ring: "ring-violet-400/40" },
                  { value: "networking", label: "Networking", desc: "Professional connections", icon: Briefcase, accent: "from-sky-500 to-blue-600", ring: "ring-sky-400/40" },
                ].map((mode) => {
                  const selected = formData.primaryMode === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, primaryMode: mode.value as PrimaryMode }))}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? `border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)] ring-1 ${mode.ring}`
                          : "border-white/8 bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${mode.accent} text-white shadow-lg`}>
                        <mode.icon size={22} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[16px] font-bold text-white">{mode.label}</p>
                        <p className="text-[13px] text-white/45">{mode.desc}</p>
                      </div>
                      {selected && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Interests */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <h1 className="text-[1.45rem] font-black tracking-tight text-white">Choose your interests</h1>
                <p className="mt-1 text-[13px] text-white/50">
                  What makes you unique? Pick at least 3
                  {formData.interests.length > 0 && (
                    <span className="ml-1 font-bold text-emerald-400">· {formData.interests.length} selected</span>
                  )}
                </p>
              </div>
              {errors.interests && <p className="text-center text-xs text-rose-400">{errors.interests}</p>}

              {Object.entries(INTERESTS).map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/35">{category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((interest) => {
                      const selected = formData.interests.includes(interest)
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => {
                            setFormData((p) => {
                              const isSelected = p.interests.includes(interest)
                              return {
                                ...p,
                                interests: isSelected
                                  ? p.interests.filter((i) => i !== interest)
                                  : [...p.interests, interest],
                              }
                            })
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
                            selected
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
                              : "border border-white/10 bg-white/[0.05] text-white/80 hover:border-emerald-400/30"
                          }`}
                        >
                          <span className="text-sm">{INTEREST_ICONS[interest] || "✨"}</span>
                          {interest}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3.5 py-2.5 text-center text-[11px] text-emerald-200/90">
                This helps us show relevant content, people and communities.
              </div>
            </div>
          )}

          {/* STEP 4 — Photos */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
                  <Camera size={26} />
                </div>
                <h1 className="text-[1.45rem] font-black tracking-tight text-white">Add photos</h1>
                <p className="mt-1 text-[13px] text-white/50">Add a profile photo. You can add up to 6 photos.</p>
                {errors.photos && <p className="mt-1 text-xs text-rose-400">{errors.photos}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formData.photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <LazyImage src={photo} alt="Profile photo" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                      aria-label="Remove photo"
                    >
                      <X size={14} />
                    </button>
                    {idx === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        Primary
                      </span>
                    )}
                  </div>
                ))}

                {formData.photos.length < 6 && (
                  <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400/35 bg-emerald-500/5 transition hover:bg-emerald-500/10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                      <Plus size={24} />
                    </div>
                    <span className="text-[13px] font-bold text-emerald-300">{uploading ? "Uploading…" : "Add photo"}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: ImageIcon, label: "High quality" },
                  { icon: Shield, label: "Secure upload" },
                  { icon: Camera, label: "Up to 6 photos" },
                  { icon: Sparkles, label: "Easy to update" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/60"
                  >
                    <f.icon size={14} className="text-emerald-400" />
                    {f.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5 — Ready */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                  <Check size={32} strokeWidth={2.5} />
                </div>
                <h1 className="text-[1.65rem] font-black tracking-tight text-white">You&apos;re all set!</h1>
                <p className="mx-auto mt-2 max-w-xs text-[14px] text-white/50">
                  Your profile is ready. Time to make meaningful connections!
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                <div className="bg-gradient-to-r from-emerald-600/80 to-teal-600/80 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Profile preview</p>
                </div>
                <div className="flex items-center gap-4 p-4">
                  {formData.photos[0] ? (
                    <LazyImage
                      src={formData.photos[0]}
                      alt=""
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-emerald-400/30"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                      <Camera size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-black text-white">
                      {formData.displayName || "You"}
                      {formData.bornDate || formData.age
                        ? `, ${formData.bornDate ? ageFromBornDate(formData.bornDate) ?? formData.age : formData.age}`
                        : ""}
                    </p>
                    <p className="truncate text-[13px] text-white/50">
                      {[formData.city, formData.country].filter(Boolean).join(", ") || "Location"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {formData.interests.slice(0, 4).map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="relative z-10 border-t border-white/8 bg-[#050a08]/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md gap-3">
          {step > 1 && step < 5 && (
            <SecondaryButton onClick={() => setStep((s) => (s - 1) as OnboardingStep)}>Back</SecondaryButton>
          )}
          {step === 1 && (
            <SecondaryButton onClick={() => setPhase("welcome")}>Back</SecondaryButton>
          )}
          <div className="flex-[1.4]">
            <PrimaryButton
              onClick={() => void handleNext()}
              disabled={(step === 3 && formData.interests.length < 3) || finishing}
            >
              {step === 5 ? (finishing ? "Starting…" : "Enter GH Connect →") : "Next →"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Shell>
  )
}
