"use client"

import { useState, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { LANGUAGES, SUPPORT_CONTACTS, LEGAL } from "@/lib/ghc-data"
import { compressForTheme } from "@/lib/media/compress-image"
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  ImagePlus,
  Check,
  Sun,
  Moon,
  Monitor,
  Search,
  Shield,
  Bell,
  Palette,
  Wallet,
  Crown,
  HelpCircle,
  Info,
  FileText,
  Gift,
  User,
  Ban,
} from "lucide-react"
import { THEME_PRESETS, type ThemeMode } from "@/lib/theme/themes"

const PremiumWalletScreen = lazy(() =>
  import("../../features/wallet/wallet-screen").then((m) => ({
    default: m.PremiumWalletScreen || m.default,
  }))
)
const PremiumMembershipScreen = lazy(() =>
  import("./premium-membership-screen").then((m) => ({
    default: m.PremiumMembershipScreen || m.default,
  }))
)
const RewardsCentreScreen = lazy(() =>
  import("./rewards-centre-screen").then((m) => ({
    default: m.RewardsCentreScreen || m.default,
  }))
)

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
      Loading {label}…
    </div>
  )
}


export type SettingsSection =
  | "main"
  | "privacy"
  | "preferences"
  | "notifications"
  | "appearance"
  | "help"
  | "legal"
  | "about"
  | "terms"
  | "privacy-policy"
  | "wallet"
  | "membership"
  | "rewards"

