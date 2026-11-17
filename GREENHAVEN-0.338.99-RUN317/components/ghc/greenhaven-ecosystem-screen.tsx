"use client"

/**
 * GreenHaven Ecosystem — canonical service directory.
 * All cards derive from lib/navigation/service-registry.
 * ACTIVE/BETA → openService (canonical navigate).
 * COMING_SOON → informational landing only (no fake UI).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Search,
  ClipboardList,
  ChevronRight,
  Users,
  MessageCircle,
  ShoppingBag,
  HeartHandshake,
  GraduationCap,
  Clapperboard,
  Bus,
  Landmark,
  Sparkles,
  Gift,
  Crown,
  Wallet,
  Heart,
  Coins,
  type LucideIcon,
} from "lucide-react"
import { PiSupporterBadge, PiStakingStatusNote } from "@/components/ghc/pi-supporter-badge"
import { PiPlatformCapabilitiesCard } from "@/components/ghc/pi-platform-capabilities-card"
import { openService } from "@/lib/navigation/navigate"
import { getServiceUpgradePlan } from "@/lib/navigation/service-upgrade-plan"
import {
  SERVICE_CATEGORIES,
  getFeaturedServices,
  searchServices,
  getServiceById,
  isInteractiveStatus,
  type EcosystemService,
  type ServiceStatus,
} from "@/lib/navigation/service-registry"

const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  MessageCircle,
  ShoppingBag,
  HeartHandshake,
  GraduationCap,
  Clapperboard,
  Bus,
  Landmark,
  Sparkles,
  Gift,
  Crown,
  Wallet,
  Heart,
  Coins,
  Search,
  ClipboardList,
}

/** 2-col phones (≤640), 3-col tablet, 4-col desktop — fluid, no fixed desktop widths */
const GRID_CLASS =
  "grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-4"

const UPGRADE_WORKSTREAMS = [
  "Product foundation",
  "Trust, safety & operations",
  "Discovery & user experience",
  "Lifecycle & integrations",
  "Resilience & quality",
  "Governance & continuity",
] as const

function ServiceIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] || Sparkles
  return <Icon size={size} strokeWidth={2.1} aria-hidden />
}

function statusBadge(
  status: ServiceStatus,
  custom?: string
): { label: string; className: string } | null {
  if (custom) {
    return {
      label: custom,
      className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    }
  }
  if (status === "BETA") {
    return {
      label: "Beta",
      className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    }
  }
  if (status === "COMING_SOON") {
    return {
      label: "Coming soon",
      className: "bg-muted text-muted-foreground",
    }
  }
  if (status === "UNAVAILABLE") {
    return {
      label: "Unavailable",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    }
  }
  return null
}

