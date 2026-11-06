"use client"

import { apiRequest } from "@/lib/client/api-request"


import { useMemo, useState, useCallback, useEffect, useRef } from "react"
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
  Search,
  X,
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
import { useRegionalContext } from "@/contexts/regional-context"
import { getProductMessage } from "@/lib/i18n/product"
import { useSectionRefresh } from "@/hooks/use-section-refresh"
import { RewardsJourneyHero } from "./rewards-journey-hero"
import { PiCashbackSummary } from "./pi-cashback-summary"
import { RegistrationBonusCard } from "./registration-bonus-card"
import { SurfaceIntro } from "./ui/product-surface"
import { EconomyProgramStatus } from "./economy-program-status"
import { ReferralShareCard } from "./referral-share-card"
import { fetchServerAchievements } from "@/lib/profile/server-profile-sync"
import { navigateGhcActivityTarget, resolveRewardActivityTarget } from "@/lib/domains/ghc-activity-attribution"
import { reportMissionProgress, type MissionCode } from "@/lib/missions/progress"

type Tab = "opportunities" | "challenges" | "history" | "achievements"

/** Canonical unlocked achievement row from achievement domain */
type UnlockedAchievementRow = AchievementDefinition & { unlockedAt: number }

type ServerRewardTransaction = {
  id: string
  amount: number
  status: "pending" | "posted" | "reversed" | "expired" | "failed"
  reason: string
  sourceEvent: string
  referenceId?: string
  createdAt: number
}


const MISSION_CODE_BY_CHALLENGE: Record<string, MissionCode> = {
  challenge_profile_complete: "complete_profile",
  challenge_join_community: "join_community",
  challenge_meaningful_contribution: "meaningful_contribution",
}

function missionCodeForChallenge(challengeId: string): MissionCode | null {
  return MISSION_CODE_BY_CHALLENGE[challengeId] || null
}

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