export function SettingsScreen({
  onBack,
  initialSection = "main",
}: {
  onBack: () => void
  /** Optional deep-link into Settings (e.g. Profile header → Wallet). */
  initialSection?: SettingsSection
}) {
  const { settings, updateSettings, logout, blockedUsers, unblockUser, candidates } = useGHC()
  const [navStack, setNavStack] = useState<SettingsSection[]>(() =>
    initialSection && initialSection !== "main" ? ["main", initialSection] : ["main"],
  )
  const section = navStack[navStack.length - 1] ?? "main"
  const setSection = useCallback((next: SettingsSection) => {
    setNavStack((prev) => {
      if (next === "main") return ["main"]
      const top = prev[prev.length - 1]
      if (top === next) return prev
      return [...prev, next]
    })
  }, [])
  const [settingsQuery, setSettingsQuery] = useState("")
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [membershipSubtitle, setMembershipSubtitle] = useState("…")

  /** Navigate into a subsection and record history so browser/Pi back steps one level. */
  const goToSection = useCallback((next: SettingsSection) => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1]
      if (top === next) return prev
      if (next === "main") return ["main"]
      return [...prev, next]
    })
    try {
      if (next !== "main") {
        window.history.pushState({ ghcSettingsSection: next }, "")
      }
    } catch {
      /* history may be unavailable in some WebViews */
    }
  }, [])

  /** One-level back: subsection → previous screen; Settings main → close Settings (Profile). */
  const goBackOneLevel = useCallback(() => {
    setNavStack((prev) => {
      if (prev.length <= 1) {
        onBack()
        return prev
      }
      return prev.slice(0, -1)
    })
  }, [onBack])

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<{ section?: string }>).detail?.section
      if (
        next === "wallet" ||
        next === "rewards" ||
        next === "membership" ||
        next === "help"
      ) {
        goToSection(next as "wallet" | "rewards" | "membership" | "help")
      }
    }
    window.addEventListener("ghc:open-settings-section", handler)
    return () => window.removeEventListener("ghc:open-settings-section", handler)
  }, [goToSection])

  /** Browser / Pi shell back: step out one settings level instead of leaving the app. */
  useEffect(() => {
    const onPop = () => {
      setNavStack((prev) => {
        if (prev.length <= 1) {
          onBack()
          return prev
        }
        return prev.slice(0, -1)
      })
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [onBack])

  // Deep-link entry (e.g. Profile → Wallet): push history once so back returns to Settings main
  useEffect(() => {
    if (initialSection && initialSection !== "main") {
      try {
        window.history.pushState({ ghcSettingsSection: initialSection }, "")
      } catch {
        /* */
      }
    }
    // only on mount for this Settings instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [themeBusy, setThemeBusy] = useState(false)
  const themeFileRef = useRef<HTMLInputElement>(null)

  /** Keep Membership row in sync with domain status (trial / VIP / VVIP / Free) */
  useEffect(() => {
    const refreshMembershipLabel = () => {
      try {
        const { getBoundDomainServices } = require("@/lib/domains/compat")
        const st = getBoundDomainServices()?.membership?.getStatus?.() as
          | { tier?: string; source?: string; lifecycle?: string; expiresAt?: number }
          | null
        if (!st) {
          setMembershipSubtitle("Free plan")
          return
        }
        const tierRaw = String(st.tier || "free").toLowerCase()
        const tierLabel =
          tierRaw === "vvip" ? "VVIP" : tierRaw === "vip" ? "VIP" : tierRaw === "free" ? "Free" : String(st.tier).toUpperCase()
        const isTrial = st.source === "trial" || st.lifecycle === "trial"
        if (isTrial) {
          if (st.expiresAt && st.expiresAt > Date.now()) {
            const h = Math.max(1, Math.round((st.expiresAt - Date.now()) / 3600000))
            setMembershipSubtitle(
              h < 48 ? `${tierLabel} trial · ${h}h left` : `${tierLabel} trial · active`
            )
          } else {
            setMembershipSubtitle(`${tierLabel} trial`)
          }
        } else {
          setMembershipSubtitle(tierLabel === "Free" ? "Free plan" : `${tierLabel} · active`)
        }
      } catch {
        setMembershipSubtitle("Free plan")
      }
    }
    refreshMembershipLabel()
    // Domain services may hydrate slightly after mount
    const t1 = window.setTimeout(refreshMembershipLabel, 400)
    const t2 = window.setTimeout(refreshMembershipLabel, 1500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [section, initialSection])

  const handleToggle = async (key: string, value: boolean) => {
    await updateSettings({ ...settings, [key]: value })
  }

  const handleSelect = async (key: string, value: string | string[] | number | boolean | null) => {
    await updateSettings({ ...settings, [key]: value })
  }

  const setThemeMode = async (mode: ThemeMode) => {
    await updateSettings({
      ...settings,
      themeMode: mode,
      darkMode: mode === "dark" || (mode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    })
  }

  const setThemePreset = async (id: string) => {
    const preset = THEME_PRESETS.find((t) => t.id === id)
    await updateSettings({
      ...settings,
      themeId: id,
      // Clear custom image when picking a built-in look (user can re-upload)
      ...(id !== "custom" ? {} : {}),
      darkMode: settings.themeMode === "dark" || Boolean(preset?.prefersDark && settings.themeMode !== "light"),
    })
  }

  const onCustomThemeImage = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return
    setThemeBusy(true)
    try {
      const dataUrl = await compressForTheme(file)
      await updateSettings({
        ...settings,
        themeCustomImage: dataUrl,
        themeId: settings.themeId || "gh-classic",
      })
    } catch {
      // silent — keep previous image
    } finally {
      setThemeBusy(false)
    }
  }

  if (section === "wallet") {
    return <Suspense fallback={<SectionFallback label="Wallet" />}>
        <PremiumWalletScreen onBack={goBackOneLevel} />
      </Suspense>
  }

  if (section === "rewards") {
    return (
      <Suspense fallback={<SectionFallback label="Rewards" />}>
        <RewardsCentreScreen
          onBack={goBackOneLevel}
          onOpenWallet={() => goToSection("wallet")}
        />
      </Suspense>
    )
  }

  if (section === "membership") {
    return <Suspense fallback={<SectionFallback label="Membership" />}>
        <PremiumMembershipScreen onBack={goBackOneLevel} />
      </Suspense>
  }

  if (section === "about") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">About GreenHaven</h2>
          <p className="text-[12px] text-muted-foreground">Version 0.36</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[var(--gh-screen-bottom-inset)]">
          <div className="space-y-4 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">{LEGAL.about}</div>
        </div>
      </div>
    )
  }

  if (section === "terms") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">Terms of Service</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[var(--gh-screen-bottom-inset)]">
          <div className="space-y-4 text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{LEGAL.terms}</div>
        </div>
      </div>
    )
  }

  if (section === "privacy-policy") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">Privacy Policy</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[var(--gh-screen-bottom-inset)]">
          <div className="space-y-4 text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{LEGAL.privacy}</div>
        </div>
      </div>
    )
  }

  if (section === "help") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">Help & Contact</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[var(--gh-screen-bottom-inset)] space-y-3">
          <a
            href={`https://wa.me/${SUPPORT_CONTACTS.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-card border border-border rounded-2xl hover:border-primary transition"
          >
            <p className="font-bold text-[15px]">WhatsApp Support</p>
            <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.whatsapp}</p>
          </a>
          <a
            href={SUPPORT_CONTACTS.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-card border border-border rounded-2xl hover:border-primary transition"
          >
            <p className="font-bold text-[15px]">Follow on Facebook</p>
            <p className="text-[13px] text-muted-foreground">GreenHavenXpres</p>
          </a>
          <a
            href={`mailto:${SUPPORT_CONTACTS.email}`}
            className="block p-4 bg-card border border-border rounded-2xl hover:border-primary transition"
          >
            <p className="font-bold text-[15px]">Email Support</p>
            <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.email}</p>
          </a>
        </div>
      </div>
    )
  }

  if (section === "privacy") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">Privacy & Safety</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[var(--gh-screen-bottom-inset)] space-y-4">
          <div>
            <p className="text-[14px] font-bold mb-3">Online Status</p>
            <select
              value={settings.onlineStatus}
              onChange={(e) => handleSelect("onlineStatus", e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches Only</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div>
            <p className="text-[15px] font-semibold mb-1">Who can message you</p>
            <p className="mb-2 text-[12px] text-muted-foreground">Example: Matches only blocks cold messages from strangers.</p>
            <select
              value={settings.whoCanMessage}
              onChange={(e) => handleSelect("whoCanMessage", e.target.value)}
              className="min-h-12 w-full rounded-xl border border-border bg-input px-4 py-2.5 text-[15px]"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches only</option>
              <option value="no-one">No one</option>
            </select>
          </div>
          <div>
            <p className="text-[14px] font-bold mb-3">Profile Visibility</p>
            <select
              value={settings.profileVisibility}
              onChange={(e) => handleSelect("profileVisibility", e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches Only</option>
              <option value="hidden">Hidden</option>
            </select>
            <p className="mt-1 text-[12px] text-muted-foreground">Example: Hidden means you will not appear in Find discovery.</p>
          </div>
          <div>
            <p className="text-[14px] font-bold mb-3">Who Can Discover Me</p>
            <select
              value={(settings as any).whoCanDiscover || "everyone"}
              onChange={(e) => handleSelect("whoCanDiscover" as any, e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches &amp; connections only</option>
              <option value="no-one">No one (pause discovery)</option>
            </select>
          </div>
          <div>
            <p className="text-[14px] font-bold mb-3">Who Can Follow Me</p>
            <select
              value={(settings as any).whoCanFollow || "everyone"}
              onChange={(e) => handleSelect("whoCanFollow" as any, e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches &amp; connections only</option>
              <option value="no-one">No one</option>
            </select>
          </div>
          <div>
            <p className="text-[14px] font-bold mb-3">Who Can Connect With Me</p>
            <select
              value={(settings as any).whoCanConnect || "everyone"}
              onChange={(e) => handleSelect("whoCanConnect" as any, e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input"
            >
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches only</option>
              <option value="no-one">No one</option>
            </select>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-[14px] font-bold">Profile details others can see</p>
            {[
              ["showActivity", "Activity / recently active", (settings as any).showActivity !== false],
              ["showInterests", "Interests", (settings as any).showInterests !== false],
              ["showCommunities", "Communities", (settings as any).showCommunities !== false],
              ["showLocation", "Location", settings.showLocation !== false],
            ].map(([key, label, on]) => (
              <label key={String(key)} className="flex items-center justify-between gap-3 text-[13px]">
                <span>{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(on)}
                  onClick={() => handleSelect(key as any, (!on) as any)}
                  className={`relative h-7 w-12 rounded-full transition ${on ? "bg-emerald-600" : "bg-muted-foreground/30"}`}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            ))}
          </div>
          <div>
            <p className="text-[14px] font-bold mb-3">Who Can View My Stories</p>
            <select value={settings.storyVisibility} onChange={(e) => handleSelect("storyVisibility", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-border bg-input">
              <option value="everyone">Everyone</option>
              <option value="matches-only">Matches Only</option>
              <option value="no-one">No One</option>
            </select>
          </div>
          <div>
            <p className="text-[15px] font-semibold mb-1">Location privacy</p>
            <p className="mb-2 text-[12px] text-muted-foreground">Choose how precisely others can see where you are.</p>
            <div className="space-y-2">
              {[
                { v: "city", label: "Exact city", hint: "e.g. Lagos" },
                { v: "region", label: "Region only", hint: "e.g. South West" },
                { v: "hidden", label: "Hidden", hint: "Not shown on profile" },
              ].map((opt) => {
                const current = settings.showLocation === false || (settings as any).locationPrivacy === "hidden"
                  ? "hidden"
                  : (settings as any).locationPrivacy === "region" || (settings as any).locationPrivacy === "admin1"
                    ? "region"
                    : "city"
                const on = current === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      if (opt.v === "hidden") {
                        void handleToggle("showLocation", false)
                        void handleSelect("locationPrivacy" as any, "hidden")
                      } else {
                        void handleToggle("showLocation", true)
                        void handleSelect("locationPrivacy" as any, opt.v === "region" ? "admin1" : "locality")
                      }
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition ${
                      on ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30" : "border-border bg-card"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-emerald-600" : "border-muted-foreground/40"}`}>
                      {on ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> : null}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-foreground">{opt.label}</span>
                      <span className="block text-[12px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Blocked users */}
          <div className="pt-2">
            <p className="mb-2 text-[15px] font-semibold">Blocked users</p>
            <p className="mb-2 text-[12px] text-muted-foreground">They cannot message you or appear in Find.</p>
            {(blockedUsers || []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">No blocked users</p>
            ) : (
              <ul className="space-y-2">
                {(blockedUsers || []).map((id: string) => {
                  const c = (candidates || []).find((x: { id: string }) => x.id === id)
                  const name = c?.name || id.slice(0, 12)
                  return (
                    <li key={id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {(name || "?").charAt(0)}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{name}</span>
                      <button
                        type="button"
                        onClick={() => void unblockUser?.(id)}
                        className="min-h-10 rounded-full border border-border px-3 text-[12px] font-bold text-foreground"
                      >
                        Unblock
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (section === "preferences") {
    const rel = Array.isArray(settings.relationshipType) ? settings.relationshipType : []
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
              <ChevronLeft size={24} />
            </button>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold leading-tight">Preferences</h2>
              <p className="text-[12px] text-muted-foreground">Language &amp; discovery defaults</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[var(--gh-screen-bottom-inset)] space-y-5">
          {/* Language */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Language</p>
            <select
              value={settings.language || "English"}
              onChange={(e) => void handleSelect("language", e.target.value)}
              className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
              aria-label="App language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-muted-foreground">Applies to menus and system labels. Chat content stays as written.</p>
          </section>

          {/* Discovery */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Discovery defaults</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[14px] font-bold">Location radius</p>
                <span className="text-[13px] font-semibold text-emerald-700">{settings.locationRadius} mi</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={settings.locationRadius}
                onChange={(e) => handleSelect("locationRadius", parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
                aria-label="Location radius in miles"
              />
            </div>
            <div>
              <p className="mb-2 text-[14px] font-bold">Age range</p>
              <div className="flex gap-3">
                <label className="flex-1 text-[11px] font-semibold text-muted-foreground">
                  Min
                  <input
                    type="number"
                    min={18}
                    max={80}
                    value={settings.ageMin}
                    onChange={(e) => handleSelect("ageMin", parseInt(e.target.value, 10) || 18)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                  />
                </label>
                <label className="flex-1 text-[11px] font-semibold text-muted-foreground">
                  Max
                  <input
                    type="number"
                    min={18}
                    max={80}
                    value={settings.ageMax}
                    onChange={(e) => handleSelect("ageMax", parseInt(e.target.value, 10) || 45)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                  />
                </label>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[14px] font-bold">Looking for</p>
              <div className="flex flex-wrap gap-2">
                {(["friendship", "dating", "networking"] as const).map((type) => {
                  const on = rel.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const updated = on ? rel.filter((t) => t !== type) : [...rel, type]
                        void handleSelect("relationshipType", updated.length ? updated : [type])
                      }}
                      className={`min-h-10 rounded-full px-4 text-[13px] font-bold capitalize transition ${
                        on
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "border border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[13px] font-bold text-foreground">Need finer alert control?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Choose which events can notify you under{" "}
              <button type="button" className="font-bold text-emerald-700 underline" onClick={() => goToSection("notifications")}>
                Notifications
              </button>
              . Who can message or discover you is under{" "}
              <button type="button" className="font-bold text-emerald-700 underline" onClick={() => goToSection("privacy")}>
                Privacy &amp; Safety
              </button>
              .
            </p>
          </section>
        </div>
      </div>
    )
  }

  if (section === "notifications") {
    const toggles: {
      key: keyof typeof settings
      title: string
      body: string
      defaultOn: boolean
    }[] = [
      {
        key: "notifyMatches",
        title: "New matches",
        body: "When someone matches with you or accepts a connection.",
        defaultOn: true,
      },
      {
        key: "notifyMessages",
        title: "Messages & requests",
        body: "Direct messages, group mentions, and GHC requests.",
        defaultOn: true,
      },
      {
        key: "notifyRewards",
        title: "Rewards & claims",
        body: "Pending validation, claimable GHC, and streak reminders.",
        defaultOn: true,
      },
      {
        key: "notifyMembership",
        title: "Membership & trial",
        body: "Trial ending, renewal, and plan changes.",
        defaultOn: true,
      },
      {
        key: "notifyProfileViews",
        title: "Profile views",
        body: "Occasional digests when people view your profile.",
        defaultOn: false,
      },
      {
        key: "notifyMarketing",
        title: "Tips & product updates",
        body: "Optional product news. Never sold to advertisers.",
        defaultOn: false,
      },
    ]
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="bg-card border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
              <ChevronLeft size={24} />
            </button>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold leading-tight">Notifications</h2>
              <p className="text-[12px] text-muted-foreground">Choose what can reach you</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[var(--gh-screen-bottom-inset)] space-y-3">
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              These control in-app and push categories. Your device must still allow notifications for GreenHaven. Delivery is best-effort when offline.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {toggles.map((t) => {
              const raw = settings[t.key]
              const on = typeof raw === "boolean" ? raw : t.defaultOn
              return (
                <div key={String(t.key)} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-foreground">{t.title}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{t.body}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t.title}
                    onClick={() => void handleSelect(t.key as never, (!on) as never)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      on ? "bg-emerald-600" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        on ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </section>
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            GHC balance changes never appear on your public profile. Reward and wallet alerts stay private to you.
          </p>
        </div>
      </div>
    )
  }

  if (section === "appearance") {
    const mode = (settings.themeMode as ThemeMode | undefined) || (settings.darkMode ? "dark" : "light")
    const activePreset = settings.themeId || "gh-classic"

    return (
      <div className="h-full flex flex-col bg-background text-foreground">
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <button type="button" onClick={goBackOneLevel} className="hover:opacity-60" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold">Appearance</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[var(--gh-screen-bottom-inset)] space-y-6">
          {/* Mode */}
          <div>
            <p className="text-[13px] font-bold text-muted-foreground mb-2">Display mode</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "light" as const, label: "Light", icon: Sun },
                  { id: "dark" as const, label: "Dark", icon: Moon },
                  { id: "system" as const, label: "System", icon: Monitor },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const selected = mode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeMode(id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                      selected
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Dark mode uses true dark surfaces. System follows your device preference.
            </p>
          </div>

          {/* Presets */}
          <div>
            <p className="text-[13px] font-bold text-muted-foreground mb-2">Themes</p>
            <div className="grid grid-cols-2 gap-2.5">
              {THEME_PRESETS.map((preset) => {
                const selected = activePreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setThemePreset(preset.id)}
                    className={`relative overflow-hidden rounded-2xl border text-left transition ${
                      selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="h-16 min-h-[64px] w-full"
                      style={{ background: preset.preview }}
                      aria-hidden
                    />
                    <div className="bg-card px-2.5 py-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-bold text-foreground">{preset.name}</span>
                        {selected && <Check size={14} className="text-primary shrink-0" aria-hidden />}
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">
                        {preset.description}
                        {preset.premium ? " · Premium look" : ""}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom wallpaper */}
          <div>
            <p className="text-[13px] font-bold text-muted-foreground mb-2">Custom background</p>
            <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
              {settings.themeCustomImage ? (
                <div
                  className="h-28 w-full rounded-xl bg-cover bg-center border border-border"
                  style={{ backgroundImage: `url(${settings.themeCustomImage})` }}
                  role="img"
                  aria-label="Current custom theme background"
                />
              ) : (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-[12px] text-muted-foreground">
                  No custom image
                </div>
              )}
              <input
                ref={themeFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  void onCustomThemeImage(f)
                  e.target.value = ""
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={themeBusy}
                  onClick={() => themeFileRef.current?.click()}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  <ImagePlus size={16} aria-hidden />
                  {themeBusy ? "Uploading…" : "Upload image"}
                </button>
                {settings.themeCustomImage && (
                  <button
                    type="button"
                    onClick={() => handleSelect("themeCustomImage", null)}
                    className="min-h-10 rounded-xl border border-border px-3 text-[13px] font-semibold text-foreground"
                  >
                    Remove
                  </button>
                )}
              </div>
              {settings.themeCustomImage && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="theme-opacity">
                    Image strength: {Math.round((settings.themeImageOpacity ?? 0.35) * 100)}%
                  </label>
                  <input
                    id="theme-opacity"
                    type="range"
                    min={0.1}
                    max={0.85}
                    step={0.05}
                    value={settings.themeImageOpacity ?? 0.35}
                    onChange={(e) => handleSelect("themeImageOpacity", Number(e.target.value))}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
              )}
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Images are compressed and stored with your settings. Prefer soft patterns so text stays readable.
              </p>
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-[13px] font-bold text-muted-foreground mb-2">Language</p>
            <select
              value={settings.language}
              onChange={(e) => handleSelect("language", e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  const groups: {
    heading: string
    items: {
      title: string
      subtitle?: string
      icon: ReactNode
      action: () => void
      keywords?: string
    }[]
  }[] = [
    {
      heading: "Account & economy",
      items: [
        {
          title: "GHC Wallet",
          subtitle: "Balance, send, request · private",
          icon: <Wallet size={20} strokeWidth={1.75} />,
          action: () => goToSection("wallet"),
          keywords: "wallet ghc coin balance transfer send receive",
        },
        {
          title: "Rewards Centre",
          subtitle: "Missions & claimable GHC",
          icon: <Gift size={20} strokeWidth={1.75} />,
          action: () => goToSection("rewards"),
          keywords: "rewards challenges earn pending claim",
        },
        {
          title: "Membership",
          subtitle: membershipSubtitle,
          icon: <Crown size={20} strokeWidth={1.75} />,
          action: () => goToSection("membership"),
          keywords: "vip vvip free trial premium membership",
        },
      ],
    },
    {
      heading: "Privacy & safety",
      items: [
        {
          title: "Privacy & Safety",
          subtitle: "Who can message, discover, see you",
          icon: <Shield size={20} strokeWidth={1.75} />,
          action: () => goToSection("privacy"),
          keywords: "privacy block blocked safety message discover follow",
        },
      ],
    },
    {
      heading: "Preferences",
      items: [
        {
          title: "Notifications",
          subtitle: "Matches, messages, rewards, membership",
          icon: <Bell size={20} strokeWidth={1.75} />,
          action: () => goToSection("notifications"),
          keywords: "notifications alerts push matches messages rewards membership",
        },
        {
          title: "Preferences",
          subtitle: "Language & discovery defaults",
          icon: <User size={20} strokeWidth={1.75} />,
          action: () => goToSection("preferences"),
          keywords: "language discovery age radius looking for",
        },
        {
          title: "Appearance",
          subtitle: "Light, dark, themes",
          icon: <Palette size={20} strokeWidth={1.75} />,
          action: () => goToSection("appearance"),
          keywords: "theme dark light mode appearance",
        },
      ],
    },
    {
      heading: "Support",
      items: [
        {
          title: "Help & Support",
          subtitle: "WhatsApp, email, Facebook",
          icon: <HelpCircle size={20} strokeWidth={1.75} />,
          action: () => goToSection("help"),
          keywords: "help support contact whatsapp email",
        },
        {
          title: "About GreenHaven",
          subtitle: "Version 0.38",
          icon: <Info size={20} strokeWidth={1.75} />,
          action: () => goToSection("about"),
          keywords: "about version mission",
        },
        {
          title: "Terms of Service",
          icon: <FileText size={20} strokeWidth={1.75} />,
          action: () => goToSection("terms"),
          keywords: "terms legal",
        },
        {
          title: "Privacy Policy",
          icon: <FileText size={20} strokeWidth={1.75} />,
          action: () => goToSection("privacy-policy"),
          keywords: "privacy policy legal",
        },
      ],
    },
  ]

  const q = settingsQuery.trim().toLowerCase()
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          !q ||
          it.title.toLowerCase().includes(q) ||
          (it.subtitle || "").toLowerCase().includes(q) ||
          (it.keywords || "").includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card p-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Back to profile"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <h2 className="text-[20px] font-bold">Settings</h2>
      </div>

      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            placeholder="Search settings…"
            className="min-h-11 w-full rounded-2xl border border-border bg-muted/50 py-2.5 pl-10 pr-3 text-[15px] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            aria-label="Search settings"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)]">
        <div className="space-y-5 px-4 py-4">
          {filteredGroups.length === 0 ? (
            <p className="px-2 text-[13px] text-muted-foreground">No settings match “{settingsQuery}”.</p>
          ) : (
            filteredGroups.map((group) => (
              <section key={group.heading} aria-labelledby={`settings-${group.heading}`}>
                <h3
                  id={`settings-${group.heading}`}
                  className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {group.heading}
                </h3>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {group.items.map((item, idx) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={item.action}
                      className={`flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                        idx > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-foreground">{item.title}</span>
                        {item.subtitle ? (
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">{item.subtitle}</span>
                        ) : null}
                      </span>
                      <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}

          <section aria-labelledby="settings-danger">
            <h3 id="settings-danger" className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              Session
            </h3>
            {!logoutConfirm ? (
              <button
                type="button"
                onClick={() => setLogoutConfirm(true)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[15px] font-bold text-destructive transition hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                <LogOut size={18} strokeWidth={2} />
                Log out
              </button>
            ) : (
              <div className="rounded-2xl border border-destructive/40 bg-card p-4">
                <p className="text-[15px] font-semibold text-foreground">Log out of GreenHaven?</p>
                <p className="mt-1 text-[12px] text-muted-foreground">You can sign back in anytime on this device.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLogoutConfirm(false)}
                    className="min-h-11 flex-1 rounded-xl border border-border font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      onBack()
                    }}
                    className="min-h-11 flex-1 rounded-xl bg-destructive font-bold text-destructive-foreground"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen
