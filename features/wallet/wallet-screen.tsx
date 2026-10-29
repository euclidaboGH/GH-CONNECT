"use client"

/**
 * Premium Wallet — feature module entry (`features/wallet`).
 * GHC available / pending / activity. Never mixes GHC with Pi.
 * Split further: wallet-header, wallet-balance, wallet-activity (next passes).
 */

import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  HandCoins,
  Clock,
  TrendingUp,
  TrendingDown,
  Info,
  Shield,
  Search,
  Share2,
  Filter,
  RefreshCw,
  ChevronRight,
  Gift,
  Crown,
  Users,
  UserRound,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
} from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { SendGhcFlow } from "@/components/ghc/send-ghc-flow"
import { RequestGhcFlow } from "@/components/ghc/request-ghc-flow"
import { ReceiveGhcFlow } from "@/components/ghc/receive-ghc-flow"
import type { SendRecipient } from "@/components/ghc/send-ghc-flow"
import { GhcTransactionDetail } from "@/components/ghc/ghc-transaction-detail"
import { PiPaymentDetail, type PiPaymentDetailRecord } from "@/components/ghc/pi-payment-detail"
import { GhcRequestsPanel } from "@/components/ghc/ghc-requests-panel"
import { GhcSocialFuelNote } from "@/components/ghc/ghc-social-fuel-note"
import { GhPayPanel } from "@/components/ghc/gh-pay-panel"
import { useGHCShell } from "@/contexts/ghc-context"
import { EMPTY_STATES, PRIMARY_ACTIONS, formatGhcAmount, mapGhcUxError } from "@/lib/domains/ghc-wallet-ux"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { domainEvents } from "@/lib/realtime/event-bus"
import type { GhcTransaction, RewardRecord } from "@/lib/domains/economy-types"
import { DEFAULT_ECONOMY_LIMITS } from "@/lib/domains/economy-types"
import { QuickChip, TxRow, EmptyBlock } from "./wallet-activity"
import { WalletHeader } from "./wallet-header"
import { formatGhc as formatGhcShared, formatWhen as formatWhenShared } from "./wallet-format"
import { WalletBalanceCard } from "./wallet-balance"
import { WithdrawGhcPanel } from "./withdraw-ghc-panel"
import { WalletPrimaryActions } from "./wallet-actions"
import { WalletToolsGrid } from "./wallet-tools"
import { AddGhcSheet } from "./add-ghc-sheet"
import { GhcUtilityPanel } from "@/components/ghc/ghc-utility-panel"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { isValidGreenHavenIdFormat, normalizeGreenHavenId, resolveGreenHavenIdServer } from "@/lib/domains/greenhaven-id"
import { socialEconomyStatus } from "@/lib/social/client"
import { useWalletRead } from "@/contexts/domains/wallet-read-provider"
import { PaymentRecoveryBanner } from "@/components/ghc/payment-recovery-banner"
import { PaymentRecoveryPanel } from "@/components/ghc/payment-recovery-panel"
import { PiPaymentUtilityStatus } from "@/components/ghc/pi-payment-utility-status"
import { PiCashbackSummary } from "@/components/ghc/pi-cashback-summary"
import { UnifiedEarningsDashboard } from "@/components/ghc/unified-earnings-dashboard"
import { normalizePiTransactionIntent, paymentPurposeLabel, type PiTransactionProjection } from "@/lib/domains/pi-transaction-normalizer"

const formatGhc = formatGhcShared


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

function formatDay(ts: number) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

const TX_LABELS: Record<string, string> = {
  earned: "Activity credit",
  spent: "Spent",
  purchased: "Purchased",
  pending: "Pending",
  reversed: "Reversed",
  expired: "Expired",
  adjusted: "Adjusted",
  transfer_out: "Sent",
  transfer_in: "Received",
  transfer_request: "Request",
}

type Tab = "activity" | "rewards" | "about"
type TxFilter = "all" | "earned" | "spent" | "pending" | "sent" | "received"
type PublicEconomyPolicy = {
  version: string
  asset: { referenceRateDisclaimer: string; piToGhcPurchaseNote: string; ghcToPiWithdrawalFeatureFlagEnabled: boolean }
  issuance: { dailyClaimBaseGrossGhc: number[]; userSharePercent: number; note: string }
  fixedSpendCatalog: Array<{ purpose: string; amountGhc: number; baseGhc?: number; feeGhc?: number; description: string }>
}

function statusLabel(status?: string): { text: string; className: string } {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return { text: "Pending", className: "text-amber-700 dark:text-amber-400" }
    case "failed":
      return { text: "Failed", className: "text-red-600 dark:text-red-400" }
    case "cancelled":
    case "canceled":
      return { text: "Cancelled", className: "text-muted-foreground" }
    case "reversed":
      return { text: "Reversed", className: "text-muted-foreground" }
    case "posted":
    case "confirmed":
    case "completed":
    case "sent":
    case "delivered":
      return { text: "Confirmed", className: "text-emerald-700 dark:text-emerald-400" }
    default:
      return { text: status ? String(status) : "Confirmed", className: "text-muted-foreground" }
  }
}


type PendingHold = {
  id: string
  amount: number
  reason: string
  source: "achievement" | "challenge" | "validation" | "reward" | "other"
  expectedClearLabel: string
  createdAt: number
  /** Ready to claim vs still under manual review */
  claimState: "ready" | "review"
  /** Stacked identical lines */
  stackCount?: number
  stackIds?: string[]
}

function classifyPendingSource(reason: string, sourceEvent: string): PendingHold["source"] {
  const s = `${reason} ${sourceEvent}`.toLowerCase()
  if (s.includes("challenge")) return "challenge"
  if (s.includes("achievement") || s.includes("badge")) return "achievement"
  if (s.includes("valid") || s.includes("review") || s.includes("pending")) return "validation"
  if (s.includes("reward") || s.includes("earn") || s.includes("profile")) return "reward"
  return "other"
}

function expectedClearWindow(createdAt: number, expiresAt?: number): string {
  if (expiresAt && expiresAt > Date.now()) {
    const h = Math.max(1, Math.round((expiresAt - Date.now()) / 3600000))
    if (h < 48) return `Usually clears within ~${h}h`
    return `Usually clears by ${formatDay(expiresAt)}`
  }
  const ageH = (Date.now() - createdAt) / 3600000
  if (ageH < 12) return "Usually clears within ~24 hours"
  if (ageH < 36) return "Validation in progress · often within a day"
  return "Still under review · contact support if longer than 72h"
}

function navigateTab(tab: string) {
  try {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
  } catch {
    /* ignore */
  }
}

function navigateSettingsSection(section: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:open-settings-section", { detail: { section } })
    )
  } catch {
    /* ignore */
  }
}