function formatGhc(n: number): string {
  if (!Number.isFinite(n)) return "₲ 0.00"
  return `₲ ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function readNonNegativeAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  return null
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
  pending_validation: "Ready to verify",
  completed: "Progress complete",
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
  const regional = useRegionalContext()
  const msg = useCallback((key: Parameters<typeof getProductMessage>[0]) => getProductMessage(key, regional.locale), [regional.locale])
  const [tab, setTab] = useState<Tab>("challenges")
  const [tick, setTick] = useState<number>(0)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [claimedFlash, setClaimedFlash] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [historyQuery, setHistoryQuery] = useState("")
  const [historyStatus, setHistoryStatus] = useState<"all" | ServerRewardTransaction["status"]>("all")
  const [serverRewardTransactions, setServerRewardTransactions] = useState<ServerRewardTransaction[] | null>(null)
  const [serverHistoryStatus, setServerHistoryStatus] = useState<"loading" | "ready" | "unavailable">("loading")
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [achievementsHydrating, setAchievementsHydrating] = useState(true)
  const [achievementRefreshTick, setAchievementRefreshTick] = useState(0)
  const [verifyingMissionId, setVerifyingMissionId] = useState<string | null>(null)
  /** Durable unlocks from /api/profile/achievements (merged with local domain) */
  const [serverAchievements, setServerAchievements] = useState<UnlockedAchievementRow[]>(
    []
  )
  const [serverEconomy, setServerEconomy] = useState<{
    balance: number | null
    pending: number | null
    locked: number | null
    curationBalance: number | null
    canFundCuration: boolean | null
  }>({ balance: null, pending: null, locked: null, curationBalance: null, canFundCuration: null })
  const [economyStatus, setEconomyStatus] = useState<"loading" | "refreshing" | "ready" | "unavailable">("loading")
  const economyOwnerRef = useRef<string | null>(null)
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
      // Only durable server unlocks are presented as achievements. Browser-local
      // progress can guide a journey, but it is not proof of an unlocked milestone.
      const achievements = serverAchievements.filter((row) => Boolean(row?.id))
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

  // Use the same server-authoritative economy snapshot as Wallet.
  // Bound the request, isolate account changes, and reject null/invalid amounts
  // rather than accidentally presenting Number(null) as a confirmed zero.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8_000)
    if (economyOwnerRef.current !== userId) {
      economyOwnerRef.current = userId
      setServerEconomy({ balance: null, pending: null, locked: null, curationBalance: null, canFundCuration: null })
      setEconomyStatus("loading")
    } else {
      setEconomyStatus("refreshing")
    }

    void fetch("/api/social/economy/status", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Economy snapshot failed (${response.status})`)
        return response.json()
      })
      .then((data: {
        ok?: boolean
        userId?: unknown
        wallet?: { balance?: unknown; pending?: unknown; locked?: unknown }
        curation?: { spendableBalance?: unknown; canFundSuggestedContribution?: unknown }
      } | null) => {
        if (cancelled) return
        if (!data || data.ok !== true || (typeof data.userId === "string" && data.userId !== userId)) {
          setEconomyStatus("unavailable")
          return
        }
        setServerEconomy({
          balance: readNonNegativeAmount(data.wallet?.balance),
          pending: readNonNegativeAmount(data.wallet?.pending),
          locked: readNonNegativeAmount(data.wallet?.locked),
          curationBalance: readNonNegativeAmount(data.curation?.spendableBalance),
          canFundCuration: typeof data.curation?.canFundSuggestedContribution === "boolean"
            ? data.curation.canFundSuggestedContribution
            : null,
        })
        setEconomyStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setEconomyStatus("unavailable")
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [tick, userId])

  // Hydrate the authenticated GHC ledger for cross-device reward history.
  // The endpoint enforces same-user access and returns authoritative transactions;
  // local domain history remains a fallback only when the server is unavailable.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8_000)
    setServerRewardTransactions(null)
    setServerHistoryStatus("loading")
    if (!userId || userId === "current-user" || userId === "anonymous") {
      setServerHistoryStatus("unavailable")
      window.clearTimeout(timeout)
      return () => controller.abort()
    }
    void fetch(`/api/economy/wallet/${encodeURIComponent(userId)}?limit=200`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Ledger history unavailable (${response.status})`)
        return response.json()
      })
      .then((data: { ok?: boolean; transactions?: Array<Record<string, unknown>> } | null) => {
        if (cancelled) return
        if (!data || data.ok !== true || !Array.isArray(data.transactions)) {
          setServerHistoryStatus("unavailable")
          return
        }
        const rows: ServerRewardTransaction[] = data.transactions.flatMap((raw) => {
          if (!raw || typeof raw !== "object" || raw.kind !== "earned") return []
          const amount = Number(raw.amount)
          const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.parse(String(raw.createdAt || ""))
          const status = String(raw.status || "")
          if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(createdAt) ||
              !["pending", "posted", "reversed", "expired", "failed"].includes(status)) return []
          const rowUserId = typeof raw.userId === "string" ? raw.userId : userId
          if (rowUserId !== userId) return []
          return [{
            id: String(raw.id || "").slice(0, 160),
            amount,
            status: status as ServerRewardTransaction["status"],
            reason: String(raw.reason || "GHC reward").slice(0, 180),
            sourceEvent: String(raw.sourceEvent || "reward").slice(0, 120),
            referenceId: raw.referenceId == null ? undefined : String(raw.referenceId).slice(0, 160),
            createdAt,
          }].filter((row) => row.id.length > 0)
        })
        setServerRewardTransactions(rows)
        setServerHistoryStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setServerHistoryStatus("unavailable")
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [userId, tick])

  // Hydrate durable achievements (does not mint; display only)
  useEffect(() => {
    let cancelled = false
    setServerAchievements([])
    setAchievementsHydrating(true)
    void fetchServerAchievements()
      .then((r) => {
        if (cancelled) return
        if (!r.ok) {
          setAchievementsHydrating(false)
          return
        }
        const rows: UnlockedAchievementRow[] = r.durable === true ? (r.achievements || []).map((a) => ({
          id: a.achievementId,
          title: a.achievementId.replace(/_/g, " "),
          description: "Durably unlocked on this account",
          unlockedAt: a.unlockedAt,
        })) as UnlockedAchievementRow[] : []
        setServerAchievements(rows)
      })
      .catch(() => {
        if (!cancelled) setServerAchievements([])
      })
      .finally(() => {
        if (!cancelled) setAchievementsHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, achievementRefreshTick])

  const verifyMission = useCallback(async (challengeId: string) => {
    const code = missionCodeForChallenge(challengeId)
    if (!code || verifyingMissionId) return
    setVerifyingMissionId(challengeId)
    setStatusMsg("Verifying milestone against GreenHaven records…")
    try {
      const result = await reportMissionProgress(code)
      if (!result.ok) {
        setStatusMsg(result.message || "Verification is temporarily unavailable. No reward was issued.")
        return
      }
      if (result.verified && result.completed) {
        setAchievementRefreshTick((value) => value + 1)
        setStatusMsg(result.alreadyCompleted
          ? "This achievement is already unlocked on your account. Mission completion does not issue GHC."
          : "Achievement verified and saved to your account. Mission completion does not issue GHC under the current policy.")
      } else {
        setStatusMsg(result.message || "This milestone is not yet verified. Complete the action and try again.")
      }
    } catch {
      setStatusMsg("Verification is temporarily unavailable. No reward was issued.")
    } finally {
      setVerifyingMissionId(null)
    }
  }, [verifyingMissionId])

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

  const filteredLocalRewardRecords = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase()
    return snapshot.rewards.filter((row) => {
      const status = String(row.validationStatus || "")
      const matchesStatus = historyStatus === "all" ||
        (historyStatus === "pending" && ["pending_validation", "eligible", "approved"].includes(status)) ||
        (historyStatus === "posted" && status === "paid") ||
        (historyStatus === "reversed" && status === "rejected") ||
        (historyStatus === "expired" && status === "expired") ||
        (historyStatus === "failed" && status === "blocked")
      const searchable = `${row.reason || ""} ${row.sourceEvent || ""} ${row.ruleId || ""} ${row.referenceId || ""}`.toLocaleLowerCase()
      return matchesStatus && (!query || searchable.includes(query))
    }).sort((a, b) => b.createdAt - a.createdAt)
  }, [snapshot.rewards, historyQuery, historyStatus])

  const filteredServerRewardTransactions = useMemo(() => {
    const rows = serverRewardTransactions || []
    const query = historyQuery.trim().toLocaleLowerCase()
    return rows
      .filter((row) => historyStatus === "all" || row.status === historyStatus)
      .filter((row) => !query || `${row.reason} ${row.sourceEvent} ${row.referenceId || ""}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [serverRewardTransactions, historyQuery, historyStatus])

  const refresh = useCallback(() => {
    setTick((n) => n + 1)
    setStatusMsg("Refreshing rewards…")
    window.setTimeout(() => setStatusMsg(null), 1200)
  }, [])

  useEffect(() => {
    const onLive = () => refresh()
    window.addEventListener("ghc:daily-reward-claimed", onLive)
    window.addEventListener("ghc:wallet-synced", onLive)
    window.addEventListener("ghc:wallet-refresh", onLive)
    return () => {
      window.removeEventListener("ghc:daily-reward-claimed", onLive)
      window.removeEventListener("ghc:wallet-synced", onLive)
      window.removeEventListener("ghc:wallet-refresh", onLive)
    }
  }, [refresh])

  useSectionRefresh("rewards", async () => {
    refresh()
  }, {
    minIntervalMs: 8_000,
    events: ["ghc:wallet-refresh", "ghc:reward-claimed", "ghc:rewards-refresh"],
  })

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


  
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:section-refresh", { detail: { section: "rewards", reason: "opened" } }))
    } catch { /* */ }
  }, [])

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
        let claimed = false
        try {
          // Phase 2: authenticated claim via shared apiRequest (headers + timeout + safe errors).
          const claimRes = await apiRequest<{ ok?: boolean; message?: string; error?: string; code?: string }>(
            "/api/economy/rewards/claim",
            {
              method: "POST",
              // The hold ID is the stable server-side idempotency/ownership key.
              body: { holdId: rewardId },
              timeoutMs: 25_000,
            },
          )
          if (claimRes.ok && claimRes.data?.ok) claimed = true
          else {
            ghc.addToast?.(
              claimRes.error ||
                claimRes.data?.message ||
                claimRes.data?.error ||
                claimRes.code ||
                `Claim failed (${claimRes.status}). Your reward remains unchanged; retry later.`,
              "error",
            )
            return
          }
        } catch {
          ghc.addToast?.("Could not reach the secure claims service. Your reward was not changed; retry when connected.", "error")
          return
        }
        if (claimed) {
          setClaimedFlash(rewardId)
          ghc.addToast?.("Reward redemption confirmed by the server. Refreshing Wallet…", "success")
          try {
            window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "reward-claimed" } }))
            window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason: "reward-claimed" } }))
          } catch { /* */ }
          try {
            const { syncWalletAfterServerClaim } = await import("@/lib/domains/adapters/wallet-sync-after-claim")
            await syncWalletAfterServerClaim({ referenceId: rewardId })
          } catch { /* a later refresh will retry; never optimistically credit */ }
          window.setTimeout(() => setClaimedFlash(null), 2000)
        }
        setTick((x) => x + 1)
      } catch (e) {
        ghc.addToast?.(e instanceof Error ? e.message : "Claim failed", "error")
      } finally {
        setClaimingId(null)
        // Never leave the Rewards Centre stuck on a stale "Claiming…" label
        // after an error, timeout, or successful server confirmation.
        setStatusMsg(null)
      }
    },
    [ghc, claimingId]
  )

  return (
    <div className="gh-world-rewards gh-rewards-shell flex h-full min-w-0 max-w-full min-h-0 flex-col bg-background text-foreground" role="region" aria-label={msg("rewardsTitle")}>

      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/95 px-2.5 py-1.5 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={17} strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-bold leading-tight tracking-tight text-foreground">{msg("rewardsTitle")}</h1>
          <p className="text-[10px] leading-tight text-muted-foreground">Daily · missions · not pay-to-win</p>
        </div>
        {onOpenWallet && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="h-8 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Wallet
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          className="h-8 rounded-full border border-border/70 bg-card px-2.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted"
          aria-label="Refresh rewards"
        >
          Refresh
        </button>
      </header>

      <div className="sr-only" role="status" aria-live="polite">
        {achievementsHydrating ? "Loading achievements" : ""}
      </div>
      {statusMsg ? (
        <div className="mx-3 mt-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-[11px] leading-relaxed text-foreground shadow-sm" role="status" aria-live="polite">
          {statusMsg}
        </div>
      ) : null}
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
          onOpenWallet={onOpenWallet}
        />

        <section className="mx-3 mt-3 rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-3 shadow-sm" aria-labelledby="rewards-balance-summary-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="rewards-balance-summary-title" className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Rewards at a glance</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Amounts below come from the server-confirmed wallet snapshot. Pending and locked rewards are not spendable.</p>
              <p className="mt-1 text-[9px] font-semibold" role="status" aria-live="polite">
                {economyStatus === "ready" ? <span className="text-emerald-700 dark:text-emerald-300">● Server snapshot confirmed</span> : economyStatus === "refreshing" ? <span className="text-muted-foreground">Refreshing confirmed snapshot…</span> : economyStatus === "loading" ? <span className="text-muted-foreground">Loading secure snapshot…</span> : <span className="text-amber-700 dark:text-amber-300">Snapshot unavailable · retry refresh</span>}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" aria-hidden="true">
              <Award size={17} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="min-w-0 rounded-xl bg-emerald-50/80 px-2.5 py-2 dark:bg-emerald-950/30">
              <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">Available</p>
              <p className="mt-1 truncate text-[13px] font-black tabular-nums text-foreground">{serverEconomy.balance == null ? "—" : formatGhc(serverEconomy.balance)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-amber-50/80 px-2.5 py-2 dark:bg-amber-950/25">
              <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">Pending</p>
              <p className="mt-1 truncate text-[13px] font-black tabular-nums text-foreground">{serverEconomy.pending == null ? "—" : formatGhc(serverEconomy.pending)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-violet-50/80 px-2.5 py-2 dark:bg-violet-950/25">
              <p className="text-[10px] font-semibold text-violet-800 dark:text-violet-300">Locked</p>
              <p className="mt-1 truncate text-[13px] font-black tabular-nums text-foreground">{serverEconomy.locked == null ? "—" : formatGhc(serverEconomy.locked)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <p className="text-[10px] text-muted-foreground">{snapshot.pending.length} reward record{snapshot.pending.length === 1 ? "" : "s"} awaiting review or maturity</p>
            <button type="button" onClick={() => setTab("history")} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              View reward history <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="mx-3 mt-3 rounded-[1.25rem] border border-emerald-200/70 bg-emerald-50/70 px-3.5 py-3 dark:border-emerald-900 dark:bg-emerald-950/25" aria-label="Recommended next action">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">Best next action</p>
          <p className="mt-1 text-[13px] font-bold text-foreground">{recommended.length > 0 ? recommended[0].challenge.title : snapshot.pending.length > 0 ? "Review pending rewards" : "Keep building quality participation"}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{recommended.length > 0 ? "This mission is currently the strongest available next step based on your verified progress." : snapshot.pending.length > 0 ? "Some rewards are still pending validation or maturity. Review their status before planning around them." : "There is no reward action you need to force. Useful posts, helpful comments and community participation build your journey naturally."}</p>
          <button type="button" onClick={() => recommended.length > 0 ? setTab("challenges") : snapshot.pending.length > 0 ? setTab("history") : setTab("opportunities")} className="mt-2.5 min-h-9 rounded-full bg-emerald-700 px-3.5 text-[11px] font-bold text-white">{recommended.length > 0 ? "View mission" : snapshot.pending.length > 0 ? "Review status" : "Explore opportunities"}</button>
        </section>

        <div className="mx-3 mt-3 rounded-2xl border border-border/60 bg-card/80 px-3.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Two different rewards</p>
          <p className="mt-1"><span className="font-semibold text-emerald-800 dark:text-emerald-300">GHC daily</span> — in-app utility, claim once per Lagos day from the feed pill.</p>
          <p className="mt-0.5"><span className="font-semibold text-sky-800 dark:text-sky-300">PI cashback</span> — 0.5% of eligible Pi spend, calculated quarterly (not the daily claim).</p>
        </div>
        <SurfaceIntro
          kicker="Earn & claim"
          title="Claims stay in Rewards"
          body="Daily claims and eligible reward requests are managed here. Verified mission milestones unlock achievements; Wallet shows balances and transaction history."
          tone="emerald"
        />
        <RegistrationBonusCard compact />
        {/* Phase 4: PI withdraw + payout authorization live only on Wallet (no duplicate dashboards). */}
        <PiCashbackSummary />
        <div className="mx-3 mt-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
          <p className="text-[12px] font-bold text-foreground">Pi withdrawals</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Authorize payouts and withdraw available Pi from Wallet. Claims stay here; balances and History stay on Wallet.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:open-settings-section", {
                    detail: { section: "wallet", focus: "gh-pi-earnings-tools" },
                  }),
                )
              } catch { /* */ }
            }}
            className="mt-2.5 inline-flex min-h-9 items-center justify-center rounded-full bg-violet-700 px-3.5 text-[11px] font-bold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
            aria-label="Open Wallet to authorize and withdraw Pi"
          >
            Open Wallet · Withdraw Pi
          </button>
        </div>

        <div className="mx-3 mt-3">
          <EconomyProgramStatus />
        </div>

        <div className="mx-3 mt-3">
          <ReferralShareCard compact />
        </div>

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
              Pending GHC is not spendable until the server confirms its maturity and claim state.
              Daily Claim rewards have a 48-hour lock.
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
          Daily Claim rewards mature after 48 hours. Verified mission milestones unlock durable achievements; mission completion does not issue GHC under the current economy policy.{" "}
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
            Rewards require server-verified, meaningful actions. Daily Claim rewards mature after
            48 hours; pending funds cannot be spent or transferred. Mission milestones are verified
            against durable GreenHaven records and unlock non-financial achievements. GHC activity
            issuance remains disabled by the current policy. Ledger entries remain the authority
            for credited value.
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
                <ChallengeCardView key={`rec-${card.challenge.id}`} card={card} compact onVerifyMission={verifyMission} verifyingMissionId={verifyingMissionId} />
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
              { id: "challenges" as const, label: msg("missions") },
              { id: "opportunities" as const, label: msg("opportunities") },
              { id: "history" as const, label: msg("history") },
              { id: "achievements" as const, label: msg("achievements") },
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
            ? `${snapshot.rules.length} participation path${snapshot.rules.length === 1 ? "" : "s"}`
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
                Activity-based GHC issuance is currently disabled. These rules are informational and do not promise a credit.
              </p>
            </div>

              <p className="px-1 text-[11px] font-semibold text-muted-foreground">
                Activity milestone reference (configured rules)
              </p>
              {snapshot.rules.length === 0 ? (
                <Empty title="No active rules" body="No activity milestones are currently configured." />
              ) : (
                snapshot.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-3.5 shadow-[var(--gh-card-shadow)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Award size={18} className="mt-0.5 text-emerald-700 dark:text-emerald-300" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {rule.description || rule.id}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {rule.category} · informational policy reference
                          </p>
                          {rule.requiresValidation && (
                            <p className="mt-1 text-[10px] font-medium text-amber-700">
                              Progress does not represent a GHC credit
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Reference
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
              <div
                className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                role="status"
              >
                Milestones are verified against durable GreenHaven activity and unlock account-level
                achievements. Mission completion does not issue GHC under the current economy policy.
                Daily Claim remains the active server-backed GHC reward path.
              </div>
              {snapshot.challenges.map((card) => (
                <ChallengeCardView key={card.challenge.id} card={card} onVerifyMission={verifyMission} verifyingMissionId={verifyingMissionId} />
              ))}
            </>
          )}

          {tab === "history" && (
            <>
              <div className="rounded-[1.25rem] border border-border/60 bg-card p-3 shadow-[var(--gh-card-shadow)]">
                <label htmlFor="rewards-history-search" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Search reward ledger</label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input id="rewards-history-search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search reason, activity or reference" className="h-10 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/70" />
                  {historyQuery ? <button type="button" onClick={() => setHistoryQuery("")} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter reward transaction status">
                  {(["all", "posted", "pending", "reversed", "expired", "failed"] as const).map((value) => (
                    <button key={value} type="button" onClick={() => setHistoryStatus(value)} aria-pressed={historyStatus === value} className={`min-h-8 rounded-full px-3 text-[10px] font-bold capitalize transition ${historyStatus === value ? "bg-[var(--gh-green)] text-white" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}>{value === "all" ? "All" : value.replace(/_/g, " ")}</button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground" role="status" aria-live="polite">{serverHistoryStatus === "ready" ? `${filteredServerRewardTransactions.length} server ledger entr${filteredServerRewardTransactions.length === 1 ? "y" : "ies"} · newest first` : serverHistoryStatus === "loading" ? "Synchronizing account ledger…" : "Server ledger unavailable · showing local activity only where available"}</p>
              </div>
              {serverHistoryStatus === "ready" ? (
                filteredServerRewardTransactions.length ? filteredServerRewardTransactions.map((row) => (
                  <article key={row.id} className="rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-3 shadow-[var(--gh-card-shadow)]">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.status === "posted" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : row.status === "pending" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}><GhcCoinIcon size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 text-[12px] font-bold text-foreground">{row.reason}</p><span className="shrink-0 text-[12px] font-black tabular-nums text-emerald-700 dark:text-emerald-300">+{formatGhc(row.amount)}</span></div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{row.sourceEvent} · {formatWhen(row.createdAt)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${row.status === "posted" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : row.status === "pending" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}>{row.status}</span>{row.referenceId ? <span className="max-w-full truncate text-[9px] text-muted-foreground">Ref: {row.referenceId}</span> : null}</div>
                      </div>
                    </div>
                  </article>
                )) : <Empty title="No matching ledger entries" body="Try another search or status filter. Your server-confirmed GHC reward ledger is up to date." />
              ) : null}
              <p className="mb-1 flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0" />
                Server ledger entries are authoritative; local reward records are shown below as supplemental activity.
              </p>
              {filteredLocalRewardRecords.length === 0 ? (
                <Empty
                  title="No additional local reward records"
                  body="Your server ledger is shown above when available. New validated reward activity will appear here after it is synchronized."
                />
              ) : (
                filteredLocalRewardRecords.map((r) => {
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
                          {resolveRewardActivityTarget(r) ? (
                            <button type="button" onClick={() => navigateGhcActivityTarget(resolveRewardActivityTarget(r)!)} className="mt-2 inline-flex min-h-9 items-center rounded-full border border-border px-3 text-[11px] font-bold text-emerald-700 hover:bg-muted">Open source activity</button>
                          ) : null}
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
  onVerifyMission,
  verifyingMissionId,
}: {
  card: ChallengeCard
  compact?: boolean
  onVerifyMission?: (challengeId: string) => void
  verifyingMissionId?: string | null
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
                  {targetLabel} · achievement milestone
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
            {(status === "pending_validation" || status === "completed") && missionCodeForChallenge(challenge.id) && onVerifyMission && (
              <button
                type="button"
                onClick={() => onVerifyMission(challenge.id)}
                disabled={verifyingMissionId === challenge.id}
                className="mt-2.5 inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-bold text-emerald-900 shadow-sm disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
              >
                {verifyingMissionId === challenge.id ? "Verifying…" : "Verify achievement"}
                <ChevronRight size={12} aria-hidden />
              </button>
            )}
            {(status === "pending_validation" || status === "completed") && !missionCodeForChallenge(challenge.id) && (
              <p className="mt-2 text-[10px] text-muted-foreground">This milestone does not currently have a server verification workflow.</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>

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
