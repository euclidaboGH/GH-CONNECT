"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import {
  ArrowLeft,
  Award,
  Clock,
  Sparkles,
  Target,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
} from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { GhcSocialFuelNote } from "./ghc-social-fuel-note"
import { getBoundDomainServices } from "@/lib/domains/compat"
import {
  createChallengeEngine,
  computeProfileCompletionPct,
  type ChallengeStatus,
  type ChallengeCard,
} from "@/lib/domains/reward-challenges"
import type { RewardRecord, RewardRule, GhcWalletSnapshot } from "@/lib/domains/economy-types"
import type { AchievementDefinition } from "@/lib/domains/achievement-domain"
import {
  getUserXp,
  xpProgress,
  getDailyStreak,
  claimDailyStreak,
  DAILY_STREAK_GHC,
} from "@/lib/domains/reward-level-domain"
import { useGHC } from "@/contexts/ghc-context"
import { RewardsJourneyHero } from "./rewards-journey-hero"
import { fetchServerAchievements } from "@/lib/profile/server-profile-sync"

type Tab = "opportunities" | "challenges" | "history" | "achievements"

/** Canonical unlocked achievement row from achievement domain */
type UnlockedAchievementRow = AchievementDefinition & { unlockedAt: number }

type RewardsSnapshot = {
  wallet: GhcWalletSnapshot | null | undefined
  rewards: RewardRecord[]
  rules: RewardRule[]
  pending: RewardRecord[]
  challenges: ChallengeCard[]
  achievements: UnlockedAchievementRow[]
  streak: {
    weekKey: string
    qualityDays: number
    lastQualityDayKey: string | null
    note: string
  }
}

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0.00"
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

const STATUS_STYLE: Record<ChallengeStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/40",
  in_progress: "bg-sky-50 text-sky-800 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/40",
  pending_validation: "bg-amber-50 text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/40",
  completed: "bg-stone-100 text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300",
  expired: "bg-stone-100 text-stone-400 ring-1 ring-stone-200",
  locked: "bg-stone-100 text-stone-400 ring-1 ring-stone-200",
}

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  available: "Available",
  in_progress: "In progress",
  pending_validation: "Ready to claim",
  completed: "Credited",
  expired: "Expired",
  locked: "Locked",
}

function navigateTab(tab: string) {
  try {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
  } catch {
    /* */
  }
}

function runCta(hint?: string) {
  switch (hint) {
    case "profile":
      navigateTab("profile")
      break
    case "communities":
      navigateTab("communities")
      break
    case "feed":
      navigateTab("feed")
      break
    case "find":
      navigateTab("discover")
      break
    case "marketplace":
      navigateTab("discover")
      break
    default:
      break
  }
}

