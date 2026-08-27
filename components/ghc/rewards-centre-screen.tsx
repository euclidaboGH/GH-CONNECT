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
import type { RewardRecord } from "@/lib/domains/economy-types"
import {
  getUserXp,
  xpProgress,
  getDailyStreak,
  claimDailyStreak,
  DAILY_STREAK_GHC,
} from "@/lib/domains/reward-level-domain"
import { useGHC } from "@/contexts/ghc-context"

type Tab = "opportunities" | "challenges" | "history" | "achievements"

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
  available: "bg-emerald-50 text-emerald-800",
  in_progress: "bg-sky-50 text-sky-800",
  pending_validation: "bg-amber-50 text-amber-900",
  completed: "bg-stone-100 text-stone-600",
  expired: "bg-stone-100 text-stone-400",
  locked: "bg-stone-100 text-stone-400",
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
  const [tick, setTick] = useState(0)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [claimedFlash, setClaimedFlash] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const ghc = useGHC() as {
    profile?: Record<string, unknown>
    communities?: Array<{ id: string; membership?: string }>
    groups?: Array<{ id: string; membership?: string }>
    addToast?: (message: string, type?: string) => void
  }
  const profile = ghc.profile
  const communities = ghc.communities || ghc.groups || []

  const userId =
    (profile?.id as string) ||
    (profile?.userId as string) ||
    "current-user"

  const signals = useMemo(() => {
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

  const snapshot = useMemo(() => {
    void tick
    try {
      const services = getBoundDomainServices()
      const eco = services?.economy
      const wallet = eco?.getWallet?.()
      const rewards = (eco?.getRewards?.(50) || []) as RewardRecord[]
      const rules = eco?.getRules?.() || []
      const pending = rewards.filter(
        (r) =>
          r.validationStatus === "pending_validation" ||
          r.validationStatus === "eligible" ||
          (r as { status?: string }).status === "pending"
      )
      const engine = createChallengeEngine(userId)
      const challenges = engine.getChallengeCards(signals)
      const streak = engine.getQualityStreak()
      const achievements = services?.achievements?.getUnlockedForProfile?.() || []
      return { wallet, rewards, rules, pending, challenges, achievements, streak }
    } catch {
      return {
        wallet: null,
        rewards: [] as RewardRecord[],
        rules: [] as unknown[],
        pending: [] as RewardRecord[],
        challenges: [] as ChallengeCard[],
        achievements: [] as unknown[],
        streak: {
          weekKey: "",
          qualityDays: 0,
          lastQualityDayKey: null,
          note: "Quality days only — not likes or self-interaction",
        },
      }
    }
  }, [tick, userId, signals])

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
      const key = `${(r as { reason?: string }).reason || (r as { category?: string }).category || "reward"}|${r.amount}`
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

  const refresh = useCallback(() => setTick((t) => t + 1), [])

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


  const claimPendingReward = useCallback(
    async (rewardId: string) => {
      if (claimingId) return
      setClaimingId(rewardId)
      try {
        const eco = getBoundDomainServices()?.economy as
          | { claimReward?: (id: string) => Promise<{ ok: boolean; error?: string }> }
          | undefined
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
          <h1 className="text-sm font-bold text-foreground">Rewards Centre</h1>
          <p className="text-[11px] text-muted-foreground">
            Missions · XP · daily streak · not pay-to-win
          </p>
        </div>
        {onOpenWallet && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800"
          >
            Wallet
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
        >
          Refresh
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]">
        <div className="px-4 pt-3">
          <GhcSocialFuelNote />
        </div>

        {/* Dual axis: Membership stays separate; Reward Level is activity XP */}
        {(() => {
          const xp = getUserXp(userId)
          const prog = xpProgress(xp)
          let membershipTier = "free"
          try {
            const st = getBoundDomainServices()?.membership?.getStatus?.() as
              | { tier?: string }
              | null
            membershipTier = String(st?.tier || "free").toLowerCase()
          } catch {
            /* */
          }
          const daily = getDailyStreak(userId, membershipTier)
          const track = [1, 2, 3, 4, 5, 6, 7].map(
            (d) => DAILY_STREAK_GHC[d] /* display base; claim uses tier track */
          )
          return (
            <div className="mx-4 mt-3 space-y-2">
              <div className="rounded-2xl border border-border bg-card px-3 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Reward Level · activity only
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">
                      <span style={{ color: prog.level.color }}>{prog.level.label}</span>
                      <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                        {xp.toLocaleString()} XP
                      </span>
                    </p>
                  </div>
                  <Award size={20} className="text-emerald-600" aria-hidden />
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${prog.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {prog.nextAt != null
                    ? `${prog.pct}% to next level · ${prog.nextAt.toLocaleString()} XP`
                    : "Top reward level"}
                  {" · "}Membership (Free/VIP/VVIP) is separate and does not buy XP.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      Daily streak · {membershipTier === "free" ? "Member" : membershipTier.toUpperCase()} track
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">
                      Day {daily.displayCycleDay}/7
                      {daily.streakDays > 0 ? (
                        <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                          · {daily.streakDays} day streak
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Resets 00:00 Africa/Lagos · base track:{" "}
                      {track.map((v, i) => `${i + 1}=${v}`).join(" · ")} GHC
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!daily.canClaimToday}
                    onClick={() => {
                      const res = claimDailyStreak(userId, membershipTier)
                      if (!res.ok) {
                        ghc.addToast?.(res.error || "Already claimed", "error")
                        return
                      }
                      // Stage + claim on ledger (idempotent via reference day key)
                      void (async () => {
                        try {
                          const eco = getBoundDomainServices()?.economy as {
                            evaluateReward?: (i: {
                              sourceEvent: string
                              referenceId?: string
                            }) => Promise<{
                              ok: boolean
                              data?: { rewards?: Array<{ id: string }> }
                            }>
                            claimReward?: (id: string) => Promise<{ ok: boolean }>
                          } | null
                          if (eco?.evaluateReward) {
                            const ref = `daily_checkin:${userId}:${daily.rewardDayKey}`
                            const ev = await eco.evaluateReward({
                              sourceEvent: "DAILY_CHECKIN",
                              referenceId: ref,
                            })
                            for (const r of ev?.data?.rewards || []) {
                              await eco.claimReward?.(r.id)
                            }
                          }
                        } catch {
                          /* offline / deferred */
                        }
                        ghc.addToast?.(
                          `Day ${res.cycleDay}: +${res.ghc} GHC · +${res.xp} XP${
                            res.usedShield ? " · shield used" : ""
                          }`,
                          "success"
                        )
                        setTick((t) => t + 1)
                        try {
                          window.dispatchEvent(
                            new CustomEvent("ghc:daily-reward-claimed", { detail: res })
                          )
                        } catch {
                          /* */
                        }
                      })()
                    }}
                    className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-bold ${
                      daily.canClaimToday
                        ? "bg-emerald-700 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {daily.canClaimToday ? `Claim ${daily.todayGhc} GHC` : "Claimed"}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Pending → Claim → Available funnel */}
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">How rewards work</p>
          <div className="mt-2 flex items-center justify-between gap-1 text-center">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">Pending</p>
              <p className="text-[10px] text-muted-foreground">Held for checks</p>
            </div>
            <span className="text-muted-foreground" aria-hidden>→</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-sky-800 dark:text-sky-300">Claim</p>
              <p className="text-[10px] text-muted-foreground">When ready</p>
            </div>
            <span className="text-muted-foreground" aria-hidden>→</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">Available</p>
              <p className="text-[10px] text-muted-foreground">In Wallet</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Quality activity only — spam and self-interaction do not qualify.{" "}
            <button type="button" onClick={() => setShowLearnMore(true)} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
              Rules
            </button>
          </p>
        </div>

        {/* Balance strip */}
        <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold text-muted-foreground">GHC balance</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <GhcCoinIcon size={22} />
              <p className="text-lg font-bold text-emerald-700">
                {formatGhc(snapshot.wallet?.balance ?? 0)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-amber-700">
              {formatGhc(
                (snapshot.wallet?.pending ?? 0) ||
                  snapshot.pending.reduce((s, r) => s + (r.amount || 0), 0)
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Earned</p>
            <p className="text-lg font-bold text-foreground">
              {formatGhc(snapshot.wallet?.lifetimeEarned ?? 0)}
            </p>
          </div>
        </div>

        {/* Weekly quality streak (careful — not likes) */}
        <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/80 px-3 py-3 dark:border-orange-900 dark:bg-orange-950/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <Flame size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Weekly quality streak · {snapshot.streak.qualityDays}/7 days
            </p>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < snapshot.streak.qualityDays ? "bg-orange-500" : "bg-orange-200/80 dark:bg-orange-900"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Counts days with verified quality contributions (posts, helpful comments, community
              activity). Never likes, self-interaction, or spam.
            </p>
          </div>
        </div>

        {((snapshot.wallet?.pending ?? 0) > 0 || snapshot.pending.length > 0) && (
          <p className="mx-3 mt-2 text-[11px] text-amber-800/90">
            Pending GHC is held for validation (usually within 24 hours) — not spendable until
            cleared.
          </p>
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
            <button type="button" onClick={onOpenWallet} className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">
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

        <div className="mx-4 mt-3 flex gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
          {(
            [
              { id: "challenges" as const, label: "Missions" },
              { id: "opportunities" as const, label: "Earn" },
              { id: "history" as const, label: "History" },
              { id: "achievements" as const, label: "Achievements" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex-1 rounded-xl px-2 py-2 text-[11px] font-bold ${
                tab === t.id ? "bg-emerald-600 text-white" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mx-3 mt-3 mb-8 space-y-2">
          {tab === "opportunities" && (
            <>
              <p className="px-1 text-[11px] font-semibold text-muted-foreground">
                Activity credit opportunities (configured rules)
              </p>
              {snapshot.rules.length === 0 ? (
                <Empty title="No active rules" body="Reward rules load from the economy domain." />
              ) : (
                snapshot.rules.map((rule: { id: string; description?: string; category?: string; amount?: number; dailyLimit?: number; requiresValidation?: boolean }) => (
                  <div
                    key={rule.id}
                    className="rounded-2xl border border-border bg-card px-3 py-3"
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
                  const status =
                    r.validationStatus ||
                    (r as { status?: string }).status ||
                    "posted"
                  const claimLabel =
                    status === "eligible" || status === "approved"
                      ? "Ready to claim"
                      : status === "pending_validation" || status === "pending"
                        ? "Ready to claim"
                        : "Under review"
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-border bg-card px-3 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          {status === "pending" || status === "pending_validation" ? (
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
                              {(status === "pending_validation" || status === "eligible" || status === "pending") && (
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
                            status === "approved" ||
                            status === "pending") && (
                            <button
                              type="button"
                              onClick={() => void claimPendingReward(String(r.id))}
                              disabled={claimingId === String(r.id)}
                              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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
                snapshot.achievements.map((a: { id: string; title?: string; name?: string; description?: string }) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3"
                  >
                    <Award size={18} className="text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {a.title || a.name || a.id}
                      </p>
                      {a.description && (
                        <p className="text-[11px] text-muted-foreground">{a.description}</p>
                      )}
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
      className={`rounded-2xl border bg-card px-3 py-3 ${
        card.recommended && status !== "completed"
          ? "border-emerald-200 shadow-sm shadow-emerald-600/5"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Target size={16} className="mt-0.5 shrink-0 text-teal-600" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">{challenge.title}</p>
              {card.recommended && status !== "completed" && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                  For you
                </span>
              )}
            </div>
            {!compact && (
              <>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{challenge.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Why: </span>
                  {challenge.why}
                </p>
              </>
            )}

            {/* Always show progress bar */}
            <div className="mt-2">
              <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
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
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>

            {/* Claim / track next step */}
            <p className="mt-2 text-[11px] font-medium text-foreground/90">{nextStep}</p>
            {(status === "available" || status === "in_progress") && challenge.ctaHint && (
              <button
                type="button"
                onClick={() => runCta(challenge.ctaHint)}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                {status === "in_progress" ? "Continue" : "Start"}
                <ChevronRight size={12} />
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
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900"
              >
                View pending in Wallet
                <ChevronRight size={12} />
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
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5 text-[11px] font-bold text-foreground"
              >
                Open Wallet
                <ChevronRight size={12} />
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
          <p className="mt-1 inline-flex items-center gap-0.5 text-sm font-bold text-emerald-700">
            <GhcCoinIcon size={16} />
            +{challenge.rewardAmount}
          </p>
        </div>
      </div>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <Sparkles size={20} className="mx-auto text-muted-foreground/40" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  )
}
