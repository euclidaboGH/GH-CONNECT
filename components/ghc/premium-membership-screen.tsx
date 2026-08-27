"use client"

import { useMemo, useState, useEffect } from "react"
import {
  ArrowLeft,
  Check,
  Crown,
  Info,
  Loader2,
  Sparkles,
  X,
  ChevronRight,
  Filter,
  Users,
  MessageCircle,
  Store,
  BarChart3,
  ImageIcon,
  Headphones,
  BadgeCheck,
} from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { getBoundDomainServices } from "@/lib/domains/compat"
import {
  MEMBERSHIP_PLANS,
  type MembershipTierId,
  type EntitlementKey,
  type MembershipStatus,
} from "@/lib/domains/membership-domain"
import { useGHC } from "@/contexts/ghc-context"

/** Human labels + optional product deep-link (tab or settings section) */
const ENTITLEMENT_META: Partial<
  Record<
    EntitlementKey,
    {
      label: string
      /** Where to open in the app */
      link?: { kind: "tab"; id: string } | { kind: "settings"; section: string }
      icon?: "filter" | "users" | "message" | "store" | "chart" | "image" | "support" | "badge"
    }
  >
> = {
  badge_vip: { label: "VIP badge on profile", link: { kind: "tab", id: "profile" }, icon: "badge" },
  badge_vvip: { label: "VVIP badge on profile", link: { kind: "tab", id: "profile" }, icon: "badge" },
  discovery_advanced_filters: {
    label: "Advanced discovery filters",
    link: { kind: "tab", id: "discover" },
    icon: "filter",
  },
  discovery_priority: {
    label: "Priority in discovery",
    link: { kind: "tab", id: "discover" },
    icon: "filter",
  },
  matching_enhanced_controls: {
    label: "Enhanced matching controls",
    link: { kind: "tab", id: "matches" },
    icon: "users",
  },
  matching_advanced: {
    label: "Advanced matching tools",
    link: { kind: "tab", id: "matches" },
    icon: "users",
  },
  profile_customization: {
    label: "Profile customization",
    link: { kind: "tab", id: "profile" },
    icon: "image",
  },
  profile_premium_presentation: {
    label: "Premium profile presentation",
    link: { kind: "tab", id: "profile" },
    icon: "image",
  },
  boost_post: { label: "Post boosts", link: { kind: "tab", id: "feed" }, icon: "chart" },
  boost_profile: { label: "Profile boosts", link: { kind: "tab", id: "profile" }, icon: "badge" },
  story_analytics: { label: "Story analytics", link: { kind: "tab", id: "feed" }, icon: "chart" },
  marketplace_enhanced_visibility: {
    label: "Marketplace visibility boost",
    link: { kind: "tab", id: "discover" },
    icon: "store",
  },
  marketplace_advanced_tools: {
    label: "Advanced marketplace tools",
    link: { kind: "tab", id: "discover" },
    icon: "store",
  },
  community_premium_tools: {
    label: "Premium community tools",
    link: { kind: "tab", id: "communities" },
    icon: "users",
  },
  community_advanced: {
    label: "Advanced community capabilities",
    link: { kind: "tab", id: "communities" },
    icon: "users",
  },
  media_limits_elevated: {
    label: "Higher media limits",
    link: { kind: "tab", id: "profile" },
    icon: "image",
  },
  media_limits_max: {
    label: "Maximum media / storage limits",
    link: { kind: "tab", id: "profile" },
    icon: "image",
  },
  ghc_earning_boost: {
    label: "×1.5 activity earn multiplier (capped)",
    link: { kind: "settings", section: "rewards" },
    icon: "chart",
  },
  ghc_earning_boost_high: {
    label: "×2 activity earn multiplier (capped)",
    link: { kind: "settings", section: "rewards" },
    icon: "chart",
  },
  platform_fee_discount: {
    label: "Platform fee discount (up to 20% VVIP)",
    link: { kind: "settings", section: "wallet" },
    icon: "store",
  },
  analytics_advanced: {
    label: "Advanced analytics",
    link: { kind: "tab", id: "profile" },
    icon: "chart",
  },
  creator_business_tools: {
    label: "Creator / business tools",
    link: { kind: "tab", id: "profile" },
    icon: "store",
  },
  priority_support: {
    label: "Priority support",
    link: { kind: "settings", section: "help" },
    icon: "support",
  },
  exclusive_experiences: {
    label: "Exclusive experiences",
    link: { kind: "tab", id: "communities" },
    icon: "users",
  },
  storage_elevated: {
    label: "Elevated storage",
    link: { kind: "tab", id: "profile" },
    icon: "image",
  },
}