export function RewardsCentreScreen({
  onBack,
  onOpenWallet,
}: {
  onBack: () => void
  onOpenWallet?: () => void
}) {
  const [tab, setTab] = useState<Tab>("challenges")
  const [tick, setTick] = useState<number>(0)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [claimedFlash, setClaimedFlash] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [achievementsHydrating, setAchievementsHydrating] = useState(true)
  /** Durable unlocks from /api/profile/achievements (merged with local domain) */
  const [serverAchievements, setServerAchievements] = useState<UnlockedAchievementRow[]>(
    []
  )
  const ghc = useGHC()
  const profile = ghc.profile
  // Optional community lists may be present on the provider value without being
  // declared on GHCContextType; read them via a narrow intersection (no unknown[]).
  const communities = useMemo(() => {
    type CommunityRow = { id: string; membership?: string }
    const bag = ghc as typeof ghc & {
      communities?: CommunityRow[]
      groups?: CommunityRow[]
    }
    return bag.communities || bag.groups || []
  }, [ghc])

  const userId = String(profile?.id || "").trim() || "current-user"

  const signals = useMemo(() => {
    // tick: recompute after claim/refresh (external challenge/progress stores)
    void tick
    const pct = computeProfileCompletionPct(profile)
    const joined = Array.isArray(communities)
      ? communities.filter((c) => c.membership === "member" || c.membership === "joined" || !c.membership).length
      : 0
    // Quality metrics stay conservative without backend; progress comes from challenge storage + profile
    return {
      profileCompletionPct: pct,
      communitiesJoined: joined,
      qualityPostsOrComments: 0,
      marketplaceOrdersCompleted: 0,
      verifiedReferrals: 0,
      communityActivities: 0,
    }
  }, [profile, communities, tick])

  const snapshot = useMemo((): RewardsSnapshot => {
    void tick
    try {
      const services = getBoundDomainServices()
      const eco = services?.economy
      const wallet = eco?.getWallet?.() ?? null
      const rewards: RewardRecord[] = eco?.getRewards?.(50) || []
      const rules: RewardRule[] = eco?.getRules?.() || []
      const pending = rewards.filter(
        (r) =>
          r.validationStatus === "pending_validation" ||
          r.validationStatus === "eligible"
      )
      const engine = createChallengeEngine(userId)
      const challenges = engine.getChallengeCards(signals)
      const streak = engine.getQualityStreak()
      const localAchievements: UnlockedAchievementRow[] =
        services?.achievements?.getUnlockedForProfile?.() || []
      // Prefer durable server unlocks when present; union by id
      const byId = new Map<string, UnlockedAchievementRow>()
      for (const a of localAchievements) {
        if (a?.id) byId.set(String(a.id), a)
      }
      for (const a of serverAchievements) {
        if (a?.id) byId.set(String(a.id), a)
      }
      const achievements = Array.from(byId.values())
      return { wallet, rewards, rules, pending, challenges, achievements, streak }
    } catch {
      return {
        wallet: null,
        rewards: [],
        rules: [],
        pending: [],
        challenges: [],
        achievements: [],
        streak: {
          weekKey: "",
          qualityDays: 0,
          lastQualityDayKey: null,
          note: "Quality days only — not likes or self-interaction",
        },
      }
    }
  }, [tick, userId, signals, serverAchievements])

  // Hydrate durable achievements (does not mint; display only)
  useEffect(() => {
    let cancelled = false
    setAchievementsHydrating(true)
    void fetchServerAchievements()
      .then((r) => {
        if (cancelled) return
        if (!r.ok) {
          setAchievementsHydrating(false)
          return
        }
        const rows: UnlockedAchievementRow[] = (r.achievements || []).map((a) => ({
          id: a.achievementId,
          title: a.achievementId.replace(/_/g, " "),
          description: r.durable ? "Unlocked on this account" : undefined,
          unlockedAt: a.unlockedAt,
        })) as UnlockedAchievementRow[]
        setServerAchievements(rows)
      })
      .finally(() => {
        if (!cancelled) setAchievementsHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const recommended = useMemo(
    () =>
      snapshot.challenges
        .filter((c) => c.recommended && c.status !== "completed")
        .slice(0, 3),
    [snapshot.challenges]
  )

  const stackedPending = useMemo(() => {
    const map = new Map<string, { sample: RewardRecord; ids: string[]; amount: number }>()
    for (const r of snapshot.pending) {
      const key = `${r.reason || r.category || "reward"}|${r.amount}`
      const cur = map.get(key)
      if (cur) {
        cur.ids.push(String(r.id))
        cur.amount += Number(r.amount) || 0
      } else {
        map.set(key, {
          sample: r,
          ids: [String(r.id)],
          amount: Number(r.amount) || 0,
        })
      }
    }
    return Array.from(map.values())
  }, [snapshot.pending])

  const refresh = useCallback(() => {
    setTick((n) => n + 1)
    setStatusMsg("Refreshing rewards…")
    window.setTimeout(() => setStatusMsg(null), 1200)
  }, [])

  useEffect(() => {
    const tabHandler = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: Tab }>).detail?.tab
      if (next === "opportunities" || next === "challenges" || next === "history" || next === "achievements") {
        setTab(next)
      }
    }
    window.addEventListener("ghc:open-rewards-tab", tabHandler)
    return () => window.removeEventListener("ghc:open-rewards-tab", tabHandler)
  }, [])

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
    if (!showLearnMore) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLearnMore(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showLearnMore])


  const claimPendingReward = useCallback(
    async (rewardId: string) => {
      if (claimingId) return
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        ghc.addToast?.("You are offline. Claims need a connection so the ledger can confirm.", "info")
        return
      }
      setClaimingId(rewardId)
      setStatusMsg("Claiming…")
      try {
        const eco = getBoundDomainServices()?.economy
        if (!eco?.claimReward) {
          ghc.addToast?.("Claim unavailable right now", "error")
          return
        }
        const res = await eco.claimReward(rewardId)
        if (!res.ok) {
          ghc.addToast?.(res.error || "Could not claim reward", "error")
        } else {
          setClaimedFlash(rewardId)
          ghc.addToast?.("Claimed — GHC is available in Wallet", "success")
          try {
            window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
          } catch {
            /* */
          }
          window.setTimeout(() => setClaimedFlash(null), 2000)
        }
        setTick((x) => x + 1)
      } catch (e) {
        ghc.addToast?.(e instanceof Error ? e.message : "Claim failed", "error")
      } finally {
        setClaimingId(null)
      }
    },
    [ghc, claimingId]
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-card/95 px-3 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold tracking-tight text-foreground">Your GHC journey</h1>
          <p className="text-[11px] text-muted-foreground">
            Daily · missions · achievements · not pay-to-win
          </p>
        </div>
        {onOpenWallet && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="min-h-10 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Wallet
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          className="min-h-10 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm transition hover:bg-muted"
        >
          Refresh
        </button>
      </header>

      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg || (achievementsHydrating ? "Loading achievements" : "")}
      </div>
      {isOffline ? (
        <div
          className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Offline — journey progress already on this device stays visible. Claims need a connection so the ledger can confirm.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]">
        <div className="px-4 pt-3">
          <GhcSocialFuelNote />
        </div>

        <RewardsJourneyHero
          userId={userId}
          onClaimed={refresh}
          onOpenWallet={onOpenWallet}
        />

        {/* Weekly quality streak — real qualityDays only (not likes) */}
        <div className="mx-3 mt-3 flex items-start gap-3 rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 ring-1 ring-orange-200/80 dark:bg-orange-950/60 dark:ring-orange-900/50">
            <Flame size={18} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground">
              Weekly quality streak · {snapshot.streak.qualityDays}/7 days
            </p>
            <div
              className="mt-2 flex gap-1"
              role="progressbar"
              aria-valuenow={snapshot.streak.qualityDays}
              aria-valuemin={0}
              aria-valuemax={7}
              aria-label="Weekly quality streak days"
            >
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < snapshot.streak.qualityDays
                      ? "bg-orange-500"
                      : "bg-orange-200/80 dark:bg-orange-900"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Counts days with verified quality contributions (posts, helpful comments, community
              activity). Never likes, self-interaction, or spam.
            </p>
          </div>
        </div>

        {((snapshot.wallet?.pending ?? 0) > 0 || snapshot.pending.length > 0) && (
          <div className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-[11px] leading-snug text-amber-900 dark:text-amber-100">
              Pending GHC is held for validation (usually within 24 hours) — not spendable until
              cleared.
            </p>
            {snapshot.pending.length > 0 ? (
              <button
                type="button"
                onClick={() => setTab("history")}
                className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-300/90 bg-card px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-sm dark:text-amber-50"
              >
                Review {snapshot.pending.length} claim{snapshot.pending.length === 1 ? "" : "s"}
                <ChevronRight size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        )}

        {snapshot.wallet != null && (
          <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-2.5 shadow-sm">
            <GhcCoinIcon size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Available GHC</p>
              <p className="text-[14px] font-bold tabular-nums text-foreground">
                {formatGhc(Number(snapshot.wallet.balance) || 0)}
              </p>
            </div>
            {onOpenWallet ? (
              <button
                type="button"
                onClick={onOpenWallet}
                className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:bg-muted"
              >
                Open Wallet
              </button>
            ) : null}
          </div>
        )}

        <p className="mx-3 mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Complete missions → pending GHC → claim to available. Daily caps limit spam.{" "}
          <button
            type="button"
            className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
            onClick={() => setShowLearnMore((v) => !v)}
          >
            Learn more
          </button>
        </p>
        {claimedFlash && onOpenWallet && (
          <div className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">Claimed ✓ · added to available balance</p>
            <button type="button" onClick={onOpenWallet} className="shrink-0 rounded-full bg-[var(--gh-green)] px-3 py-1.5 text-[11px] font-bold text-white">
              View in Wallet
            </button>
          </div>
        )}
        {showLearnMore && (
          <p className="mx-3 mt-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Rewards need verified, meaningful actions. Self-likes, spam and artificial engagement
            are capped. High-value rewards may stay pending until validation (~24h). Ledger
            transactions always record event → rule → amount → status.
          </p>
        )}

        {/* Recommended for you */}
        {recommended.length > 0 && (
          <div className="mx-3 mt-3">
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Recommended for you
            </p>
            <div className="space-y-2">
              {recommended.map((card) => (
                <ChallengeCardView key={`rec-${card.challenge.id}`} card={card} compact />
              ))}
            </div>
          </div>
        )}

        <div
          className="mx-3 mt-4 flex gap-1 rounded-[1.25rem] border border-border/60 bg-card p-1 shadow-[var(--gh-card-shadow)]"
          role="tablist"
          aria-label="Rewards sections"
          onKeyDown={(e) => {
            const order: Tab[] = ["challenges", "opportunities", "history", "achievements"]
            const idx = order.indexOf(tab)
            if (idx < 0) return
            if (e.key === "ArrowRight") {
              e.preventDefault()
              setTab(order[(idx + 1) % order.length])
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              setTab(order[(idx - 1 + order.length) % order.length])
            } else if (e.key === "Home") {
              e.preventDefault()
              setTab(order[0])
            } else if (e.key === "End") {
              e.preventDefault()
              setTab(order[order.length - 1])
            }
          }}
        >
          {(
            [
              { id: "challenges" as const, label: "Missions" },
              { id: "opportunities" as const, label: "Earn" },
              { id: "history" as const, label: "History" },
              { id: "achievements" as const, label: "Achievements" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`shrink-0 flex-1 rounded-xl px-2 py-2.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                tab === item.id
                  ? "bg-[var(--gh-green)] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mx-3 mt-2 text-[11px] font-medium text-muted-foreground" aria-live="polite">
          {tab === "challenges"
            ? `${snapshot.challenges.length} mission${snapshot.challenges.length === 1 ? "" : "s"}`
            : null}
          {tab === "opportunities"
            ? `${snapshot.rules.length} earn rule${snapshot.rules.length === 1 ? "" : "s"}`
            : null}
          {tab === "history"
            ? `${snapshot.rewards.length} history item${snapshot.rewards.length === 1 ? "" : "s"}`
            : null}
          {tab === "achievements"
            ? achievementsHydrating
              ? "Loading achievements…"
              : `${snapshot.achievements.length} achievement${snapshot.achievements.length === 1 ? "" : "s"}`
            : null}
          {snapshot.pending.length > 0
            ? ` · ${snapshot.pending.length} pending claim${snapshot.pending.length === 1 ? "" : "s"}`
            : ""}
        </p>

        <div className="mx-3 mt-3 mb-8 space-y-2">
          {tab === "opportunities" && (
          <>

            <div className="mb-3 rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]" aria-label="Engagement paths">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Engagement paths
              </h2>
              <ul className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Daily reward</p>
                  <p className="text-[10px] text-muted-foreground">On Home every 24h</p>
                </li>
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Profile completion</p>
                  <p className="text-[10px] text-muted-foreground">Finish profile fields</p>
                </li>
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Community activity</p>
                  <p className="text-[10px] text-muted-foreground">Posts & groups</p>
                </li>
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Social milestones</p>
                  <p className="text-[10px] text-muted-foreground">Friends & messages</p>
                </li>
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Referrals</p>
                  <p className="text-[10px] text-muted-foreground">Invite pioneers</p>
                </li>
                <li className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2.5 shadow-sm">
                  <p className="font-bold text-foreground">Campaigns</p>
                  <p className="text-[10px] text-muted-foreground">Limited-time events</p>
                </li>
              </ul>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Credits are ledger-backed after validation — never minted only on the device.
              </p>
            </div>

              <p className="px-1 text-[11px] font-semibold text-muted-foreground">
                Activity credit opportunities (configured rules)
              </p>
              {snapshot.rules.length === 0 ? (
                <Empty title="No active rules" body="Reward rules load from the economy domain." />
              ) : (
                snapshot.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <GhcCoinIcon size={18} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {rule.description || rule.id}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {rule.category} · up to {rule.amount} GHC
                            {rule.dailyLimit ? ` · max ${rule.dailyLimit}/day` : ""}
                          </p>
                          {rule.requiresValidation && (
                            <p className="mt-1 text-[10px] font-medium text-amber-700">
                              May require validation before credit
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <GhcCoinIcon size={14} />
                        +{rule.amount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "challenges" && (
            <>
              <p className="px-1 text-[11px] font-semibold text-muted-foreground">
                Progress, status and next step — GHC still validates on the ledger
              </p>
              {snapshot.challenges.map((card) => (
                <ChallengeCardView key={card.challenge.id} card={card} />
              ))}
            </>
          )}

          {tab === "history" && (
            <>
              <p className="mb-1 flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0" />
                Each line teaches the economy: event → rule → amount → status
              </p>
              {snapshot.rewards.length === 0 ? (
                <Empty
                  title="No reward history"
                  body="Complete your profile to unlock first activity credits. Each history line shows event → rule → amount → status."
                />
              ) : (
                snapshot.rewards.map((r) => {
                  // Canonical RewardValidationStatus only (no legacy "pending")
                  const status = r.validationStatus
                  const claimLabel =
                    status === "eligible" ||
                    status === "approved" ||
                    status === "pending_validation"
                      ? "Ready to claim"
                      : "Under review"
                  return (
                    <div
                      key={r.id}
                      className="rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          {status === "pending_validation" || status === "eligible" ? (
                            <Clock size={14} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {r.reason || r.category || r.ruleId || "Reward"}
                            </p>
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <GhcCoinIcon size={16} />
                              +{formatGhc(r.amount)}
                            </span>
                          </div>
                          <ol className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                            <li>
                              <span className="font-semibold text-foreground/80">Event:</span>{" "}
                              {r.sourceEvent || "platform"}
                            </li>
                            <li>
                              <span className="font-semibold text-foreground/80">Rule:</span>{" "}
                              {r.ruleId || r.category || "reward rule"}
                            </li>
                            <li>
                              <span className="font-semibold text-foreground/80">Amount:</span>{" "}
                              +{formatGhc(r.amount)} GHC
                            </li>
                            <li>
                              <span className="font-semibold text-foreground/80">Status:</span>{" "}
                              <span className="font-bold capitalize">{String(status).replace(/_/g, " ")}</span>
                              {(status === "pending_validation" || status === "eligible") && (
                                <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                  {claimLabel}
                                </span>
                              )}
                            </li>
                          </ol>
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            {formatWhen(r.createdAt)}
                          </p>
                          {(status === "pending_validation" ||
                            status === "eligible" ||
                            status === "approved") && (
                            <button
                              type="button"
                              onClick={() => void claimPendingReward(String(r.id))}
                              disabled={claimingId === String(r.id) || isOffline}
                              className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-[1.25rem] bg-[var(--gh-green)] px-3 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-emerald-700/15 transition hover:brightness-110 disabled:opacity-60"
                            >
                              {claimingId === String(r.id) ? "Claiming…" : claimedFlash === String(r.id) ? "✓ Claimed" : "Claim to available GHC"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}

          {tab === "achievements" && (
            <>
              <p className="px-1 text-[11px] text-muted-foreground">
                Achievements are milestones — separate from GHC balance.
              </p>
              {snapshot.achievements.length === 0 ? (
                <Empty
                  title="No achievements unlocked"
                  body="Profile Builder, Community Builder and others unlock through verified activity."
                />
              ) : (
                snapshot.achievements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/40">
                      <Award size={18} className="text-amber-600" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground">
                        {a.title || a.id}
                      </p>
                      {a.description ? (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {a.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ChallengeCardView({
  card,
  compact,
}: {
  card: ChallengeCard
  compact?: boolean
}) {
  const { challenge, status, percent, nextStep } = card
  const progress = card.progress
  const targetLabel =
    challenge.id === "challenge_profile_complete"
      ? `${percent}%`
      : `${progress.progress}/${progress.target}`

  return (
    <div
      className={`rounded-[1.25rem] border bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)] ${
        card.recommended && status !== "completed"
          ? "border-emerald-200/90 dark:border-emerald-800/60"
          : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="gh-icon-tile mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center">
            <Target size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[14px] font-semibold text-foreground">{challenge.title}</p>
              {card.recommended && status !== "completed" && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/40">
                  For you
                </span>
              )}
            </div>
            {!compact && (
              <>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {challenge.description}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Why: </span>
                  {challenge.why}
                </p>
              </>
            )}

            <div className="mt-2.5">
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                <span className="font-semibold">Progress</span>
                <span className="font-semibold text-foreground">
                  {targetLabel}
                  {challenge.rewardAmount ? ` · +${challenge.rewardAmount} GHC` : ""}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(Math.min(100, percent))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${challenge.title} progress`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    status === "completed"
                      ? "bg-stone-400"
                      : status === "pending_validation"
                        ? "bg-amber-500"
                        : "bg-[var(--gh-green)]"
                  }`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>

            <p className="mt-2 text-[11px] font-medium text-foreground/90">{nextStep}</p>
            {(status === "available" || status === "in_progress") && challenge.ctaHint && (
              <button
                type="button"
                onClick={() => runCta(challenge.ctaHint)}
                className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--gh-green)] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm"
              >
                {status === "in_progress" ? "Continue" : "Start"}
                <ChevronRight size={12} aria-hidden />
              </button>
            )}
            {status === "pending_validation" && (
              <button
                type="button"
                onClick={() => {
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:open-settings-section", {
                        detail: { section: "wallet" },
                      })
                    )
                  } catch {
                    /* */
                  }
                }}
                className="mt-2.5 inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-300/90 bg-amber-50 px-3.5 py-1.5 text-[11px] font-bold text-amber-900 shadow-sm"
              >
                View pending in Wallet
                <ChevronRight size={12} aria-hidden />
              </button>
            )}
            {status === "completed" && (
              <button
                type="button"
                onClick={() => {
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:open-settings-section", {
                        detail: { section: "wallet" },
                      })
                    )
                  } catch {
                    /* */
                  }
                }}
                className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3.5 py-1.5 text-[11px] font-bold text-foreground"
              >
                Open Wallet
                <ChevronRight size={12} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          {challenge.rewardAmount != null && Number(challenge.rewardAmount) > 0 && (
            <p className="mt-1.5 inline-flex items-center justify-end gap-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <GhcCoinIcon size={16} />
              +{challenge.rewardAmount}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-card px-5 py-12 text-center shadow-[var(--gh-card-shadow)]">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
        <GhcCoinIcon size={28} />
      </div>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