function ServiceCard({
  service,
  highlighted,
  onSelect,
}: {
  service: EcosystemService
  highlighted?: boolean
  onSelect: (s: EcosystemService) => void
}) {
  const interactive = isInteractiveStatus(service.status)
  const badge = statusBadge(service.status, service.badge)
  return (
    <button
      type="button"
      id={`eco-svc-${service.id}`}
      onClick={() => onSelect(service)}
      disabled={service.status === "UNAVAILABLE"}
      aria-label={
        interactive
          ? `Open ${service.title}`
          : `${service.title}, ${badge?.label || service.status}`
      }
      className={`group flex min-h-[7.25rem] w-full min-w-0 flex-col items-start gap-2 rounded-[1.15rem] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-[7.75rem] sm:p-3.5 ${
        highlighted
          ? "border-primary/35 bg-primary/5 shadow-[var(--gh-card-shadow)] dark:bg-primary/10"
          : interactive
            ? "border-[var(--gh-ref-line)] bg-card shadow-[var(--gh-card-shadow)] hover:border-primary/30 hover:bg-primary/[0.025]"
            : "border-[var(--gh-ref-line)] bg-card/75 hover:border-primary/25 hover:bg-card"
      } ${service.status === "UNAVAILABLE" ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="flex w-full min-w-0 items-start gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] sm:h-11 sm:w-11 ${
            interactive
              ? "bg-primary/10 text-primary"
              : "bg-muted/75 text-muted-foreground"
          }`}
        >
          <ServiceIcon name={service.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[13px] font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-sm">
              {service.title}
            </span>
            {badge ? (
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold tracking-wide sm:text-[10px] ${badge.className}`}
              >
                {badge.label}
              </span>
            ) : null}
          </span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            {service.description}
          </span>
        </span>
        {interactive ? (
          <ChevronRight
            size={16}
            className="mt-1 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
    </button>
  )
}

function ComingSoonPanel({
  service,
  onBack,
}: {
  service: EcosystemService
  onBack: () => void
}) {
  return (
    <div className="gh-upcoming-service flex h-full min-h-0 flex-col overflow-x-hidden bg-[var(--gh-ref-canvas)]" data-release-status="coming-soon">
      <header className="flex min-h-[4.25rem] shrink-0 items-center gap-3 border-b border-[var(--gh-ref-line)] bg-[var(--gh-ref-surface)]/95 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--gh-ref-line)] bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to directory"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight text-foreground">{service.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">GreenHaven service development</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
          Coming soon
        </span>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 scrollbar-hide sm:px-6 sm:py-7"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <section className="overflow-hidden rounded-[1.65rem] border border-[var(--gh-ref-line)] bg-[var(--gh-ref-surface)] p-5 shadow-[var(--gh-ref-shadow)] sm:p-7" aria-labelledby="upcoming-service-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:h-16 sm:w-16">
                <ServiceIcon name={service.icon} size={29} />
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                In development
              </span>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">GreenHaven Ecosystem</p>
            <h2 id="upcoming-service-title" className="mt-1 text-2xl font-bold leading-tight tracking-[-0.035em] text-foreground sm:text-3xl">
              {service.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              {service.description}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/85">
              {service.roadmapNote || "This service is part of the GreenHaven product roadmap. Its experience and supporting systems are being prepared before a separate release review."}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--gh-ref-line)] pt-4 sm:gap-3">
              <div className="rounded-xl bg-muted/55 px-3 py-3">
                <p className="text-lg font-bold tabular-nums text-foreground">30</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground">Upgrade tracks</p>
              </div>
              <div className="rounded-xl bg-muted/55 px-3 py-3">
                <p className="text-lg font-bold tabular-nums text-foreground">6</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground">Workstreams</p>
              </div>
              <div className="rounded-xl bg-muted/55 px-3 py-3">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">Off</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground">Service access</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-[var(--gh-ref-line)] px-2.5 py-1">Status: <strong className="text-foreground">Coming Soon</strong></span>
              <span className="rounded-full border border-[var(--gh-ref-line)] px-2.5 py-1">No live actions or transactions</span>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[var(--gh-ref-line)] bg-[var(--gh-ref-surface)] p-4 shadow-[var(--gh-ref-shadow)] sm:p-5" aria-labelledby="upcoming-plan-title">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--gh-ref-line)] pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Preparation roadmap</p>
                <h3 id="upcoming-plan-title" className="mt-1 text-lg font-bold tracking-tight text-foreground">The work behind this service</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">30 upgrade tracks in preparation — service-specific objectives grouped into six engineering workstreams.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold text-muted-foreground">Plan · not completion</span>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Thirty upgrade tracks in preparation">
              {getServiceUpgradePlan(service).map((track, index) => (
                <li key={track.id} className="min-w-0 rounded-xl border border-[var(--gh-ref-line)] bg-card p-3">
                  {index % 5 === 0 ? (
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">{UPGRADE_WORKSTREAMS[Math.floor(index / 5)]}</p>
                  ) : null}
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold tabular-nums text-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold leading-snug text-foreground">{track.title}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">Planned</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{track.objective}</span>
                      <span className="mt-2 block border-t border-[var(--gh-ref-line)] pt-2 text-[10px] leading-relaxed text-foreground/80"><strong>Release gate:</strong> {track.launchGate}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-xs leading-relaxed text-foreground/85">
              <strong>Availability stays off.</strong> This is a development preview only. The service remains Coming Soon, its destination remains disabled, and these planned tracks are not represented as completed features. It stays unavailable until separately reviewed and explicitly released after security, data, accessibility and release checks.
            </p>
          </section>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Back to Ecosystem
          </button>
        </div>
      </div>
    </div>
  )
}

export function GreenHavenEcosystemScreen({
  onBack,
  initialFocus,
}: {
  onBack: () => void
  initialFocus?: string | null
}) {
  const [query, setQuery] = useState("")
  const [focusId, setFocusId] = useState<string | null>(initialFocus || null)
  const [detailService, setDetailService] = useState<EcosystemService | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        try { window.dispatchEvent(new CustomEvent("ghc:ecosystem-refresh")) } catch { /* */ }
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  useEffect(() => {
    if (initialFocus) setFocusId(initialFocus)
  }, [initialFocus])

  useEffect(() => {
    if (!focusId) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`eco-svc-${focusId}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
    return () => window.clearTimeout(t)
  }, [focusId, query])

  const featured = useMemo(() => getFeaturedServices(), [])
  const filtered = useMemo(() => searchServices(query), [query])
  const isSearching = Boolean(query.trim())

  const categoriesWithServices = useMemo(() => {
    // When not searching, omit Featured entries from category grids to avoid duplicates
    const featuredIds = new Set(
      isSearching ? [] : featured.map((s) => s.id)
    )
    return SERVICE_CATEGORIES.map((cat) => ({
      ...cat,
      services: filtered.filter(
        (s) => s.category === cat.id && !featuredIds.has(s.id)
      ),
    })).filter((c) => c.services.length > 0)
  }, [filtered, featured, isSearching])

  const handleSelect = useCallback((service: EcosystemService) => {
    if (service.id === "field-research") {
      window.location.assign("/field/studio")
      return
    }
    if (isInteractiveStatus(service.status)) {
      if (service.id === "marketplace") {
        setFocusId("marketplace")
      }
      openService(service.id)
      return
    }
    setDetailService(service)
  }, [])

  if (detailService) {
    return (
      <ComingSoonPanel service={detailService} onBack={() => setDetailService(null)} />
    )
  }

  return (
    <div className="gh-ecosystem-directory flex h-full min-h-0 w-full max-w-full flex-col overflow-x-hidden bg-[var(--gh-ref-canvas)] text-foreground" data-gh-module="ecosystem">
      <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--gh-ref-line)] bg-[var(--gh-ref-surface)]/95 px-4 pb-4 pt-[max(0.85rem,env(safe-area-inset-top,0px))] backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">GreenHaven Ecosystem</h1>
            <p className="truncate text-xs text-muted-foreground">Explore active services and what is in development</p>
          </div>
        </div>
        <label className="relative block w-full">
          <span className="sr-only">Search services</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services"
            className="h-12 w-full min-w-0 rounded-xl border border-[var(--gh-ref-line)] bg-muted/35 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </header>

      <div
        ref={listRef}
        className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <section className="mt-3 px-3 min-[640px]:px-4" aria-label="Pi ecosystem support">
          <div className="rounded-xl border border-border/70 bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                  Pi Directory
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">Support GreenHaven</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Stake Pi for this app in the Ecosystem Directory to boost ranking. Recognition
                  only — does not change GHC balances.
                </p>
              </div>
              <PiSupporterBadge showCtaWhenNone className="shrink-0" />
            </div>
            <div className="mt-2">
              <PiPlatformCapabilitiesCard className="mb-3" />
              <PiStakingStatusNote />
            </div>
          </div>
        </section>

        {!isSearching ? (
          <section className="mt-4 px-3 min-[640px]:px-4" aria-label="Featured services">
            <div className="mb-3 mt-1 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight text-foreground">Featured services</h2>
              <span className="text-[10px] font-semibold text-muted-foreground">Selected across GreenHaven</span>
            </div>
            <div className={GRID_CLASS}>
              {featured.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  highlighted={focusId === s.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-5 space-y-5 px-3 pb-6 min-[640px]:px-4">
          {isSearching ? (
            <p className="text-[11px] text-muted-foreground" role="status">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} for “{query.trim()}”
            </p>
          ) : null}

          {categoriesWithServices.map((cat) => (
            <section key={cat.id} aria-labelledby={`eco-cat-${cat.id}`}>
              <h2
                id={`eco-cat-${cat.id}`}
                className="mb-3 text-sm font-bold tracking-tight text-foreground"
              >
                {cat.label}
              </h2>
              <div className={GRID_CLASS}>
                {cat.services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    highlighted={focusId === s.id}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </section>
          ))}

          {categoriesWithServices.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center"
              role="status"
            >
              <Search size={22} className="text-muted-foreground" aria-hidden />
              <p className="text-[13px] font-semibold text-foreground">No services found</p>
              <p className="max-w-xs text-[12px] text-muted-foreground">
                Nothing matches “{query.trim()}”. Try Marketplace, Wallet, Community, or Education.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>

        <p className="mx-4 mb-6 rounded-xl border border-[var(--gh-ref-line)] bg-[var(--gh-ref-surface)] px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:mx-6">
          <strong>GHC</strong> is GreenHaven&apos;s internal utility — earned through participation,
          never mixed with Pi. Active services open real product surfaces; Coming soon cards are
          informational only.
        </p>
      </div>
    </div>
  )
}

export function resolveEcosystemFocus(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null
  const focus = (detail as { focus?: unknown }).focus
  if (typeof focus !== "string" || !focus.trim()) return null
  const id = focus.trim().toLowerCase()
  if (getServiceById(id)) return id
  if (id === "market" || id === "shop") return "marketplace"
  return id
}