/** Top upgrades to highlight for Free users (not a long marketing list) */
const NEXT_UPGRADES_FOR_FREE: EntitlementKey[] = [
  "discovery_advanced_filters",
  "matching_enhanced_controls",
  "boost_post",
]

const TIER_ORDER: MembershipTierId[] = ["free", "vip", "vvip"]

const COMPARE_ROWS: { key: string; label: string; free: string; vip: string; vvip: string }[] = [
  { key: "price_m", label: "Monthly (GHC)", free: "0", vip: "200", vvip: "500" },
  { key: "price_y", label: "Yearly (GHC)", free: "0", vip: "1,800", vvip: "4,500" },
  { key: "badge", label: "Profile badge", free: "—", vip: "VIP", vvip: "VVIP Elite" },
  { key: "filters", label: "Discovery filters", free: "Standard", vip: "Advanced", vvip: "Priority + spotlight" },
  { key: "match", label: "Matching tools", free: "Standard", vip: "Enhanced", vvip: "Advanced + exclusive" },
  { key: "boosts", label: "Daily profile/post boosts", free: "0", vip: "3", vvip: "10" },
  { key: "media", label: "Photo limit", free: "6", vip: "12", vvip: "24" },
  { key: "ghc", label: "Activity earn multiplier", free: "×1", vip: "×1.5", vvip: "×2" },
  { key: "fee", label: "Platform fee discount", free: "—", vip: "10%", vvip: "20%" },
  { key: "support", label: "Support", free: "Standard", vip: "Priority chat", vvip: "Priority + agent" },
  { key: "events", label: "Exclusive spaces", free: "—", vip: "VIP rooms", vvip: "VVIP experiences" },
  { key: "missions", label: "Reward track", free: "Standard", vip: "VIP missions", vvip: "Elite missions" },
]

function openEntitlementLink(
  link?: { kind: "tab"; id: string } | { kind: "settings"; section: string }
) {
  if (!link) return
  try {
    if (link.kind === "tab") {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: link.id }))
    } else {
      window.dispatchEvent(
        new CustomEvent("ghc:open-settings-section", { detail: { section: link.section } })
      )
    }
  } catch {
    /* */
  }
}

function formatUntil(ts?: number) {
  if (!ts) return "Active · renew anytime"
  try {
    return `Active until ${new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`
  } catch {
    return "Active"
  }
}

function EntitlementIcon({ name }: { name?: string }) {
  const cls = "mt-0.5 shrink-0 text-emerald-600"
  switch (name) {
    case "filter":
      return <Filter size={14} className={cls} />
    case "users":
      return <Users size={14} className={cls} />
    case "message":
      return <MessageCircle size={14} className={cls} />
    case "store":
      return <Store size={14} className={cls} />
    case "chart":
      return <BarChart3 size={14} className={cls} />
    case "image":
      return <ImageIcon size={14} className={cls} />
    case "support":
      return <Headphones size={14} className={cls} />
    case "badge":
      return <BadgeCheck size={14} className={cls} />
    default:
      return <Check size={14} className={cls} />
  }
}

