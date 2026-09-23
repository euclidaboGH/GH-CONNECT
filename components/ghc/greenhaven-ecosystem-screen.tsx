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
import { openService } from "@/lib/navigation/navigate"
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
}

/** 2-col phones (≤640), 3-col tablet, 4-col desktop — fluid, no fixed desktop widths */
const GRID_CLASS =
  "grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-4"

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
      className={`flex min-h-[44px] w-full min-w-0 flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-3 ${
        highlighted
          ? "border-emerald-500 bg-emerald-50/90 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/50"
          : interactive
            ? "border-border/70 bg-card hover:border-emerald-300/80 hover:bg-emerald-50/40 active:scale-[0.99] dark:hover:bg-emerald-950/25"
            : "border-border/50 bg-muted/30"
      } ${service.status === "UNAVAILABLE" ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="flex w-full min-w-0 items-start gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
            interactive
              ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <ServiceIcon name={service.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[12px] font-bold leading-tight text-foreground sm:text-[13px]">
              {service.title}
            </span>
            {badge ? (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide sm:text-[9px] ${badge.className}`}
              >
                {badge.label}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
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
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to directory"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{service.title}</h1>
          <p className="text-[11px] text-muted-foreground">Coming soon</p>
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-hide"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
            <ServiceIcon name={service.icon} size={28} />
          </span>
          <h2 className="mt-4 text-lg font-black tracking-tight text-foreground">
            {service.title}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {service.description}
          </p>
          <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2.5 text-left text-[12px] leading-relaxed text-foreground">
            {service.roadmapNote ||
              "This service is on the GreenHaven roadmap. It is not available yet — no actions can be taken here."}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Status: <strong>Coming soon</strong> · Not a live product surface
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
    return SERVICE_CATEGORIES.map((cat) => ({
      ...cat,
      services: filtered.filter((s) => s.category === cat.id),
    })).filter((c) => c.services.length > 0)
  }, [filtered])

  const handleSelect = useCallback((service: EcosystemService) => {
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
    <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-x-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
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
            <h1 className="truncate text-sm font-bold">GreenHaven Ecosystem</h1>
            <p className="truncate text-[11px] text-muted-foreground">Service directory</p>
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
            className="h-11 w-full min-w-0 rounded-xl border border-border/70 bg-muted/40 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              <PiStakingStatusNote />
            </div>
          </div>
        </section>

        {!isSearching ? (
          <section className="mt-4 px-3 min-[640px]:px-4" aria-label="Featured services">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Featured
            </p>
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
                className="mb-2 text-[12px] font-bold text-foreground"
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

        <p className="mx-3 mb-6 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100 min-[640px]:mx-4">
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
