"use client"

/**
 * Premium Wallet — feature module entry (`features/wallet`).
 * GHC available / pending / activity. Never mixes GHC with Pi.
 * Split further: wallet-header, wallet-balance, wallet-activity (next passes).
 */

import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react"
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
} from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { SendGhcFlow } from "@/components/ghc/send-ghc-flow"
import { RequestGhcFlow } from "@/components/ghc/request-ghc-flow"
import { ReceiveGhcFlow } from "@/components/ghc/receive-ghc-flow"
import type { SendRecipient } from "@/components/ghc/send-ghc-flow"
import { GhcTransactionDetail } from "@/components/ghc/ghc-transaction-detail"
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
import { WalletBalanceCard } from "./wallet-balance"
import { WalletPrimaryActions } from "./wallet-actions"
import { WalletToolsGrid } from "./wallet-tools"
import { AddGhcSheet } from "./add-ghc-sheet"

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0.00"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  /* wallet-refresh listener attached below */

  const [tab, setTab] = useState<Tab>("activity")
  const [tick, setTick] = useState(0)
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
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )

  const [txFilter, setTxFilter] = useState<TxFilter>("all")
  const [query, setQuery] = useState("")
  const [showPendingSheet, setShowPendingSheet] = useState(false)
  const [showUtilityHelp, setShowUtilityHelp] = useState(false)
  const [claimingHoldId, setClaimingHoldId] = useState<string | null>(null)
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
    const onRefresh = () => setTick((x) => x + 1)
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    return () => window.removeEventListener("ghc:wallet-refresh", onRefresh)
  }, [])
  const [showRequestsPanel, setShowRequestsPanel] = useState(false)
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
  const balance = wallet?.balance ?? 0
  const pending = wallet?.pending ?? 0
  const earned = wallet?.lifetimeEarned ?? (wallet as { earned?: number })?.earned ?? 0
  const spent = wallet?.lifetimeSpent ?? (wallet as { spent?: number })?.spent ?? 0
  const txs = data?.txs ?? []
  const rewards = data?.rewards ?? []

  const pendingHolds: PendingHold[] = useMemo(() => {
    const holds: PendingHold[] = []
    for (const tx of txs) {
      if (tx.status === "pending" && tx.amount > 0) {
        const review =
          Boolean((tx.metadata as { reviewRequired?: boolean } | undefined)?.reviewRequired)
        holds.push({
          id: tx.id,
          amount: tx.amount,
          reason: tx.reason || TX_LABELS[tx.kind] || "Pending credit",
          source: classifyPendingSource(tx.reason || "", tx.sourceEvent || ""),
          expectedClearLabel: review
            ? "Under review — not claimable yet"
            : "Ready to claim to available balance",
          createdAt: tx.createdAt,
          claimState: review ? "review" : "ready",
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
    setClaimingHoldId(holdId)
    setClaimFeedback(null)
    try {
      const eco = getBoundDomainServices()?.economy as
        | {
            claimReward?: (id: string) => Promise<{ ok: boolean; error?: string }>
          }
        | undefined
      if (!eco?.claimReward) {
        setClaimFeedback("Claim unavailable right now")
        return
      }
      const hold = pendingHolds.find((h) => h.id === holdId)
      const ids = hold?.stackIds?.length ? hold.stackIds : [holdId]
      let claimed = 0
      let lastErr: string | undefined
      for (const id of ids) {
        // Prefer server claim when available, then local domain
        try {
          const serverRes = await fetch("/api/economy/rewards/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ holdId: id }),
          })
          if (serverRes.ok) {
            const body = (await serverRes.json()) as { ok?: boolean; mode?: string }
            if (body.ok && body.mode !== "local") {
              claimed += 1
              continue
            }
          }
        } catch {
          /* fall through to local */
        }
        const res = await eco.claimReward(id)
        if (res.ok) claimed += 1
        else lastErr = res.error
      }
      if (claimed === 0) {
        setClaimFeedback(lastErr || "Could not claim pending GHC")
      } else {
        const amt = hold?.amount ?? 0
        const ref = hold?.id?.slice(0, 12)
        setClaimReceipt({ amount: amt, ref })
        setClaimFeedback(
          amt > 0
            ? `+${amt} GHC available${ref ? ` · ref ${ref}` : ""}`
            : claimed > 1
              ? `Claimed ${claimed} items — added to available balance`
              : "Claimed — added to available balance"
        )
        setShowPendingSheet(false)
        setTab("activity")
        setTick((x) => x + 1)
        try {
          await refresh()
        } catch {
          /* refresh optional */
        }
      }
    } catch (e) {
      setClaimFeedback(e instanceof Error ? e.message : "Claim failed")
    } finally {
      setClaimingHoldId(null)
    }
  }

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
      return true
    })
  }, [txs, txFilter, query])

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
      } else {
        await new Promise((r) => setTimeout(r, 400))
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
        typ === "WALLET_TRANSFER_CREATED"
      ) {
        setTick((x) => x + 1)
        void refresh()
      }
    })
    return () => {
      try {
        unsub?.()
      } catch {
        /* */
      }
    }
  }, [refresh])


  const buildStatementText = useCallback(() => {
    const month = new Date().toLocaleString(undefined, { month: "long", year: "numeric" })
    const lines = [
      `GreenHaven — GHC statement (${month})`,
      `Available: ${formatGhc(balance)} GHC`,
      `Pending: ${formatGhc(displayPending)} GHC`,
      `Lifetime activity credit: ${formatGhc(earned)} · spent: ${formatGhc(spent)}`,
      `This month: +${formatGhc(monthInsight.monthEarned)} / −${formatGhc(monthInsight.monthSpent)}`,
      "",
      "Recent activity:",
    ]
    const recent = txs.slice(0, 15)
    if (recent.length === 0) {
      lines.push("No activity yet yet.")
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
  }, [balance, displayPending, earned, spent, monthInsight, txs])

  const shareStatement = useCallback(async () => {
    const text = buildStatementText()
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "GHC statement", text })
        setShareMsg("Shared")
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setShareMsg("Copied to clipboard")
      } else {
        setShareMsg("Copy unavailable on this device")
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setShareMsg("Copied to clipboard")
      } catch {
        setShareMsg("Could not share")
      }
    }
    window.setTimeout(() => setShareMsg(null), 2500)
  }, [buildStatementText])

  const submitP2p = useCallback(async () => {
    setP2pError(null)
    setP2pSuccess(null)
    const amount = Number(p2pAmount)
    const name = p2pName.trim()
    const id = (p2pId.trim() || name.toLowerCase().replace(/\s+/g, "-") || "").slice(0, 64)
    if (!name) {
      setP2pError("Enter the recipient’s name or GH username")
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
        }) => Promise<{ ok: boolean; error?: string }>
        requestGhcFromUser?: (i: {
          fromUserId: string
          fromUserName: string
          amount: number
          note?: string
        }) => Promise<{ ok: boolean; error?: string }>
      } | null
      if (p2pMode === "send") {
        if (!eco?.sendGhcToUser) {
          setP2pError("Transfers unavailable offline")
          return
        }
        const res = await eco.sendGhcToUser({
          toUserId: id,
          toUserName: name,
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
          fromUserId: id,
          fromUserName: name,
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

  const lowBalance = balance === 0 && displayPending === 0
  const showAuthorityBanner = offline || refreshFailed

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
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <WalletHeader
        onBack={onBack}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        lastSynced={lastSynced}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]">
        {showAuthorityBanner && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
                {offline
                  ? "You're offline. Showing the last known ledger — balances update after validation when you're back online."
                  : "Couldn’t refresh balance. Showing local ledger — balances update after validation."}
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

        <WalletBalanceCard
          balance={balance}
          balanceVisible={balanceVisible}
          onToggleVisible={() => setBalanceVisible((v) => !v)}
          refreshing={refreshing}
          lastSynced={lastSynced}
          pending={displayPending}
          monthEarned={monthInsight.monthEarned}
          monthSpent={monthInsight.monthSpent}
          onOpenPending={() => setShowPendingSheet(true)}
        />

        <WalletPrimaryActions
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
          onAdd={() => setShowAddGhc(true)}
        />

        <WalletToolsGrid
          onSelect={(id) => {
            if (id === "tx" || id === "statements") {
              setTab("activity")
              setTxFilter("all")
            } else if (id === "qr") {
              setP2pMode("receive")
            } else if (id === "methods") {
              addToast("Payment methods: GHC peer transfers · π via GH Pay", "info")
            } else if (id === "limits") {
              setTab("about")
            } else if (id === "security") {
              setTab("about")
            }
          }}
        />

        <div className="mx-3 mt-4">
          <GhPayPanel compact onToast={addToast} />
        </div>

        {/* Pending GHC — explain why held, then claim */}
        {displayPending > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowPendingSheet(true)
            }}
            className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left transition hover:bg-amber-100/80 active:scale-[0.99] dark:border-amber-900 dark:bg-amber-950/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200">
              <Clock size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-amber-950 dark:text-amber-100">
                {formatGhc(displayPending)} GHC pending validation
              </span>
              <span className="block text-[11px] text-amber-800/80 dark:text-amber-200/80">
                Not spendable yet · open details or claim in Rewards when ready
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-amber-700" aria-hidden />
          </button>
        )}

        {/* Secondary: Rewards · Membership · Boost · Statement */}
        <div className="mx-3 mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          <QuickChip
            icon={<Gift size={14} />}
            label="Rewards"
            onClick={() => navigateSettingsSection("rewards")}
          />
          <QuickChip
            icon={<Share2 size={14} />}
            label="Boost 25 GHC"
            onClick={async () => {
              try {
                const eco = getBoundDomainServices()?.economy as {
                  purchaseBoost?: (i: {
                    target: "profile" | "post"
                    amount?: number
                  }) => Promise<{ ok: boolean; error?: string }>
                }
                if (!eco?.purchaseBoost) return
                if (balance < 25) {
                  setSendEducate(
                    pending > 0 || displayPending > 0
                      ? "Need 25 available GHC — claim pending first"
                      : "Need 25 available GHC for a profile boost"
                  )
                  if (pending > 0 || displayPending > 0) setShowPendingSheet(true)
                  return
                }
                const res = await eco.purchaseBoost({ target: "profile", amount: 25 })
                setClaimFeedback(
                  res.ok ? "Profile boost purchased (−25 GHC)" : res.error || "Boost failed"
                )
                if (res.ok) {
                  setClaimReceipt({ amount: -25, ref: "boost_profile" })
                  setTab("activity")
                }
                setTick((x) => x + 1)
                void refresh()
              } catch (e) {
                setClaimFeedback(e instanceof Error ? e.message : "Boost failed")
              }
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
          <QuickChip
            icon={<HandCoins size={14} />}
            label="Requests"
            onClick={() => setShowRequestsPanel(true)}
          />
        </div>

        {/* Month insight + daily cap — restrained */}
        <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              This month
            </p>
            <p className="mt-1 text-xs text-foreground">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                +{formatGhc(monthInsight.monthEarned)}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-bold text-stone-600 dark:text-stone-300">
                −{formatGhc(monthInsight.monthSpent)}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Daily activity credit cap
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${dailyEarnProgress.pct}%` }}
                role="progressbar"
                aria-valuenow={dailyEarnProgress.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Daily activity credit progress"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
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

        {/* Tabs */}
        <div className="mx-3 mt-4 flex gap-1 rounded-2xl border border-border bg-card p-1">
          {(
            [
              { id: "activity" as const, label: "Activity" },
              { id: "rewards" as const, label: "Rewards" },
              { id: "about" as const, label: "About" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                tab === t.id
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
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
                  Posted ledger only · pending shown separately until claimable
                </p>
              </div>
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

              {filteredTxs.length === 0 ? (
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
                  <div key={group.day} className="space-y-2">
                    <p className="sticky top-0 z-[1] bg-background/95 px-0.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {group.day}
                    </p>
                    {group.items.map((tx) => (
                      <TxRow key={tx.id} tx={tx} onOpen={() => setSelectedTx(tx)} />
                    ))}
                  </div>
                ))
              )}
            </>
          )}

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
                        {r.validationStatus || r.status || "posted"}
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
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex gap-2">
                <Shield size={16} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-foreground">How GHC works</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-muted-foreground">
                    <li>Every balance change has a ledger transaction with a reason.</li>
                    <li>Pending amounts are not spendable until validated.</li>
                    <li>Premium and marketplace spends appear as spent transactions.</li>
                    <li>GHC is separate from Pi Network balances and external currency.</li>
                    <li>This screen is private — not shown on your public profile.</li>
                    <li>Daily activity credit caps and anti-abuse rules protect the economy.</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <Clock size={12} />
                Server-authoritative when backend is connected; local ledger used offline.
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
            className="relative z-[181] flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:mb-8 sm:rounded-3xl"
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
                        disabled={claimingHoldId === h.id || h.claimState === "review"}
                        onClick={() => void claimPendingHold(h.id)}
                        className="mt-2.5 w-full rounded-xl bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 active:scale-[0.99]"
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
                  disabled={!!claimingHoldId}
                  onClick={() => {
                    void (async () => {
                      for (const h of pendingHolds) {
                        await claimPendingHold(h.id)
                      }
                    })()
                  }}
                  className="mt-3 w-full rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2.5 text-[12px] font-bold text-emerald-800 disabled:opacity-60"
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

      <GhcTransactionDetail
        open={!!selectedTx}
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  )
}