export function PremiumMembershipScreen({ onBack }: { onBack: () => void }) {
  const { addToast } = useGHC()
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly")
  const [busy, setBusy] = useState<MembershipTierId | null>(null)
  const [confirmTier, setConfirmTier] = useState<MembershipTierId | null>(null)
  const [successStatus, setSuccessStatus] = useState<MembershipStatus | null>(null)
  const [tick, setTick] = useState(0)
  const [faqOpen, setFaqOpen] = useState<string | null>(null)
  const [view, setView] = useState<"cards" | "compare">("cards")

  const status = useMemo(() => {
    void tick
    try {
      return getBoundDomainServices()?.membership?.getStatus?.() || null
    } catch {
      return null
    }
  }, [tick])

  const currentTier = (status?.tier || "free") as MembershipTierId

  const purchase = async (tier: MembershipTierId) => {
    if (tier === "free" || tier === currentTier) return
    setBusy(tier)
    try {
      const m = getBoundDomainServices()?.membership
      if (!m?.purchaseWithGhc) {
        addToast("Membership purchase unavailable offline", "error")
        return
      }
      const result = await m.purchaseWithGhc(tier, period)
      if (result.ok) {
        setConfirmTier(null)
        setTick((t) => t + 1)
        // Prefer fresh status from domain
        let next: MembershipStatus | null = null
        try {
          next = getBoundDomainServices()?.membership?.getStatus?.() || null
        } catch {
          next = null
        }
        if (!next) {
          const now = Date.now()
          const ms = period === "monthly" ? 30 * 86400000 : 365 * 86400000
          next = {
            userId: "current-user",
            tier,
            active: true,
            startedAt: now,
            expiresAt: now + ms,
            billingPeriod: period,
            source: "ghc",
          }
        }
        setSuccessStatus(next)
        addToast(`${MEMBERSHIP_PLANS[tier].label} activated`, "success")
      } else {
        addToast(result.error || "Purchase failed", "error")
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Purchase failed", "error")
    } finally {
      setBusy(null)
    }
  }

  // Close success sheet on back navigation cleanup
  useEffect(() => {
    return () => setSuccessStatus(null)
  }, [])

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-foreground">Membership</h1>
          <p className="text-[11px] text-muted-foreground">
            Current:{" "}
            <span className="font-semibold text-emerald-700">
              {MEMBERSHIP_PLANS[currentTier].label}
            </span>
            {status?.source === "trial" || (status as { lifecycle?: string } | null)?.lifecycle === "trial" ? (
              <span className="text-muted-foreground">
                {" "}
                · welcome trial
                {status?.expiresAt ? ` · ends ${formatUntil(status.expiresAt)}` : ""}
              </span>
            ) : status?.expiresAt ? (
              <span className="text-muted-foreground"> · {formatUntil(status.expiresAt)}</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTick((x) => x + 1)}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
          aria-label="Refresh membership status"
        >
          Refresh
        </button>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 scrollbar-hide [-webkit-overflow-scrolling:touch] touch-pan-y"
        style={{ paddingBottom: "var(--gh-screen-bottom-inset)" }}
      >
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Membership is separate from <strong className="text-foreground">verification</strong>, reputation
            and GHC balance. <strong className="text-foreground">Verification ≠ VIP</strong>. Benefits come
            from entitlements — no urgency timers or “only 2 left” claims. Review what you get before confirming.
          </p>
        </div>

        {/* What you have now / next upgrades (Free-focused) */}
        {currentTier === "free" && (
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-sm font-bold text-foreground">What matters next</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              On Free you already have full social access. These are the upgrades people use most —
              not a long sales list.
            </p>
            <ul className="mt-2 space-y-1.5">
              {NEXT_UPGRADES_FOR_FREE.map((key) => {
                const meta = ENTITLEMENT_META[key]
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => openEntitlementLink(meta?.link)}
                      className="flex w-full items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 text-left text-[12px] font-medium text-foreground dark:bg-card/80"
                    >
                      <EntitlementIcon name={meta?.icon} />
                      <span className="min-w-0 flex-1">{meta?.label || key}</span>
                      <span className="text-[10px] font-bold text-emerald-700">VIP+</span>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Current paid plan snapshot */}
        {currentTier !== "free" && status?.active && (
          <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-950/20">
            <p className="text-sm font-bold text-foreground">
              {MEMBERSHIP_PLANS[currentTier].label} · {formatUntil(status.expiresAt)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Your entitlements are active. Tap any benefit below to open the related feature.
            </p>
          </div>
        )}

        {/* Period — calm, no pressure */}
        <div className="mb-2 flex gap-1 rounded-2xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold ${
              period === "monthly" ? "bg-emerald-700 text-white" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold ${
              period === "yearly" ? "bg-emerald-700 text-white" : "text-muted-foreground"
            }`}
          >
            Yearly
          </button>
        </div>
        <p className="mb-3 px-1 text-[10px] text-muted-foreground">
          Prices in GHC (in-app utility). No external auto-charge is implied.
        </p>

        {/* View toggle */}
        <div className="mb-3 flex gap-1 rounded-2xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
              view === "cards" ? "bg-muted text-foreground" : "text-muted-foreground"
            }`}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setView("compare")}
            className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
              view === "compare" ? "bg-muted text-foreground" : "text-muted-foreground"
            }`}
          >
            Compare side-by-side
          </button>
        </div>

        {view === "compare" ? (
          <div className="mb-8 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[320px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-card px-2 py-2.5 font-bold text-muted-foreground">
                    Feature
                  </th>
                  {TIER_ORDER.map((t) => (
                    <th
                      key={t}
                      className={`px-2 py-2.5 text-center font-bold ${
                        currentTier === t ? "text-emerald-700" : "text-foreground"
                      }`}
                    >
                      {MEMBERSHIP_PLANS[t].label}
                      {currentTier === t ? (
                        <span className="mt-0.5 block text-[9px] font-semibold uppercase">You</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border/60">
                    <td className="sticky left-0 bg-card px-2 py-2 font-medium text-muted-foreground">
                      {row.label}
                    </td>
                    <td className="px-2 py-2 text-center text-foreground">{row.free}</td>
                    <td className="px-2 py-2 text-center text-foreground">{row.vip}</td>
                    <td className="px-2 py-2 text-center text-foreground">{row.vvip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              Scroll horizontally on small screens. Entitlements below open the real product area.
            </p>
          </div>
        ) : (
          /* Full-width vertical stack — every plan scrolls with the page (no clipped horizontal cards) */
          <div className="flex flex-col gap-4">
            <p className="px-1 text-[11px] text-muted-foreground">
              Scroll down to review Free, VIP and VVIP. All benefits are fully visible.
            </p>
            {TIER_ORDER.map((tier) => {
              const plan = MEMBERSHIP_PLANS[tier]
              const isCurrent = currentTier === tier
              const price =
                tier === "free"
                  ? 0
                  : period === "monthly"
                    ? plan.priceGhcMonthly
                    : plan.priceGhcYearly
              const accent =
                tier === "vvip"
                  ? "border-amber-200/80 from-amber-50/80 to-card dark:from-amber-950/20"
                  : tier === "vip"
                    ? "border-emerald-200 from-emerald-50/80 to-card dark:from-emerald-950/20"
                    : "border-border from-card to-card"
              const ring = isCurrent ? "ring-2 ring-emerald-500" : ""

              return (
                <article
                  key={tier}
                  id={`membership-plan-${tier}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`w-full rounded-3xl border bg-gradient-to-b p-4 shadow-sm ${accent} ${ring}`}
                >
                  <div className="mb-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {tier === "vvip" ? (
                          <Crown size={18} className="text-amber-700" />
                        ) : tier === "vip" ? (
                          <Sparkles size={18} className="text-emerald-600" />
                        ) : (
                          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            F
                          </span>
                        )}
                        <div>
                          <h2 className="text-[20px] font-bold leading-tight text-foreground">{plan.label}</h2>
                          {isCurrent && (
                            <span className="mt-0.5 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="inline-flex items-center gap-1 text-lg font-bold text-foreground">
                          {price === 0 ? (
                            "Free"
                          ) : (
                            <>
                              <GhcCoinIcon size={20} />
                              {price} GHC
                            </>
                          )}
                        </p>
                        {price > 0 ? (
                          <p className="text-[10px] text-muted-foreground">
                            / {period === "monthly" ? "month" : "year"} · in-app GHC only
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Always included</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badge preview */}
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                      You
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground">Profile badge</p>
                      <p className="text-[11px] text-muted-foreground">
                        {tier === "free" ? "No plan badge" : tier === "vip" ? "VIP badge" : "VVIP badge"}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    <li className="flex items-start gap-2 text-[14px] text-muted-foreground">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      Media: up to {plan.mediaMaxPhotos} photos · stories ~{plan.mediaMaxStoryMb}MB
                    </li>
                    <li className="flex items-start gap-2 text-[14px] text-muted-foreground">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      Daily boosts: {plan.dailyBoosts}
                    </li>
                    {plan.ghcDailyEarnMultiplier > 1 && (
                      <li className="flex items-start gap-2 text-[14px] text-muted-foreground">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                        GHC earn multiplier ×{plan.ghcDailyEarnMultiplier}
                      </li>
                    )}
                    {plan.platformFeeDiscountPct > 0 && (
                      <li className="flex items-start gap-2 text-[14px] text-muted-foreground">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                        Platform fee discount {plan.platformFeeDiscountPct}%
                      </li>
                    )}
                    {plan.entitlements.map((key) => {
                      const meta = ENTITLEMENT_META[key]
                      const label = meta?.label || key
                      const clickable = !!meta?.link
                      return (
                        <li key={key}>
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => openEntitlementLink(meta?.link)}
                              className="flex w-full items-start gap-2 rounded-lg py-0.5 text-left text-[13px] text-foreground transition hover:bg-muted/60"
                            >
                              <EntitlementIcon name={meta?.icon} />
                              <span className="min-w-0 flex-1 underline-offset-2 hover:underline">
                                {label}
                              </span>
                              <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                            </button>
                          ) : (
                            <span className="flex items-start gap-2 text-[14px] text-muted-foreground">
                              <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                              {label}
                            </span>
                          )}
                        </li>
                      )
                    })}
                    {tier === "free" && (
                      <li className="flex items-start gap-2 text-[14px] text-muted-foreground">
                        <X size={14} className="mt-0.5 shrink-0 text-muted-foreground/40" />
                        No paid boosts or priority placement
                      </li>
                    )}
                  </ul>

                  {tier !== "free" && !isCurrent && (
                    <button
                      type="button"
                      onClick={() => setConfirmTier(tier)}
                      className="mt-4 w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.99]"
                    >
                      Review {plan.label}
                    </button>
                  )}
                  {isCurrent && (
                    <p className="mt-3 text-center text-[11px] font-semibold text-emerald-700">
                      {formatUntil(status?.expiresAt)}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {/* FAQ */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[12px] font-bold text-foreground">Membership FAQ</p>
          {(
            [
              {
                id: "trial",
                q: "What is the welcome trial?",
                a: "New accounts may receive time-based VVIP then VIP access calculated from account creation time. Refreshing the app does not reset the trial.",
              },
              {
                id: "verify",
                q: "Is VIP the same as verification?",
                a: "No. Verification means authenticity. VIP/VVIP is a membership entitlement and never replaces verification.",
              },
              {
                id: "pay",
                q: "How do I pay?",
                a: "When purchase is enabled, upgrades use available GHC from your wallet. External card billing is not implied here.",
              },
              {
                id: "cancel",
                q: "Can I stay on Free?",
                a: "Yes. Free keeps core social access. You can review VIP/VVIP anytime without pressure.",
              },
            ] as const
          ).map((item) => (
            <div key={item.id} className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setFaqOpen((v) => (v === item.id ? null : item.id))}
                className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[14px] font-semibold text-foreground"
                aria-expanded={faqOpen === item.id}
              >
                {item.q}
                <span className="text-muted-foreground">{faqOpen === item.id ? "−" : "+"}</span>
              </button>
              {faqOpen === item.id && (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.a}</p>
              )}
            </div>
          ))}
        </div>

        {/* Explicit end spacer so last FAQ / plan actions clear device chrome & home indicator */}
        <div className="h-8 shrink-0" aria-hidden="true" />
      </div>

      {/* Honest confirm — no countdown / fake scarcity */}
      {confirmTier && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
            <h3 className="text-base font-bold text-foreground">
              Confirm {MEMBERSHIP_PLANS[confirmTier].label}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You will spend{" "}
              <strong className="text-foreground">
                {period === "monthly"
                  ? MEMBERSHIP_PLANS[confirmTier].priceGhcMonthly
                  : MEMBERSHIP_PLANS[confirmTier].priceGhcYearly}{" "}
                GHC
              </strong>{" "}
              from your wallet for a {period} period. Benefits activate via the entitlement system.
              This does not change verification or reputation.
            </p>
            <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-muted/50 px-3 py-2">
              {MEMBERSHIP_PLANS[confirmTier].entitlements.slice(0, 6).map((key) => (
                <li key={key} className="flex items-center gap-2 text-[11px] text-foreground">
                  <Check size={12} className="text-emerald-600" />
                  {ENTITLEMENT_META[key]?.label || key}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              You can stay on Free anytime. No auto-charge of external currency is implied.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmTier(null)}
                className="flex-1 rounded-2xl border border-border py-2.5 text-sm font-bold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === confirmTier}
                onClick={() => void purchase(confirmTier)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy === confirmTier ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm with GHC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-purchase confirmation */}
      {successStatus && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:mb-8 sm:rounded-3xl">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {MEMBERSHIP_PLANS[successStatus.tier].label} is active
                </h3>
                <p className="text-[12px] font-medium text-emerald-700">
                  {formatUntil(successStatus.expiresAt)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Entitlements below are live. Open any item to use it in the product.
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {MEMBERSHIP_PLANS[successStatus.tier].entitlements.map((key) => {
                const meta = ENTITLEMENT_META[key]
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        openEntitlementLink(meta?.link)
                        setSuccessStatus(null)
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                    >
                      <EntitlementIcon name={meta?.icon} />
                      <span className="min-w-0 flex-1">{meta?.label || key}</span>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => setSuccessStatus(null)}
              className="mt-4 w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