export function PremiumWalletScreen({ onBack }: { onBack: () => void }) {
  const { addToast } = useGHCShell()
  const { snapshot: authoritativeWallet, refresh: refreshWalletAuthority } = useWalletRead()
  /* wallet-refresh listener attached below */

  const [tab, setTab] = useState<Tab>("activity")
  const [tick, setTick] = useState(0)
  const [economyPolicy, setEconomyPolicy] = useState<PublicEconomyPolicy | null>(null)
  const [economyPolicyLoading, setEconomyPolicyLoading] = useState(true)
  const [economyPolicyRetry, setEconomyPolicyRetry] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [p2pMode, setP2pMode] = useState<"send" | "request" | "receive" | null>(null)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [p2pName, setP2pName] = useState("")
  const [p2pId, setP2pId] = useState("")
  const [p2pAmount, setP2pAmount] = useState("")
  const [p2pNote, setP2pNote] = useState("")
  const [p2pBusy, setP2pBusy] = useState(false)
  const [p2pError, setP2pError] = useState<string | null>(null)
  const [p2pSuccess, setP2pSuccess] = useState<string | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [socialEconomy, setSocialEconomy] = useState<Awaited<ReturnType<typeof socialEconomyStatus>> | null>(null)
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )

  const [txFilter, setTxFilter] = useState<TxFilter>("all")
  /** GHC ledger vs Pi payment intents — never mixed in one list */
  const [assetRail, setAssetRail] = useState<"ghc" | "pi">("ghc")
  const [showUtilityPanel, setShowUtilityPanel] = useState(false)

  useEffect(() => {
    const onPackIntent = (ev: Event) => {
      try {
        const d = (ev as CustomEvent).detail as {
          productId?: string
          ghcAmount?: number
          amountPi?: number
          label?: string
          intentId?: string
        }
        if (!d?.productId) return
        setSelectedGhcPack({
          productId: String(d.productId),
          ghcAmount: Number(d.ghcAmount || 0),
          piAmount: Number(d.amountPi || 0),
          label: d.label,
        })
        setAssetRail("pi")
        window.setTimeout(() => {
          try {
            document.getElementById("ghc-wallet-gh-pay")?.scrollIntoView({ behavior: "smooth", block: "start" })
          } catch { /* */ }
        }, 100)
        if (d.intentId) {
          addToast(`Pack intent ${String(d.intentId).slice(0, 8)}… · complete π payment below`, "info")
        }
      } catch { /* */ }
    }
    window.addEventListener("ghc:ghc-pack-intent", onPackIntent as EventListener)
    return () => window.removeEventListener("ghc:ghc-pack-intent", onPackIntent as EventListener)
  }, [addToast])

  const [selectedGhcPack, setSelectedGhcPack] = useState<{ productId: string; ghcAmount: number; piAmount: number; label?: string } | null>(null)
  type TxDateRange = "today" | "7d" | "30d" | "all"
  const [txDateRange, setTxDateRange] = useState<TxDateRange>("all")
  type PiIntentRow = {
    id: string
    status?: string
    amountPi?: number
    currency?: string
    purpose?: string
    productId?: string
    productLabel?: string
    referenceId?: string
    createdAt?: number
    paymentId?: string
  }
  const [piIntents, setPiIntents] = useState<PiIntentRow[]>([])
  const [selectedPiIntent, setSelectedPiIntent] = useState<PiIntentRow | null>(null)
  const [piIntentsLoading, setPiIntentsLoading] = useState(false)
  const [piIntentsError, setPiIntentsError] = useState<string | null>(null)
  const [serverReconciliation, setServerReconciliation] = useState<{ generatedAt?: string; coverage?: { recordLimit: number; potentiallyTruncated: boolean; scopeDescription: string }; counts: { matched: number; attention_required: number; unverified: number; not_applicable: number }; findings: Array<{ intentId: string; purpose: string; reconciliation: string; code: string; message: string }> } | null>(null)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [query, setQuery] = useState("")
  const [showPendingSheet, setShowPendingSheet] = useState(false)
  const [showUtilityHelp, setShowUtilityHelp] = useState(false)
  const [claimingHoldId, setClaimingHoldId] = useState<string | null>(null)
  const [walletOnline, setWalletOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine)
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)
  const [claimReceipt, setClaimReceipt] = useState<{ amount: number; ref?: string } | null>(null)
  const [fuelExpanded, setFuelExpanded] = useState(() => {
    try {
      return localStorage.getItem('ghc_wallet_fuel_collapsed') !== '1'
    } catch {
      return true
    }
  })
  const [sendEducate, setSendEducate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEconomyPolicyLoading(true)
    void fetch("/api/economy/policy", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ECONOMY_POLICY_UNAVAILABLE")
        return response.json()
      })
      .then((payload) => {
        if (!cancelled && payload?.ok && payload?.policy) setEconomyPolicy(payload.policy as PublicEconomyPolicy)
      })
      .catch(() => { if (!cancelled) setEconomyPolicy(null) })
      .finally(() => { if (!cancelled) setEconomyPolicyLoading(false) })
    return () => { cancelled = true }
  }, [economyPolicyRetry])

  useEffect(() => {
    let cancelled = false
    const refreshSocialEconomy = async () => {
      const status = await socialEconomyStatus()
      if (!cancelled && status.ok) setSocialEconomy(status)
    }
    const refreshAuthoritativeWallet = async () => {
      void refreshSocialEconomy()
      try {
        // Mature Daily Claim holds server-side before taking the wallet snapshot.
        // This is idempotent and never accepts client amounts or user IDs.
        if (navigator.onLine) {
          const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
          try {
            const { IdentityService } = await import("@/lib/identity/identity-service")
            Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
          } catch { /* session cookie remains available */ }
          await fetch("/api/economy/rewards/claim-matured", {
            method: "POST", credentials: "include", cache: "no-store", headers, body: JSON.stringify({}),
          }).catch(() => null)
        }
      } catch { /* the wallet read still proceeds; no local credit is fabricated */ }
      try {
        await refreshWalletAuthority()
        const eco = getBoundDomainServices()?.economy
        await eco?.refresh?.()
      } catch {
        // The wallet remains fail-closed; the existing verified snapshot is retained.
      } finally {
        if (!cancelled) setTick((x) => x + 1)
      }
    }
    void refreshAuthoritativeWallet()
    const onRefresh = () => { void refreshAuthoritativeWallet() }
    const onOnline = () => setWalletOnline(true)
    const onOffline = () => setWalletOnline(false)
    const onFocus = () => { try { window.dispatchEvent(new CustomEvent("ghc:wallet-refresh")) } catch { /* */ } }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    window.addEventListener("ghc:wallet-focus", onFocus)
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    // Reconcile the authoritative ledger periodically so matured 48-hour holds
    // become visible and can be retried without logout or manual navigation.
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refreshAuthoritativeWallet()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(refreshInterval)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("ghc:wallet-focus", onFocus)
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
    }
  }, [refreshWalletAuthority])

  // Load durable Pi payment intents when user opens π rail
  useEffect(() => {
    if (assetRail !== "pi") return
    let cancelled = false
    ;(async () => {
      setPiIntentsLoading(true)
      setPiIntentsError(null)
      try {
        const headers: Record<string, string> = {}
        try {
          const { IdentityService } = await import("@/lib/identity/identity-service")
          Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
        } catch { /* */ }
        const res = await fetch("/api/payments/intents", {
          headers,
          cache: "no-store",
          credentials: "include",
        })
        if (cancelled) return
        if (!res.ok) {
          setPiIntentsError(res.status === 401 ? "Sign in again to view your π payment history." : "Payment history could not be loaded from the server. Your records have not been changed.")
          return
        }
        const data = await res.json().catch(() => ({}))
        if (data?.ok === false) {
          setPiIntentsError("Payment history is temporarily unavailable. Please retry shortly.")
          return
        }
        const list: unknown[] | null = Array.isArray(data?.intents)
          ? data.intents as unknown[]
          : Array.isArray(data?.items)
            ? data.items as unknown[]
            : null
        if (!list) {
          if (!cancelled) setPiIntentsError("Payment history response was invalid. Your records have not been changed; retry to reload authoritative history.")
          return
        }
        if (!cancelled) {
          setPiIntents(
            list
              .filter((raw: unknown) => Boolean(raw) && typeof raw === "object" && !Array.isArray(raw))
              .map((raw: unknown) => normalizePiTransactionIntent(raw))
              .filter((x): x is PiTransactionProjection => x !== null)
              // This endpoint is Pi history: never coerce unknown/mixed rails into π.
              .filter((x: PiIntentRow) => Boolean(x.id) && x.currency === "PI")
          )
        }
        // The server performs user-scoped read-only checks against feature stores.
        // Keep this separate from the client-side intent-field warnings below.
        const reconciliationRes = await fetch("/api/payments/reconciliation", {
          headers,
          cache: "no-store",
          credentials: "include",
        })
        const reconciliationData = await reconciliationRes.json().catch(() => ({}))
        if (!cancelled && reconciliationRes.ok && reconciliationData?.ok === true
          && reconciliationData.counts && Array.isArray(reconciliationData.findings)) {
          setServerReconciliation({ generatedAt: typeof reconciliationData.generatedAt === "string" ? reconciliationData.generatedAt : undefined, coverage: reconciliationData.coverage && typeof reconciliationData.coverage.potentiallyTruncated === "boolean" && Number.isSafeInteger(reconciliationData.coverage.recordLimit) ? reconciliationData.coverage : undefined, counts: reconciliationData.counts, findings: reconciliationData.findings })
        } else if (!cancelled) {
          setServerReconciliation(null)
        }
      } catch {
        if (!cancelled) setPiIntentsError("Could not connect to payment history. Check your connection and retry.")
      } finally {
        if (!cancelled) setPiIntentsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assetRail, tick])

  // Read-only reconciliation signals derived from the durable intent records.
  // These flags never change provider or fulfilment state and never imply that
  // a separate marketplace/order/entitlement record has been verified.
  const piReconciliation = useMemo(() => {
    const normalize = (status?: string) => String(status || "").trim().toUpperCase()
    const awaitingFulfilment = piIntents.filter((i) => normalize(i.status) === "COMPLETED")
    const missingReference = piIntents.filter((i) => !String(i.referenceId || "").trim())
    const paidMissingProviderId = piIntents.filter((i) =>
      ["COMPLETED", "FULFILLED"].includes(normalize(i.status)) && !String(i.paymentId || "").trim()
    )
    const needsAttention = piIntents.filter((i) => ["INCOMPLETE", "FAILED"].includes(normalize(i.status)))
    return { awaitingFulfilment, missingReference, paidMissingProviderId, needsAttention }
  }, [piIntents])

  const filteredPiIntents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const searchable = piIntents.filter((i) => {
      const hay = `${i.purpose || ""} ${i.productId || ""} ${i.productLabel || ""} ${i.referenceId || ""} ${i.id} ${i.paymentId || ""} ${i.status || ""}`.toLowerCase()
      if (q && !hay.includes(q)) return false
      const status = String(i.status || "").toLowerCase()
      if (txFilter === "pending" && !["created", "approval_pending", "approved", "user_submitted", "completion_pending", "incomplete"].includes(status)) return false
      if (txFilter === "earned" && !["creator_earning", "reward_payout", "refund"].includes(String(i.purpose || "").toLowerCase())) return false
      if (txFilter === "spent" && ["failed", "cancelled", "refunded"].includes(status)) return false
      if (txFilter === "sent" || txFilter === "received") return false
      return true
    })
    const now = Date.now()
    const startMs =
      txDateRange === "today"
        ? new Date(new Date().toDateString()).getTime()
        : txDateRange === "7d"
          ? now - 7 * 86400000
          : txDateRange === "30d"
            ? now - 30 * 86400000
            : 0
    if (startMs <= 0) return searchable
    return searchable.filter((i) => (i.createdAt || 0) >= startMs)
  }, [piIntents, txDateRange, query, txFilter])

  const [showRequestsPanel, setShowRequestsPanel] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [historyRail, setHistoryRail] = useState<"ghc" | "pi">("ghc")
  const [showAddGhc, setShowAddGhc] = useState(false)
  const [sendPrefill, setSendPrefill] = useState<SendRecipient | null>(null)
  const [selectedTx, setSelectedTx] = useState<GhcTransaction | null>(null)

  const [shareMsg, setShareMsg] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  useEffect(() => {
    if (!showPendingSheet && !showUtilityHelp && !claimReceipt && !showPaymentMethods) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (showPendingSheet) setShowPendingSheet(false)
      else if (showUtilityHelp) setShowUtilityHelp(false)
      else if (claimReceipt) setClaimReceipt(null)
      else if (showPaymentMethods) setShowPaymentMethods(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showPendingSheet, showUtilityHelp, claimReceipt, showPaymentMethods])


  const data = useMemo(() => {
    void tick
    try {
      const eco = getBoundDomainServices()?.economy
      if (!eco) return null
      const wallet = eco.getWallet()
      const txs = eco.getTransactions(80) as GhcTransaction[]
      const rewards = eco.getRewards(40) as RewardRecord[]
      return { wallet, txs, rewards }
    } catch {
      return null
    }
  }, [tick])

  const wallet = data?.wallet
  const balance = authoritativeWallet.availableGhc ?? wallet?.balance ?? 0
  const pending = authoritativeWallet.pendingGhc ?? wallet?.pending ?? 0
  const locked = authoritativeWallet.lockedGhc ?? wallet?.locked ?? 0
  const escrowLocked = authoritativeWallet.escrowLocked ?? 0
  const earned = wallet?.lifetimeEarned ?? (wallet as { earned?: number })?.earned ?? 0
  const spent = wallet?.lifetimeSpent ?? (wallet as { spent?: number })?.spent ?? 0
  // Keep empty fallbacks referentially stable. Fresh [] values here invalidate
  // every downstream memo/callback whenever the wallet service is unavailable.
  const txs = useMemo<GhcTransaction[]>(() => data?.txs ?? [], [data?.txs])
  const rewards = useMemo<RewardRecord[]>(() => data?.rewards ?? [], [data?.rewards])

  const pendingHolds: PendingHold[] = useMemo(() => {
    const holds: PendingHold[] = []
    for (const tx of txs) {
      if (tx.status === "pending" && tx.amount > 0) {
        const meta = (tx.metadata || {}) as {
          reviewRequired?: boolean
          redeemableAt?: number | string
          rewardLifecycle?: string
        }
        const review = Boolean(meta.reviewRequired)
        let redeemableAtMs =
          typeof meta.redeemableAt === "number"
            ? meta.redeemableAt
            : meta.redeemableAt
              ? Date.parse(String(meta.redeemableAt))
              : NaN
        if (
          !Number.isFinite(redeemableAtMs) &&
          (String(tx.sourceEvent || "").includes("DAILY_CLAIM") ||
            meta.rewardLifecycle === "daily_claim_48h")
        ) {
          redeemableAtMs = Number(tx.createdAt) + 48 * 60 * 60 * 1000
        }
        const locked = Number.isFinite(redeemableAtMs) && Date.now() < redeemableAtMs
        const claimState: "ready" | "review" = review || locked ? "review" : "ready"
        const expectedClearLabel = review
          ? "Under review — not claimable yet"
          : locked
            ? `Available after ${new Date(redeemableAtMs).toLocaleString()} (48h lock)`
            : "Ready to claim to available balance"
        holds.push({
          id: tx.id,
          amount: tx.amount,
          reason: tx.reason || TX_LABELS[tx.kind] || "Pending credit",
          source: classifyPendingSource(tx.reason || "", tx.sourceEvent || ""),
          expectedClearLabel,
          createdAt: tx.createdAt,
          claimState,
        })
      }
    }
    for (const r of rewards) {
      if (
        r.validationStatus === "pending_validation" ||
        r.validationStatus === "eligible" ||
        r.validationStatus === "approved"
      ) {
        if (holds.some((h) => h.id === r.transactionId || h.id === r.id)) continue
        const review = r.validationStatus === "pending_validation" && (r as { reviewRequired?: boolean }).reviewRequired
        holds.push({
          id: r.id,
          amount: r.amount,
          reason: r.reason || r.category || "Reward pending validation",
          source: classifyPendingSource(r.reason || "", r.sourceEvent || r.category || ""),
          expectedClearLabel: review
            ? "Under review — not claimable yet"
            : "Ready to claim to available balance",
          createdAt: r.createdAt,
          claimState: review ? "review" : "ready",
        })
      }
    }
    // Stack identical reason+amount+source lines (e.g. triple achievement spam)
    const stacked: PendingHold[] = []
    for (const h of holds) {
      const key = `${h.reason}|${h.amount}|${h.source}|${h.claimState}`
      const existing = stacked.find(
        (s) => `${s.reason}|${s.amount}|${s.source}|${s.claimState}` === key
      )
      if (existing) {
        existing.amount += h.amount
        existing.stackCount = (existing.stackCount || 1) + 1
        existing.stackIds = [...(existing.stackIds || [existing.id]), h.id]
        existing.createdAt = Math.min(existing.createdAt, h.createdAt)
      } else {
        stacked.push({ ...h, stackCount: 1, stackIds: [h.id] })
      }
    }
    stacked.sort((a, b) => b.createdAt - a.createdAt)
    return stacked
  }, [txs, rewards])

  const pendingSum = pendingHolds.reduce((s, h) => s + h.amount, 0)



  const claimPendingHold = async (holdId: string) => {
    if (claimingHoldId) return
    if (!walletOnline) {
      setClaimFeedback?.("You are offline — claim when reconnected")
      return
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setClaimFeedback("You are offline. Claims need a connection so the ledger can confirm.")
      return
    }
    setClaimingHoldId(holdId)
    setClaimFeedback(null)
    try {
      const hold = pendingHolds.find((h) => h.id === holdId)
      const ids = hold?.stackIds?.length ? hold.stackIds : [holdId]
      let claimed = 0
      let lastErr: string | undefined
      for (const id of ids) {
        // The durable server ledger is the only authority for claiming matured
        // funds. Never fall back to a browser/domain-store claim on HTTP failure:
        // that can show a false success until the next login/hydration.
        try {
          const claimHeaders: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" }
          const { IdentityService } = await import("@/lib/identity/identity-service")
          Object.assign(claimHeaders, IdentityService.getAuthHeaders?.() || {})
          const serverRes = await fetch("/api/economy/rewards/claim", {
            method: "POST", credentials: "include", cache: "no-store", headers: claimHeaders,
            body: JSON.stringify({ holdId: id }),
          })
          const body = await serverRes.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; code?: string }
          if (serverRes.ok && body.ok) claimed += 1
          else lastErr = body.message || body.error || body.code || `Claim failed (${serverRes.status}). Please retry.`
        } catch {
          lastErr = "Could not reach the secure claims service. Your reward was not changed; retry when connected."
        }
      }
      if (claimed === 0) {
        setClaimFeedback(lastErr || "Could not claim pending GHC")
      } else {
        const allSettled = claimed === ids.length
        const amt = hold?.amount ?? 0
        const ref = hold?.id?.slice(0, 12)
        // A stacked display row can contain multiple ledger holds. Never show
        // the aggregate amount as available if only some holds settled.
        if (allSettled) {
          setClaimReceipt({ amount: amt, ref })
          setClaimFeedback(
            amt > 0
              ? `+${formatGhc(Number(amt))} available${ref ? ` · ref ${ref}` : ""}`
              : claimed > 1
                ? `Claimed ${claimed} items — Wallet is refreshing`
                : "Claim confirmed — Wallet is refreshing"
          )
          setShowPendingSheet(false)
          setTab("activity")
        } else {
          setClaimReceipt(null)
          setClaimFeedback(`Settled ${claimed} of ${ids.length} items. Wallet is refreshing; retry the remaining items. ${lastErr || ""}`.trim())
        }
        setTick((x) => x + 1)
        try {
          await refresh()
        } catch {
          /* refresh optional */
        }
        try {
          await refreshWalletAuthority()
        } catch {
          /* */
        }
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:wallet-synced", {
              detail: { reason: "pending-hold-claimed", holdId, partial: !allSettled },
            }),
          )
          window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "pending-hold-claimed", partial: !allSettled } }))
        } catch {
          /* */
        }
        // Second pass after ledger commit lag — avoids "stuck pending until logout"
        window.setTimeout(() => {
          try {
            void refresh()
          } catch { /* */ }
          try {
            void refreshWalletAuthority()
          } catch { /* */ }
          try {
            window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason: "pending-hold-claimed-revalidate" } }))
          } catch { /* */ }
          setTick((x) => x + 1)
        }, 900)
      }
    } catch (e) {
      setClaimFeedback(e instanceof Error ? e.message : "Claim failed")
    } finally {
      setClaimingHoldId(null)
    }
  }

  // Auto-settle matured credits without a logout. A failed attempt is not
  // permanently memoized: a later wallet refresh/focus/online event can retry.
  const autoMatureInFlight = useRef(false)
  useEffect(() => {
    if (!walletOnline || pendingHolds.length === 0 || autoMatureInFlight.current) return
    const ready = pendingHolds.filter((h) => h.claimState === "ready")
    if (!ready.length) return
    let cancelled = false
    const run = async () => {
      autoMatureInFlight.current = true
      try {
        for (const h of ready.slice(0, 5)) {
          if (cancelled) break
          await claimPendingHold(h.id)
        }
      } finally {
        autoMatureInFlight.current = false
      }
    }
    void run()
    return () => { cancelled = true }
    // claimPendingHold uses current render state; refreshes change pendingHolds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletOnline, pendingHolds.length, pendingHolds.map((h) => h.id + ":" + h.claimState).join("|"), tick])


  const displayPending = pending > 0 ? pending : pendingSum

  const monthInsight = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const t0 = start.getTime()
    let monthEarned = 0
    let monthSpent = 0
    for (const tx of txs) {
      if (tx.createdAt < t0) continue
      if (tx.status === "reversed" || tx.status === "failed") continue
      if (tx.amount > 0 && (tx.kind === "earned" || tx.status === "posted")) {
        if (tx.status === "posted" || tx.status === "pending") monthEarned += tx.amount
      }
      if (tx.amount < 0) monthSpent += Math.abs(tx.amount)
    }
    return { monthEarned, monthSpent }
  }, [txs])

  const dailyEarnProgress = useMemo(() => {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const t0 = dayStart.getTime()
    let today = 0
    for (const tx of txs) {
      if (tx.createdAt < t0) continue
      if (tx.kind === "earned" && tx.amount > 0 && tx.status !== "reversed" && tx.status !== "failed") {
        today += tx.amount
      }
    }
    const cap = DEFAULT_ECONOMY_LIMITS.maxDailyEarn
    return { today, cap, pct: Math.min(100, Math.round((today / cap) * 100)) }
  }, [txs])

  const filteredTxs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return txs.filter((tx) => {
      if (txFilter === "earned") {
        if (
          !(
            tx.kind === "earned" ||
            tx.kind === "transfer_in" ||
            (tx.amount > 0 && tx.kind !== "spent" && tx.kind !== "transfer_out")
          )
        )
          return false
      }
      if (txFilter === "spent" && !(tx.kind === "spent" || tx.kind === "transfer_out" || tx.amount < 0)) return false
      if (txFilter === "sent" && tx.kind !== "transfer_out") return false
      if (txFilter === "received" && tx.kind !== "transfer_in") return false
      if (txFilter === "pending" && tx.status !== "pending" && tx.kind !== "pending" && tx.kind !== "transfer_request") return false
      if (q) {
        const hay = `${tx.reason} ${tx.sourceEvent} ${tx.kind} ${statusLabel(tx.status).text}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      const now = Date.now()
      const startMs =
        txDateRange === "today"
          ? new Date(new Date().toDateString()).getTime()
          : txDateRange === "7d"
            ? now - 7 * 86400000
            : txDateRange === "30d"
              ? now - 30 * 86400000
              : 0
      if (startMs > 0 && (tx.createdAt || 0) < startMs) return false
      return true
    })
  }, [txs, txFilter, query, txDateRange])

  /** Bank-style statement: group by calendar day, newest first */
  const dayGroups = useMemo(() => {
    const map = new Map<string, GhcTransaction[]>()
    for (const tx of filteredTxs) {
      const key = formatDay(tx.createdAt) || "Unknown"
      const list = map.get(key)
      if (list) list.push(tx)
      else map.set(key, [tx])
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
  }, [filteredTxs])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshFailed(false)
    try {
      const eco = getBoundDomainServices()?.economy as {
        hydrate?: (userId?: string) => Promise<void>
      } | null
      if (eco?.hydrate) {
        await eco.hydrate()
      }
      // Prefer durable server wallet when available (multi-instance safe)
      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim()
      } catch {
        if (!eco?.hydrate) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }
      setTick((t) => t + 1)
      setLastSynced(Date.now())
    } catch {
      setRefreshFailed(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const unsub = domainEvents.on("*", (ev) => {
      const typ = String(ev.type || "")
      if (
        typ === "WALLET_TRANSFER_COMPLETED" ||
        typ === "WALLET_BALANCE_UPDATED" ||
        typ === "WALLET_TRANSFER_FAILED" ||
        typ === "WALLET_TRANSFER_CREATED" ||
        typ === "PREMIUM_ACTIVATED" ||
        typ === "PREMIUM_UPDATED"
      ) {
        setTick((x) => x + 1)
        void refresh()
      }
    })
    const onClaimOrSync = () => {
      setTick((x) => x + 1)
      void refresh()
    }
    try {
      window.addEventListener("ghc:daily-reward-claimed", onClaimOrSync)
      window.addEventListener("ghc:wallet-synced", onClaimOrSync)
    } catch {
      /* */
    }
    return () => {
      try {
        unsub?.()
      } catch {
        /* */
      }
      try {
        window.removeEventListener("ghc:daily-reward-claimed", onClaimOrSync)
        window.removeEventListener("ghc:wallet-synced", onClaimOrSync)
      } catch {
        /* */
      }
    }
  }, [refresh])


  const buildStatementText = useCallback(() => {
    const month = new Date().toLocaleString(undefined, { month: "long", year: "numeric" })
    const lines = [
      `GreenHaven — GHC statement (${month})`,
      `Available: ${formatGhc(balance)}`,
      `Reserved: ${formatGhc(locked)}`,
      `Pending: ${formatGhc(displayPending)}`,
      `Lifetime credit: ${formatGhc(earned)} · spent: ${formatGhc(spent)}`,
      `This month: +${formatGhc(monthInsight.monthEarned)} / −${formatGhc(monthInsight.monthSpent)}`,
      "",
      "Recent Transactions:",
    ]
    const recent = txs.slice(0, 15)
    if (recent.length === 0) {
      lines.push("No activity yet.")
    } else {
      for (const tx of recent) {
        const sign = tx.amount >= 0 ? "+" : ""
        lines.push(
          `${formatWhen(tx.createdAt)} · ${tx.reason || tx.kind} · ${sign}${formatGhc(tx.amount)} GHC · ${statusLabel(tx.status).text}`
        )
      }
    }
    lines.push(
      "",
      "GHC is an in-app utility only — not Pi and not an investment product.",
      "Balances are private and ledger-backed."
    )
    return lines.join("\n")
  }, [balance, locked, displayPending, earned, spent, monthInsight, txs])

  const buildCsvStatement = useCallback(() => {
    if (assetRail === "pi") {
      const header = "id,status,amount_pi,purpose,product_id,payment_id,created_at"
      const rows = piIntents.map((i) =>
        [
          i.id,
          i.status || "",
          i.amountPi ?? "",
          (i.purpose || "").replace(/,/g, " "),
          (i.productId || "").replace(/,/g, " "),
          i.paymentId || "",
          i.createdAt ? new Date(i.createdAt).toISOString() : "",
        ].join(",")
      )
      return [header, ...rows].join("\n")
    }
    const header =
      "id,kind,amount_ghc,status,reason,counterparty,created_at"
    const rows = filteredTxs.map((tx) =>
      [
        tx.id,
        tx.kind || "",
        tx.amount,
        tx.status || "",
        (tx.reason || "").replace(/,/g, " "),
        String(
          (tx as { counterpartyName?: string; toUserName?: string; fromUserName?: string })
            .counterpartyName ||
            (tx as { toUserName?: string }).toUserName ||
            (tx as { fromUserName?: string }).fromUserName ||
            ""
        ).replace(/,/g, " "),
        tx.createdAt ? new Date(tx.createdAt).toISOString() : "",
      ].join(",")
    )
    return [header, ...rows].join("\n")
  }, [assetRail, piIntents, filteredTxs])

  const downloadCsvStatement = useCallback(() => {
    try {
      const csv = buildCsvStatement()
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        assetRail === "pi"
          ? `greenhaven-pi-statement-${new Date().toISOString().slice(0, 10)}.csv`
          : `greenhaven-ghc-statement-${new Date().toISOString().slice(0, 10)}.csv`
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setShareMsg("CSV downloaded")
    } catch {
      setShareMsg("CSV download failed")
    }
    window.setTimeout(() => setShareMsg(null), 2500)
  }, [assetRail, buildCsvStatement])

  const shareStatement = useCallback(async () => {
    const text = buildStatementText()
    try {
      // Prefer real CSV file download; also offer share/copy of text summary
      downloadCsvStatement()
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "GreenHaven statement", text })
        } catch {
          /* user cancelled share — CSV already attempted */
        }
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setShareMsg("CSV downloaded · summary copied")
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setShareMsg("Copied to clipboard")
      } catch {
        setShareMsg("Could not export statement")
      }
    }
    window.setTimeout(() => setShareMsg(null), 2500)
  }, [buildStatementText, downloadCsvStatement])

  const submitP2p = useCallback(async () => {
    setP2pError(null)
    setP2pSuccess(null)
    const amount = Number(p2pAmount)
    const name = p2pName.trim()
    const id = normalizeGreenHavenId(p2pId.trim())
    if (!name) {
      setP2pError("Enter the recipient’s display name")
      return
    }
    if (!isValidGreenHavenIdFormat(id)) {
      setP2pError("Enter a valid GreenHaven ID in the format GH-XXXXXX")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setP2pError("Enter a valid GHC amount")
      return
    }
    if (p2pMode === "send" && amount > balance) {
      setP2pError("Insufficient available GHC")
      return
    }
    setP2pBusy(true)
    try {
      const eco = getBoundDomainServices()?.economy as {
        sendGhcToUser?: (i: {
          toUserId: string
          toUserName: string
          amount: number
          note?: string
          toGreenHavenId?: string
        }) => Promise<{ ok: boolean; error?: string }>
        requestGhcFromUser?: (i: {
          fromUserId: string
          fromUserName: string
          amount: number
          note?: string
        }) => Promise<{ ok: boolean; error?: string }>
      } | null
      const resolved = await resolveGreenHavenIdServer(id)
      if (!resolved) {
        setP2pError("GreenHaven ID could not be found. No GHC was transferred.")
        return
      }
      if (p2pMode === "send") {
        if (!eco?.sendGhcToUser) {
          setP2pError("Transfers unavailable offline")
          return
        }
        const res = await eco.sendGhcToUser({
          toUserId: resolved.userId,
          toGreenHavenId: resolved.publicId,
          toUserName: resolved.displayName || name,
          amount,
          note: p2pNote.trim() || undefined,
        })
        if (!res.ok) {
          setP2pError(res.error || "Send failed")
          return
        }
        setP2pSuccess(`Sent ${formatGhc(amount)} GHC to ${name}`)
      } else if (p2pMode === "request") {
        if (!eco?.requestGhcFromUser) {
          setP2pError("Requests unavailable offline")
          return
        }
        const res = await eco.requestGhcFromUser({
          fromUserId: resolved.userId,
          fromUserName: resolved.displayName || name,
          amount,
          note: p2pNote.trim() || undefined,
        })
        if (!res.ok) {
          setP2pError(res.error || "Request failed")
          return
        }
        setP2pSuccess(`Requested ${formatGhc(amount)} GHC from ${name}`)
      }
      setTick((x) => x + 1)
      setP2pAmount("")
      setP2pNote("")
      window.setTimeout(() => {
        setP2pMode(null)
        setP2pSuccess(null)
      }, 1600)
    } catch (e) {
      setP2pError(e instanceof Error ? e.message : "Transfer failed")
    } finally {
      setP2pBusy(false)
    }
  }, [p2pAmount, p2pName, p2pId, p2pNote, p2pMode, balance])

  
  // Production: pending holds and balances revalidate when the wallet is focused or tab returns.
  useEffect(() => {
    const onFocus = () => {
      try {
        void refresh()
      } catch { /* */ }
    }
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") onFocus()
    }
    const onClaimed = () => {
      try {
        void refresh()
      } catch { /* */ }
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("ghc:daily-reward-claimed", onClaimed as EventListener)
    window.addEventListener("ghc:wallet-synced", onClaimed as EventListener)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("ghc:daily-reward-claimed", onClaimed as EventListener)
      window.removeEventListener("ghc:wallet-synced", onClaimed as EventListener)
    }
  }, [refresh])

const lowBalance = balance === 0 && displayPending === 0
  const walletSnapshotStale = authoritativeWallet.status === "error" || authoritativeWallet.status === "unavailable"
  const showAuthorityBanner = offline || refreshFailed || walletSnapshotStale
  const socialFunding = socialEconomy?.curation
  const claimableToday = Boolean(socialEconomy?.claim && (socialEconomy.claim as { claimable?: boolean }).claimable)

  const SOURCE_LABEL: Record<PendingHold["source"], string> = {
    achievement: "Achievement reward",
    challenge: "Challenge reward",
    validation: "Activity validation",
    reward: "Activity reward",
    other: "Pending credit",
  }

  const SOURCE_WHY: Record<PendingHold["source"], string> = {
    achievement: "Unlocked when you hit a milestone. Held briefly while the ledger confirms it is unique.",
    challenge: "Earned from a challenge. Held until anti-abuse checks finish.",
    validation: "Your reward is undergoing automated activity validation before it becomes transferable.",
    reward: "Daily or mission reward. Held until validation completes so rewards cannot be duplicated.",
    other: "This amount is reserved until the server marks it as available.",
  }

  return (
    <div className="gh-wallet-shell gh-world-wallet flex h-full min-h-0 flex-col bg-background text-foreground" role="region" aria-label="GHC wallet">
      {lowBalance ? (
        <div className="mx-3 mt-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4" role="status">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Your GHC wallet is currently empty</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Social actions do not mint GHC. Use an available daily claim or another funded GreenHaven source first; curation can then move existing GHC to creators.
              </p>
              {claimableToday ? <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Daily claim is available.</p> : null}
            </div>
            <span className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-wide">Ledger-backed</span>
          </div>
        </div>
      ) : null}
      <WalletHeader
        onBack={onBack}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        lastSynced={lastSynced}
      />

      <div className="gh-premium-wallet-content min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]">
        {showAuthorityBanner && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
                {offline
                  ? "You're offline. Showing your last available wallet information. Refresh when you're back online."
                  : walletSnapshotStale
                    ? (authoritativeWallet.message || "Authoritative wallet refresh failed. Any displayed previous values may be stale; server checks still govern financial actions.")
                    : "Couldn’t refresh your wallet. Showing the last available information."}
              </p>
              {!offline && (
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-1.5 text-[11px] font-bold text-amber-900 underline underline-offset-2 dark:text-amber-100"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* ZONE: BALANCE — hero carries title; no redundant label */}
        <div className="mt-2">
          <WalletBalanceCard
            balance={balance}
            balanceVisible={balanceVisible}
            onToggleVisible={() => setBalanceVisible((v) => !v)}
            refreshing={refreshing}
            lastSynced={lastSynced}
            pending={displayPending}
            locked={locked}
            monthEarned={monthInsight.monthEarned}
            monthSpent={monthInsight.monthSpent}
            onOpenPending={() => setShowPendingSheet(true)}
            primaryActions={
              <WalletPrimaryActions
                embedded
                disabled={!!claimingHoldId}
                onSend={() => {
                  if (balance <= 0 && (displayPending > 0 || pending > 0)) {
                    setSendEducate(
                      "Claim pending GHC to send — only available balance can be transferred."
                    )
                    setShowPendingSheet(true)
                    return
                  }
                  setSendEducate(null)
                  setP2pMode("send")
                  setP2pError(null)
                  setP2pSuccess(null)
                }}
                onRequest={() => {
                  setSendEducate(null)
                  setP2pMode("request")
                  setP2pError(null)
                  setP2pSuccess(null)
                }}
                onReceive={() => {
                  setSendEducate(null)
                  setP2pMode("receive")
                  setP2pError(null)
                  setP2pSuccess(null)
                }}
                onActivity={() => {
                  setSendEducate(null)
                  setHistoryRail("ghc")
                  setShowFullHistory(true)
                }}
              />
            }
          />
          <PaymentRecoveryBanner />
          <div className="mt-3"><PaymentRecoveryPanel /></div>
          <div className="mt-3"><PiPaymentUtilityStatus /></div>
          <UnifiedEarningsDashboard />
          <PiCashbackSummary />
          <div className="gh-premium-wallet-metrics mt-3 grid grid-cols-3 gap-2" aria-label="GHC wallet state">
            {[
              ["Available", balance, "Spendable"],
              ["Pending", displayPending, "Awaiting validation"],
              ["Locked", locked, escrowLocked > 0 ? `Escrow ${formatGhc(escrowLocked)}` : "Reserved"],
            ].map(([label, amount, note]) => (
              <div key={String(label)} className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{formatGhc(Number(amount))}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick tools under balance card */}
        <div className="mx-3 mt-3 flex flex-wrap gap-2" role="group" aria-label="Wallet quick tools">
          <QuickChip
            icon={<Share2 size={14} />}
            label="Spend GHC"
            onClick={() => {
              setAssetRail("ghc")
              setShowUtilityPanel(true)
              setSendEducate(null)
            }}
          />
          <QuickChip
            icon={<Crown size={14} />}
            label="Membership"
            onClick={() => navigateSettingsSection("membership")}
          />
          <QuickChip
            icon={<Filter size={14} />}
            label="Full statement"
            onClick={() => {
              setTab("activity")
              setTxFilter("all")
              setQuery("")
            }}
          />
          <QuickChip
            icon={<Share2 size={14} />}
            label="Export"
            onClick={() => void shareStatement()}
          />
          <button
            id="gh-wallet-export-csv"
            type="button"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onClick={() => downloadCsvStatement()}
          >
            Export CSV
          </button>
          <QuickChip
            icon={<HandCoins size={14} />}
            label="Requests"
            onClick={() => setShowRequestsPanel(true)}
          />
        </div>

        {/* Month insight + daily cap — restrained cards */}
        <div className="mx-3 mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-[var(--gh-card-shadow)]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              This month
            </p>
            <p className="mt-1.5 text-[13px] text-foreground">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                +{formatGhc(monthInsight.monthEarned)}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-bold text-stone-600 dark:text-stone-300">
                −{formatGhc(monthInsight.monthSpent)}
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-[var(--gh-card-shadow)]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Daily activity credit
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--gh-green)] transition-all"
                style={{ width: `${dailyEarnProgress.pct}%` }}
                role="progressbar"
                aria-valuenow={dailyEarnProgress.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Daily activity credit progress"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {formatGhc(dailyEarnProgress.today)} / {formatGhc(dailyEarnProgress.cap)} GHC
            </p>
          </div>
        </div>

        {shareMsg && (
          <p className="mx-3 mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 size={12} /> {shareMsg}
          </p>
        )}

        {/* Low-balance helpers */}
        {lowBalance && (
          <div className="mx-3 mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
              Unlock utility GHC
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-100/80">
              Complete your profile and join a community — eligible activity can credit GHC under
              anti-abuse limits. Pending rewards need validation before they become available.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigateTab("profile")}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <UserRound size={12} /> Complete profile
              </button>
              <button
                type="button"
                onClick={() => navigateTab("communities")}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-card"
              >
                <Users size={12} /> Join a community
              </button>
            </div>
          </div>
        )}

        <div className="mx-3 mt-3 space-y-2">
          <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
            <Info size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              GHC is an <strong>in-app utility</strong> for rewards, transfers, and features.
              It is <strong>not Pi</strong> and not an investment product. Balances are private and ledger-backed.
            </p>
          </div>
          <GhcSocialFuelNote />
        <p className="mx-3 mt-2 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          GHC is for <strong className="text-foreground">in-app utility only</strong> — transfers, rewards, and features.
          It is not Pi and not an investment product.{" "}
          <button type="button" className="font-semibold text-emerald-700 underline-offset-2 hover:underline" onClick={() => setShowUtilityHelp(true)}>
            Learn more
          </button>
        </p>
        </div>

        {/* ZONE: ACTIVITY */}
        <div id="ghc-wallet-activity" className="scroll-mt-3">
        <p className="mx-3 mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Recent Transactions
        </p>
        <div
          className="mx-3 flex gap-1 rounded-[1.25rem] border border-border/60 bg-card p-1 shadow-[var(--gh-card-shadow)]"
          role="tablist"
          aria-label="Wallet sections"
          onKeyDown={(e) => {
            const order: Tab[] = ["activity", "rewards", "about"]
            const idx = order.indexOf(tab)
            if (idx < 0) return
            if (e.key === "ArrowRight") {
              e.preventDefault()
              setTab(order[(idx + 1) % order.length])
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              setTab(order[(idx - 1 + order.length) % order.length])
            }
          }}
        >
          {(
            [
              { id: "activity" as const, label: "Activity" },
              { id: "rewards" as const, label: "Rewards" },
              { id: "about" as const, label: "About" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                tab === item.id
                  ? "bg-[var(--gh-green)] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
                {tab === "activity" ? (
          <p className="mx-3 mt-1.5 text-[11px] font-medium text-muted-foreground" aria-live="polite">
            {filteredTxs.length} transaction{filteredTxs.length === 1 ? "" : "s"}
            {txFilter !== "all" ? ` · ${txFilter}` : ""}
          </p>
        ) : null}

        </div>

        <div className="mx-3 mt-3 mb-8 space-y-2">
          {claimReceipt && (
          <div className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div>
              <p className="text-[12px] font-bold text-emerald-900 dark:text-emerald-100">
                {claimReceipt.amount >= 0
                  ? `+${claimReceipt.amount} GHC available`
                  : `${claimReceipt.amount} GHC · recorded in activity`}
              </p>
              {claimReceipt.ref ? (
                <p className="text-[10px] text-emerald-800/80 dark:text-emerald-200/80">ref {claimReceipt.ref}</p>
              ) : null}
            </div>
            <button type="button" className="text-[10px] font-bold text-emerald-800" onClick={() => setClaimReceipt(null)}>
              Dismiss
            </button>
          </div>
        )}
        {sendEducate && (
          <div className="mx-4 mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
            {sendEducate}
          </div>
        )}
        {tab === "activity" && (
            <>
              <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Transaction history
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  GHC ledger and π payments are kept on separate rails — never mixed.
                </p>
              </div>
              <div
                className="flex gap-1 rounded-2xl border border-border bg-muted/40 p-1"
                role="tablist"
                aria-label="Asset rail"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={assetRail === "ghc"}
                  onClick={() => setAssetRail("ghc")}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    assetRail === "ghc"
                      ? "bg-[var(--gh-green)] text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  GHC
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={assetRail === "pi"}
                  onClick={() => setAssetRail("pi")}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    assetRail === "pi"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  π Payments
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range">
                {(
                  [
                    { id: "today" as const, label: "Today" },
                    { id: "7d" as const, label: "7d" },
                    { id: "30d" as const, label: "30d" },
                    { id: "all" as const, label: "All" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setTxDateRange(r.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      txDateRange === r.id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {assetRail === "ghc" && (
              <>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all" as const, label: "All" },
                    { id: "earned" as const, label: "In" },
                    { id: "spent" as const, label: "Out" },
                    { id: "received" as const, label: "Received" },
                    { id: "sent" as const, label: "Sent" },
                    { id: "pending" as const, label: "Pending" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTxFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      txFilter === f.id
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {f.id === "all" ? <Filter size={10} /> : null}
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search reference, reason…"
                  className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none ring-emerald-500/30 focus:ring-2"
                  aria-label="Search transactions"
                />
              </div>

              {refreshing && filteredTxs.length === 0 ? (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-3" role="status" aria-label="Loading transactions">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-2/3 max-w-[12rem] animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-1/3 max-w-[6rem] animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-3 w-14 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : filteredTxs.length === 0 ? (
                <EmptyBlock
                  title={txs.length === 0 ? EMPTY_STATES.activity.title : "No matching transactions"}
                  body={
                    txs.length === 0
                      ? EMPTY_STATES.activity.body
                      : "Try another filter or clear the search."
                  }
                />
              ) : (
                dayGroups.map((group) => (
                  <div key={group.day} className="space-y-1.5">
                    <p className="sticky top-0 z-[1] bg-background/95 px-0.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {group.day}
                    </p>
                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                      {group.items.map((tx) => (
                        <TxRow key={tx.id} tx={tx} onOpen={() => setSelectedTx(tx)} />
                      ))}
                    </div>
                  </div>
                ))
              )}
              </>
              )}

              {assetRail === "pi" && (
                <div className="space-y-2">
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 px-3 py-2.5 dark:border-violet-900 dark:bg-violet-950/30">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                      π payment history
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Pi payment intents across supported features · separate from GHC ledger transfers
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] leading-relaxed text-muted-foreground">Refresh checks the latest stored records; it does not retry or charge a payment.</p>
                      <button type="button" onClick={() => setTick((n) => n + 1)} disabled={piIntentsLoading} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:text-violet-100 dark:hover:bg-violet-950" aria-label="Refresh Pi payment history">
                        <RefreshCw size={13} className={piIntentsLoading ? "animate-spin" : ""} /> Refresh
                      </button>
                    </div>
                  </div>
                  {!piIntentsLoading && !piIntentsError && serverReconciliation && (
                    <div className="rounded-2xl border border-border bg-card p-3" aria-label="Server payment reconciliation">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">Feature reconciliation</p>
                        <span className="text-right text-[10px] text-muted-foreground">Server · read-only{serverReconciliation.generatedAt && Number.isFinite(Date.parse(serverReconciliation.generatedAt)) ? ` · ${new Date(serverReconciliation.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                      </div>
                      {serverReconciliation.coverage?.potentiallyTruncated && (
                        <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          This report may cover only the newest {serverReconciliation.coverage.recordLimit} stored intents. It is not a complete lifetime reconciliation.
                        </p>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{serverReconciliation.counts.matched}</p><p className="text-[10px] text-muted-foreground">Matched</p></div>
                        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{serverReconciliation.counts.attention_required}</p><p className="text-[10px] text-muted-foreground">Needs attention</p></div>
                        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{serverReconciliation.counts.unverified}</p><p className="text-[10px] text-muted-foreground">Unverified</p></div>
                        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{serverReconciliation.counts.not_applicable}</p><p className="text-[10px] text-muted-foreground">Not purchase fulfilment</p></div>
                      </div>
                      {serverReconciliation.findings.some((f) => f.reconciliation === "attention_required" || f.reconciliation === "unverified") && (
                        <ul className="mt-2 space-y-1.5" aria-label="Reconciliation findings">
                          {serverReconciliation.findings.filter((f) => f.reconciliation === "attention_required" || f.reconciliation === "unverified").slice(0, 5).map((f) => (
                            <li key={`${f.intentId}:${f.code}`} className="rounded-lg bg-amber-50/70 p-2 text-[11px] dark:bg-amber-950/30">
                              <p className="font-semibold">{f.purpose.replaceAll("_", " ")} · {f.code.replaceAll("_", " ")}</p>
                              <p className="mt-0.5 text-muted-foreground">{f.message}</p>
                              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{f.intentId}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Marketplace and membership have explicit record checks. Other feature categories remain unverified until their authoritative record mappings are implemented. No records are changed by these checks.</p>
                    </div>
                  )}
                  {!piIntentsLoading && !piIntentsError && piIntents.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-3" aria-label="Payment intent field checks">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">Payment checks</p>
                        <span className="text-[10px] text-muted-foreground">Read-only</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{piReconciliation.awaitingFulfilment.length}</p>
                          <p className="text-[10px] leading-snug text-muted-foreground">Paid, fulfilment not confirmed</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{piReconciliation.needsAttention.length}</p>
                          <p className="text-[10px] leading-snug text-muted-foreground">Failed or incomplete intents</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{piReconciliation.missingReference.length}</p>
                          <p className="text-[10px] leading-snug text-muted-foreground">Missing order/reference</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{piReconciliation.paidMissingProviderId.length}</p>
                          <p className="text-[10px] leading-snug text-muted-foreground">Paid without Pi payment ID</p>
                        </div>
                      </div>
                      {(piReconciliation.awaitingFulfilment.length > 0 || piReconciliation.missingReference.length > 0 || piReconciliation.paidMissingProviderId.length > 0) && (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200" role="status">
                          Review these payment-intent field warnings alongside the server feature reconciliation above. They are diagnostic only and do not change payment or fulfilment state.
                        </p>
                      )}
                    </div>
                  )}
                  {piIntentsLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground" role="status">Loading π payments…</p>
                  ) : piIntentsError ? (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
                      <p className="font-semibold">Payment history unavailable</p>
                      <p className="mt-1 text-xs leading-relaxed">{piIntentsError}</p>
                      <button type="button" onClick={() => setTick((n) => n + 1)} className="mt-3 min-h-9 rounded-xl border border-current/20 px-3 text-xs font-bold">Retry history</button>
                    </div>
                  ) : filteredPiIntents.length === 0 ? (
                    <EmptyBlock
                      title="No π payments yet"
                      body="Complete a membership or GH Pay purchase in Pi Browser to see intents here."
                    />
                  ) : (
                    filteredPiIntents.map((intent) => (
                      <div
                        key={intent.id}
                        className="rounded-2xl border border-border bg-card px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {intent.productLabel || intent.productId || paymentPurposeLabel(intent.purpose)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {typeof intent.createdAt === "number" && intent.createdAt > 0
                                ? formatWhen(intent.createdAt)
                                : "Date unavailable"}
                              {intent.referenceId ? ` · Ref ${intent.referenceId.slice(0, 12)}${intent.referenceId.length > 12 ? "…" : ""}` : ""}
                              {intent.paymentId ? ` · Pi ID ${intent.paymentId.slice(0, 12)}…` : ""}
                            </p>
                            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/80">
                              {intent.id}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {typeof intent.amountPi === "number" ? (
                              <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                                {intent.amountPi.toLocaleString(undefined, { maximumFractionDigits: 8 })} {intent.currency === "GHC" ? "GHC" : "π"}
                              </p>
                            ) : null}
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                String(intent.status).toLowerCase().includes("complete") ||
                                String(intent.status).toLowerCase().includes("fulfill")
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                  : String(intent.status).toLowerCase().includes("fail") ||
                                      String(intent.status).toLowerCase().includes("cancel")
                                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              }`}
                            >
                              {{
                                CREATED: "Awaiting approval",
                                APPROVAL_PENDING: "Approval pending",
                                APPROVED: "Approved",
                                USER_SUBMITTED: "Submitted",
                                COMPLETION_PENDING: "Confirming payment",
                                COMPLETED: "Paid · fulfilment pending",
                                FULFILLED: "Completed",
                                FAILED: "Failed",
                                CANCELLED: "Cancelled",
                                REFUNDED: "Refunded",
                                INCOMPLETE: "Needs attention",
                              }[String(intent.status || "").toUpperCase()] || String(intent.status || "Status unavailable").replaceAll("_", " ")}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                          <span className="text-[10px] text-muted-foreground">Stored payment record · read-only</span>
                          <button
                            type="button"
                            onClick={() => setSelectedPiIntent(intent)}
                            aria-label={`View details for payment ${intent.id}`}
                            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-bold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            View details <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}


        {/* Settlement & tools — below primary activity, not mixed into the hero */}
        <div className="mx-3 mt-5 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-1 shadow-sm">
            <p className="px-3 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              GHC settlement
            </p>
            <p className="px-3 pb-2 text-[11px] leading-relaxed text-muted-foreground">
              Request Pi settlement of eligible GHC. Not an instant transfer · rate 100 GHC per 1 π.
            </p>
            <WithdrawGhcPanel />
          </div>

          <WalletToolsGrid
            onSelect={(id) => {
              if (id === "utility") {
                setShowUtilityPanel(true)
                setAssetRail("ghc")
              } else if (id === "tx") {
                setTab("activity")
                setTxFilter("all")
                setAssetRail("ghc")
              } else if (id === "statements") {
                setTab("activity")
                setTxFilter("all")
                window.setTimeout(() => {
                  try {
                    ;(document.getElementById("gh-wallet-export-csv") as HTMLButtonElement | null)?.click()
                  } catch { /* */ }
                }, 0)
              } else if (id === "qr") {
                setP2pMode("receive")
              } else if (id === "methods") {
                setShowPaymentMethods(true)
              } else if (id === "limits") {
                setTab("about")
                window.setTimeout(() => {
                  document.getElementById("ghc-wallet-limits")?.scrollIntoView({ behavior: "smooth", block: "center" })
                }, 0)
              } else if (id === "security") {
                setTab("about")
                window.setTimeout(() => {
                  document.getElementById("ghc-wallet-security")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }, 0)
              }
            }}
          />

          {showUtilityPanel ? (
            <div className="mx-3 mt-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-foreground">Utility catalog</p>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-muted-foreground"
                  onClick={() => setShowUtilityPanel(false)}
                >
                  Close
                </button>
              </div>
              <GhcUtilityPanel
                compact
                onToast={(msg, type) => addToast(msg, type || "info")}
              />
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/80 bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Pay with π (Pi Browser)</p>
            <p className="mt-1">{ASSET_POLICY.ghcRailsCopy}</p>
            <p className="mt-0.5">{ASSET_POLICY.piRailsCopy}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/90">
              GreenHaven device PIN only unlocks this app — Pi Wallet authorizes π charges.
            </p>
          </div>
          <div id="ghc-wallet-gh-pay" className="scroll-mt-4">
          {selectedGhcPack ? (
            <div className="mx-3 mb-2 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-[12px] dark:border-violet-900 dark:bg-violet-950/40">
              <p className="font-bold text-violet-900 dark:text-violet-100">
                Pack selected: {selectedGhcPack.label || `${selectedGhcPack.ghcAmount} GHC`}
              </p>
              <p className="text-muted-foreground">
                Pay {selectedGhcPack.piAmount} π via GH Pay, then server credits GHC (product {selectedGhcPack.productId}).
              </p>
            </div>
          ) : null}
          <GhPayPanel
            compact
            onToast={(msg, type) => {
              const level =
                type === "error" || type === "success" || type === "info" ? type : "info"
              addToast(msg, level)
            }}
          />
        </div>
        </div>

          {tab === "rewards" && (
            <>
              {rewards.length === 0 ? (
                <EmptyBlock
                  title="No rewards yet — complete your profile to unlock your first GHC"
                  body="Complete a challenge in Rewards to see activity here. Eligible activity can receive GHC under anti-abuse limits."
                />
              ) : (
                rewards.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-border bg-card px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {r.category || r.ruleId || "Reward"}
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                        <GhcCoinIcon size={16} />
                        +{formatGhc(r.amount)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Status:{" "}
                      <span className="font-semibold">
                        {r.validationStatus}
                      </span>
                      {r.sourceEvent ? ` · ${r.sourceEvent}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      {formatWhen(r.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "about" && (
            <div id="ghc-wallet-security" className="space-y-3 rounded-2xl border border-border bg-card p-4 scroll-mt-6">
              <div className="flex gap-2">
                <Shield size={16} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-foreground">How GHC works</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-muted-foreground">
                    <li>{ASSET_POLICY.ghcRailsCopy}</li>
                    <li>{ASSET_POLICY.piRailsCopy}</li>
                    <li>{ASSET_POLICY.piPeerCopy}</li>
                    <li>{ASSET_POLICY.referenceUnitCopy}</li>
                    <li>Every balance change has a ledger transaction with a reason.</li>
                    <li>Pending amounts are not spendable until validated or claimed.</li>
                    <li>You cannot send more GHC than your available balance. Self-transfers are blocked.</li>
                    <li>Transfer requests never mint GHC — they only ask another user to send.</li>
                    <li>This screen is private — not shown on your public profile.</li>
                  </ul>
                </div>
              </div>
              <div id="ghc-wallet-limits" className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 scroll-mt-6 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <Info size={15} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <p className="text-xs font-bold text-foreground">Utility policy & current pricing</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  GHC is an in-app utility balance, not an investment or a promise of cash value. It has no guaranteed external exchange or redemption value. Pi payments remain a separate payment rail.
                </p>
                {economyPolicyLoading ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Loading current server policy…</p>
                ) : economyPolicy ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">Economy policy v{economyPolicy.version}. {economyPolicy.asset.referenceRateDisclaimer}</p>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Base daily-claim schedule</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{economyPolicy.issuance.dailyClaimBaseGrossGhc.map((amount, index) => `Day ${index + 1}: ${formatGhc(amount)} GHC`).join(" · ")}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{economyPolicy.issuance.note}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Fixed-price uses</p>
                      <div className="mt-1.5 space-y-1.5">
                        {economyPolicy.fixedSpendCatalog.map((item) => (
                          <div key={item.purpose} className="flex items-start justify-between gap-3 text-[11px]">
                            <span className="min-w-0 text-muted-foreground">{item.description}</span>
                            <span className="shrink-0 font-semibold text-foreground">{formatGhc(item.amountGhc)} GHC</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">{economyPolicy.asset.piToGhcPurchaseNote} {economyPolicy.asset.ghcToPiWithdrawalFeatureFlagEnabled ? "The GHC-to-Pi request feature flag is enabled; this is not a guarantee of approval or settlement." : "GHC-to-Pi withdrawals are disabled by default."}</p>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">Current server pricing could not be loaded. Do not rely on cached or user-supplied prices.</p>
                    <button
                      type="button"
                      onClick={() => setEconomyPolicyRetry((attempt) => attempt + 1)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Retry policy
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <Clock size={12} />
                Your wallet keeps your available activity together here. Some updates may finish syncing after you reconnect.
              </div>
              <button
                type="button"
                onClick={() => void shareStatement()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-sm font-bold text-foreground"
              >
                <Share2 size={16} /> Export month statement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pending breakdown sheet */}
      {showPaymentMethods && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-methods-title">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setShowPaymentMethods(false)} />
          <div className="relative z-[1] w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="pay-methods-title" className="text-base font-bold text-foreground">Payment methods</h2>
              <button type="button" onClick={() => setShowPaymentMethods(false)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Choose an available payment method. Additional payment options will appear here when supported.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white">GHC</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">GHC wallet</p>
                  <p className="text-[11px] text-muted-foreground">Send, request, and receive in-app utility credits</p>
                  <span className="mt-1 inline-block rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">Available</span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 px-3 py-3 dark:border-violet-900 dark:bg-violet-950/40">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-bold text-white">π</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Pi (GH Pay)</p>
                  <p className="text-[11px] text-muted-foreground">External π rail · membership & packs · not mixed with GHC</p>
                  <span className="mt-1 inline-block rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800 dark:text-violet-200">Available</span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-3 py-3 opacity-80">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <CreditCard size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Cards / bank</p>
                  <p className="text-[11px] text-muted-foreground">Not enabled for this release</p>
                  <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Coming soon</span>
                </div>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowPaymentMethods(false)}
              className="mt-4 w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showUtilityHelp && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Dismiss" onClick={() => setShowUtilityHelp(false)} />
          <div className="relative z-10 max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl">
            <h3 className="text-lg font-bold text-foreground">About GreenHaven Coin</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              GHC is an internal utility balance for GreenHaven features, rewards, and peer transfers inside the app.
              It is separate from Pi. Balances come from the ledger and stay private on your profile.
            </p>
            <button type="button" onClick={() => setShowUtilityHelp(false)} className="mt-4 min-h-11 w-full rounded-2xl bg-emerald-600 font-bold text-white">
              Got it
            </button>
          </div>
        </div>
      )}
      {showPendingSheet && (
        /* pending sheet */
        <div
          className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Pending (held) breakdown"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setShowPendingSheet(false)}
          />
          <div
            className="relative z-[181] flex max-h-[75vh] w-full max-w-md flex-col rounded-t-[1.25rem] border border-border/50 bg-card shadow-2xl sm:mb-8 sm:rounded-[1.25rem]"
            style={{
              marginBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">Pending GHC</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatGhc(displayPending)} GHC not yet available to send
                </p>
                {claimFeedback ? (
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">{claimFeedback}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowPendingSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                aria-label="Close pending sheet"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {pendingHolds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                  <Clock size={22} className="mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold text-foreground">Nothing pending</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    When a reward is under validation, it appears here with a clear reason and
                    expected window.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pendingHolds.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-2xl border border-border bg-background px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              {SOURCE_LABEL[h.source]}
                            </span>
                            <span
                              className={
                                h.claimState === "ready"
                                  ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                                  : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                              }
                            >
                              {h.claimState === "ready" ? "Ready to claim" : "Under review"}
                            </span>
                            {(h.stackCount || 1) > 1 ? (
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                ×{h.stackCount}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatGhc(h.amount)} GHC · {h.claimState === "review" ? "Pending validation" : "Ready to claim"}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-foreground">{h.reason}</p>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-foreground">Why pending: </span>
                            {SOURCE_WHY[h.source]}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">What happens next: </span>
                            {h.claimState === "review"
                              ? h.expectedClearLabel
                              : "Tap Claim to move this amount into your available balance. Then you can send or spend it."}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            Source: {SOURCE_LABEL[h.source]} · Created {formatWhen(h.createdAt)}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-amber-700">
                          <GhcCoinIcon size={16} />
                          +{formatGhc(h.amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={offline || claimingHoldId === h.id || h.claimState === "review"}
                        onClick={() => void claimPendingHold(h.id)}
                        className="gh-btn gh-btn-primary mt-2.5 w-full text-[12px] disabled:pointer-events-none disabled:opacity-60"
                      >
                        {h.claimState === "review"
                          ? "Under review"
                          : claimingHoldId === h.id
                            ? "Claiming…"
                            : (h.stackCount || 1) > 1
                              ? `Claim ×${h.stackCount} to available`
                              : "Claim to available balance"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pendingHolds.length > 0 ? (
                <button
                  type="button"
                  disabled={offline || !!claimingHoldId}
                  onClick={() => {
                    void (async () => {
                      for (const h of pendingHolds) {
                        await claimPendingHold(h.id)
                      }
                    })()
                  }}
                  className="mt-3 w-full rounded-[1.25rem] border border-[var(--gh-green)] bg-emerald-50 px-3 py-2.5 text-[12px] font-bold text-emerald-800 disabled:opacity-60"
                >
                  Claim all pending
                </button>
              ) : null}
              <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
                Claim moves GHC to your available balance. Only available GHC can be sent. Pending
                is never spendable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Send / Request / Receive — portal overlays (inside root) */}
      <AddGhcSheet
        open={showAddGhc}
        onClose={() => setShowAddGhc(false)}
        onEarn={() => navigateSettingsSection("rewards")}
        onReceive={() => {
          setP2pMode("receive")
          setP2pError(null)
          setP2pSuccess(null)
        }}
        onBuy={() => {
          setAssetRail("pi")
          setTab("activity")
          try {
            document.getElementById("ghc-wallet-gh-pay")?.scrollIntoView({ behavior: "smooth", block: "start" })
          } catch { /* */ }
        }}
        onSelectPack={(pack) => {
          setSelectedGhcPack(pack)
          setAssetRail("pi")
          setTab("activity")
          try {
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: {
                  message: `Selected ${pack.label || pack.ghcAmount + " GHC"} · pay ${pack.piAmount} π then complete purchase`,
                  type: "info",
                },
              }),
            )
          } catch { /* */ }
          try {
            document.getElementById("ghc-wallet-gh-pay")?.scrollIntoView({ behavior: "smooth", block: "start" })
          } catch { /* */ }
        }}
      />
      <SendGhcFlow
        open={p2pMode === "send"}
        onClose={() => {
          setP2pMode(null)
          setP2pError(null)
          setP2pSuccess(null)
          setSendPrefill(null)
        }}
        availableBalance={balance}
        onCompleted={() => {
          setTick((x) => x + 1)
          void refresh()
        }}
        limits={DEFAULT_ECONOMY_LIMITS}
        initialRecipient={sendPrefill}
      />

      <ReceiveGhcFlow
        open={p2pMode === "receive"}
        onClose={() => setP2pMode(null)}
        availableBalance={balance}
        onSendToRecipient={(recipient) => {
          setSendPrefill(recipient)
          setP2pMode("send")
        }}
      />

      <RequestGhcFlow
        open={p2pMode === "request"}
        onClose={() => {
          setP2pMode(null)
          setP2pError(null)
          setP2pSuccess(null)
        }}
        onCompleted={() => {
          setTick((x) => x + 1)
          void refresh()
        }}
        limits={DEFAULT_ECONOMY_LIMITS}
      />

      <GhcRequestsPanel
        open={showRequestsPanel}
        onClose={() => setShowRequestsPanel(false)}
        availableBalance={balance}
        onChanged={() => {
          setTick((x) => x + 1)
          void refresh()
        }}
      />


      {showFullHistory ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Wallet history">
          <header className="flex items-center gap-2 border-b border-border px-3 py-3">
            <button type="button" onClick={() => setShowFullHistory(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close history">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">Transaction history</h2>
              <p className="text-[11px] text-muted-foreground">GHC ledger and π payments stay on separate rails</p>
            </div>
          </header>
          <div className="flex gap-2 border-b border-border px-3 py-2">
            <button type="button" onClick={() => setHistoryRail("ghc")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${historyRail === "ghc" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>GHC</button>
            <button type="button" onClick={() => setHistoryRail("pi")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${historyRail === "pi" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>π Payments</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {historyRail === "ghc" ? (
              <div className="space-y-1">
                {(txs || []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No GHC transactions yet.</p>
                ) : (
                  (txs || []).map((tx: any) => (
                    <TxRow key={tx.id || `${tx.createdAt}-${tx.amount}`} tx={tx} onOpen={() => setSelectedTx?.(tx)} />
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(piIntents || []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No π payment intents for this account.</p>
                ) : (
                  (piIntents || []).map((intent: any) => (
                    <button
                      key={intent.id}
                      type="button"
                      onClick={() => setSelectedPiIntent?.(intent)}
                      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{intent.memo || intent.purpose || intent.id}</p>
                        <p className="text-[11px] text-muted-foreground">{intent.status} · {intent.amountPi != null ? `${intent.amountPi} π` : ""}</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <PiPaymentDetail
        intent={selectedPiIntent as PiPaymentDetailRecord | null}
        finding={selectedPiIntent ? serverReconciliation?.findings.find((item) => item.intentId === selectedPiIntent.id) : undefined}
        onClose={() => setSelectedPiIntent(null)}
      />
      <GhcTransactionDetail
        open={!!selectedTx}
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  )
}

