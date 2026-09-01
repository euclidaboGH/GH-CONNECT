/**
 * EconomyDomain — canonical GreenHaven economy.
 *
 * Owns: GHC ledger, wallet snapshot, rewards, premium membership hooks,
 * limits, anti-abuse. Does not implement on-chain tokens.
 *
 * Backend is authoritative for persistent balances when EconomyRepository is HTTP.
 * Local mode: in-memory + localStorage ledger for Studio/offline only.
 *
 * ABSOLUTE RULE (server mode):
 * Every operation that increases, decreases, claims, or spends GHC must be
 * authorized by the server ledger (intent → verify → ledger → notify).
 * Client never invents available balance. Paths:
 *   spend / marketplace / boost / premium → POST /economy/ledger/spend
 *   claim reward / daily → POST /economy/rewards/claim
 *   stage reward → POST /economy/rewards/evaluate
 *   P2P → POST /economy/transfers
 *   purchase credit → server payment completion only (hydrate)
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"
import type {
  GhcTransaction,
  GhcWalletSnapshot,
  RewardRecord,
  RewardRule,
  PremiumMembership,
  EconomyLimits,
  RewardCategory,
} from "./economy-types"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"
import type {
  EconomyPersistenceMode,
  GhcTransferIntent,
  GhcTransferResult,
} from "./economy-transfer-contract"
import { mapTransferFailure } from "./economy-transfer-contract"
import {
  emptyWallet,
  computeWalletFromLedger,
  createLedgerTransaction,
  canPostDebit,
  reverseTransaction,
} from "./economy-ledger"
import { DEFAULT_REWARD_RULES, rulesBySourceEvent } from "./reward-rules"
import {
  DEFAULT_ANTI_ABUSE_POLICY,
  type EconomyAntiAbusePolicy,
  type EarnEligibilityContext,
  hitRateLimit,
  findDuplicateTransaction,
  findDuplicateReward,
  checkEarnEligibility,
  auditLedgerIntegrity,
  summarizeIntegrity,
} from "./economy-integrity"

const STORAGE_KEY = "ghc_economy_ledger_v1"

let rewardBridgeUnsub: (() => void) | null = null

export interface EconomyRepository {
  /** local = Studio localStorage; server = API is authority (never fall back silently) */
  mode?: EconomyPersistenceMode
  listTransactions(userId: string): GhcTransaction[]
  appendTransaction(tx: GhcTransaction): void
  /**
   * LOCAL ONLY atomic double-entry when both legs are built in-domain.
   * Forbidden as the HTTP path for real transfers — use executeTransfer instead.
   */
  appendTransferPair?: (debit: GhcTransaction, credit: GhcTransaction) => void
  /**
   * SERVER-AUTHORITATIVE money move: one call → POST /economy/transfers (intent only).
   * Must not accept client-built transfer_in as authority.
   * On failure: do not invent a local success.
   */
  executeTransfer?: (intent: GhcTransferIntent) => Promise<GhcTransferResult>
  /** Lookup by reference before retry after timeout */
  findTransferByReference?: (
    userId: string,
    referenceId: string
  ) => Promise<{ debit?: GhcTransaction; credit?: GhcTransaction } | null>
  updateTransaction?: (userId: string, id: string, patch: Partial<GhcTransaction>) => void
  /** Durable transfer-request rows when server provides them */
  listTransferRequests?: (
    userId: string,
    direction: "incoming" | "outgoing" | "all"
  ) => Promise<import("./economy-types").GhcTransferRequest[]>
  upsertTransferRequest?: (
    request: import("./economy-types").GhcTransferRequest
  ) => Promise<void>
  listRewards(userId: string): RewardRecord[]
  appendReward(reward: RewardRecord): void
  updateReward(id: string, patch: Partial<RewardRecord>): void
  getPremium(userId: string): PremiumMembership | null
  setPremium(membership: PremiumMembership): void
  /**
   * Hydrate ledger from server. Must not clobber newer local cache entries
   * when server payload is older (by updatedAt / max createdAt).
   */
  hydrate?: (userId: string) => Promise<void>
  /** Server-mode only: claim pending hold via POST /economy/rewards/claim */
  claimPendingReward?: (holdId: string) => Promise<{
    ok: boolean
    amount?: number
    transactionId?: string
    alreadyClaimed?: boolean
    transaction?: GhcTransaction
    error?: string
  }>
  /** Server-mode only: stage pending via POST /economy/rewards/evaluate */
  evaluateRewardServer?: (input: {
    amount: number
    referenceId: string
    reason: string
    sourceEvent?: string
  }) => Promise<{
    ok: boolean
    holdId?: string
    transaction?: GhcTransaction
    idempotent?: boolean
    error?: string
  }>
  /** Server-mode only: spend via POST /economy/ledger/spend */
  spendGhc?: (input: {
    amount: number
    referenceId: string
    reason: string
    sourceEvent?: string
    kind?: "spent" | "purchased"
  }) => Promise<{
    ok: boolean
    transaction?: GhcTransaction
    idempotent?: boolean
    error?: string
  }>
}

function loadLocalBundle(userId: string): {
  txs: GhcTransaction[]
  rewards: RewardRecord[]
  premium: PremiumMembership | null
} {
  try {
    if (typeof localStorage === "undefined") {
      return { txs: [], rewards: [], premium: null }
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { txs: [], rewards: [], premium: null }
    const all = JSON.parse(raw) as Record<
      string,
      { txs: GhcTransaction[]; rewards: RewardRecord[]; premium: PremiumMembership | null }
    >
    return all[userId] || { txs: [], rewards: [], premium: null }
  } catch {
    return { txs: [], rewards: [], premium: null }
  }
}

function saveLocalBundle(
  userId: string,
  data: { txs: GhcTransaction[]; rewards: RewardRecord[]; premium: PremiumMembership | null }
) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = {
      txs: data.txs.slice(-500),
      rewards: data.rewards.slice(-300),
      premium: data.premium,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function createLocalEconomyRepository(): EconomyRepository {
  return {
    mode: "local" as const,
    listTransactions(userId) {
      return loadLocalBundle(userId).txs
    },
    appendTransaction(tx) {
      const b = loadLocalBundle(tx.userId)
      b.txs.push(tx)
      saveLocalBundle(tx.userId, b)
    },
    appendTransferPair(debit, credit) {
      const bDebit = loadLocalBundle(debit.userId)
      bDebit.txs.push(debit)
      saveLocalBundle(debit.userId, bDebit)
      const bCredit = loadLocalBundle(credit.userId)
      bCredit.txs.push(credit)
      saveLocalBundle(credit.userId, bCredit)
    },
    updateTransaction(userId, id, patch) {
      const b = loadLocalBundle(userId)
      const idx = b.txs.findIndex((x) => x.id === id)
      if (idx < 0) return
      b.txs[idx] = { ...b.txs[idx], ...patch, metadata: { ...(b.txs[idx].metadata || {}), ...(patch.metadata || {}) } }
      saveLocalBundle(userId, b)
    },
    listRewards(userId) {
      return loadLocalBundle(userId).rewards
    },
    appendReward(reward) {
      const b = loadLocalBundle(reward.userId)
      b.rewards.push(reward)
      saveLocalBundle(reward.userId, b)
    },
    updateReward(id, patch) {
      // scan users — prototype single-user local
      try {
        if (typeof localStorage === "undefined") return
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const all = JSON.parse(raw) as Record<string, any>
        for (const uid of Object.keys(all)) {
          const rewards = all[uid].rewards || []
          const idx = rewards.findIndex((r: RewardRecord) => r.id === id)
          if (idx >= 0) {
            rewards[idx] = { ...rewards[idx], ...patch }
            all[uid].rewards = rewards
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
            return
          }
        }
      } catch {
        /* */
      }
    },
    getPremium(userId) {
      return loadLocalBundle(userId).premium
    },
    setPremium(membership) {
      const b = loadLocalBundle(membership.userId)
      b.premium = membership
      saveLocalBundle(membership.userId, b)
    },
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEconomyDomain(deps: {
  currentUserId?: string
  repository?: EconomyRepository
  rules?: RewardRule[]
  limits?: EconomyLimits
  /** Optional social-graph / permission hooks — never invent a second block system */
  isBlockedEitherWay?: (otherUserId: string) => boolean
  isAccountRestricted?: () => boolean
  recipientExists?: (otherUserId: string) => boolean
}) {
  const userId = (deps.currentUserId || "").trim() || "current-user"
  const repo = deps.repository || createLocalEconomyRepository()
  const rules = deps.rules || DEFAULT_REWARD_RULES
  let limits = { ...DEFAULT_ECONOMY_LIMITS, ...(deps.limits || {}) }
  let antiAbusePolicy = { ...DEFAULT_ANTI_ABUSE_POLICY, limits }
  let earnEligibility: EarnEligibilityContext = {}

  // Anti-abuse: recent award timestamps per rule+target
  const recentAwards = new Map<string, number[]>()

  function wallet(): GhcWalletSnapshot {
    return computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
  }

  function dayKey(ts = Date.now()) {
    const d = new Date(ts)
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
  }

  function countEarnedToday(): number {
    const key = dayKey()
    return repo
      .listTransactions(userId)
      .filter(
        (t) =>
          t.status === "posted" &&
          t.kind === "earned" &&
          t.amount > 0 &&
          dayKey(t.createdAt) === key
      )
      .reduce((s, t) => s + t.amount, 0)
  }

  function countRuleToday(ruleId: string): number {
    const key = dayKey()
    return repo
      .listRewards(userId)
      .filter((r) => r.ruleId === ruleId && dayKey(r.createdAt) === key)
      .filter((r) => r.validationStatus !== "rejected")
      .length
  }

  function abuseKey(ruleId: string, targetId?: string) {
    return `${ruleId}:${targetId || "*"}`
  }

  function checkCooldown(rule: RewardRule, targetId?: string): string | null {
    const k = abuseKey(rule.id, targetId)
    const times = recentAwards.get(k) || []
    const last = times[times.length - 1]
    if (last && rule.antiAbuse.cooldownMs > 0 && Date.now() - last < rule.antiAbuse.cooldownMs) {
      return "Reward cooldown active"
    }
    if (rule.antiAbuse.maxPerTargetPerDay && targetId) {
      const key = dayKey()
      const count = times.filter((t) => dayKey(t) === key).length
      if (count >= rule.antiAbuse.maxPerTargetPerDay) {
        return "Daily limit for this target reached"
      }
    }
    return null
  }

  function markAward(ruleId: string, targetId?: string) {
    const k = abuseKey(ruleId, targetId)
    const times = recentAwards.get(k) || []
    times.push(Date.now())
    recentAwards.set(k, times.slice(-50))
  }

  function normalizeRequestStatus(raw: unknown): import("./economy-types").GhcTransferRequestStatus {
    const s = String(raw || "PENDING").toUpperCase()
    if (s === "PENDING" || s === "PENDING_REQUEST") return "PENDING"
    if (s === "ACCEPTED" || s === "COMPLETED") return "ACCEPTED"
    if (s === "DECLINED") return "DECLINED"
    if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED"
    if (s === "EXPIRED") return "EXPIRED"
    return "PENDING"
  }

  function countSentToday(): number {
    const key = dayKey()
    return repo
      .listTransactions(userId)
      .filter(
        (t) =>
          t.status === "posted" &&
          t.kind === "transfer_out" &&
          dayKey(t.createdAt) === key
      )
      .reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  function countReceivedTodayFor(uid: string): number {
    const key = dayKey()
    return repo
      .listTransactions(uid)
      .filter(
        (t) =>
          t.status === "posted" &&
          t.kind === "transfer_in" &&
          dayKey(t.createdAt) === key
      )
      .reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  function countRequestsCreatedToday(): number {
    const key = dayKey()
    return repo
      .listTransactions(userId)
      .filter((t) => t.kind === "transfer_request" && dayKey(t.createdAt) === key).length
  }

  function listRequestTxsForUser(uid: string) {
    return repo.listTransactions(uid).filter((t) => t.kind === "transfer_request")
  }

  function openOutgoingRequests(): import("./economy-types").GhcTransaction[] {
    return listRequestTxsForUser(userId).filter((t) => {
      const st = normalizeRequestStatus((t.metadata as any)?.transferStatus)
      return st === "PENDING"
    })
  }

  /** Validate shared P2P constraints. Returns error string or null. */
  function validatePeerParty(otherId: string, opts?: { requireExists?: boolean }): string | null {
    if (!userId || userId === "anonymous") return "Authentication required"
    if (deps.isAccountRestricted?.()) return "Account is restricted from transfers"
    const oid = (otherId || "").trim()
    if (!oid) return "Recipient required"
    if (oid === userId) return "Cannot transfer GHC with yourself"
    if (opts?.requireExists !== false && deps.recipientExists && !deps.recipientExists(oid)) {
      return "Recipient not found"
    }
    if (deps.isBlockedEitherWay?.(oid)) {
      return "Transfers are not allowed with this user"
    }
    return null
  }

  function validateTransferAmount(amount: number): string | null {
    if (!Number.isFinite(amount) || amount <= 0) return "Enter a valid amount greater than 0"
    if (amount < limits.minimumTransferAmount) {
      return `Minimum transfer is ${limits.minimumTransferAmount} GHC`
    }
    if (amount > limits.maximumTransferAmount) {
      return `Maximum transfer is ${limits.maximumTransferAmount} GHC`
    }
    return null
  }

  function findPostedByReference(uid: string, referenceId: string, kind: string) {
    return repo
      .listTransactions(uid)
      .find((t) => t.referenceId === referenceId && t.kind === kind && t.status === "posted")
  }

  return {
    /** Wallet view — never mix with Pi or other assets */
    getWallet(): GhcWalletSnapshot {
      return wallet()
    },

    getTransactions(limit = 50): GhcTransaction[] {
      return repo
        .listTransactions(userId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
    },

    getRewards(limit = 50): RewardRecord[] {
      return repo
        .listRewards(userId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
    },

    getPremium(): PremiumMembership {
      return (
        repo.getPremium(userId) || {
          userId,
          planId: null,
          active: false,
        }
      )
    },

    getRules(): RewardRule[] {
      return rules.filter((r) => r.enabled)
    },

    getLimits(): EconomyLimits {
      return { ...limits }
    },

    getAntiAbusePolicy(): EconomyAntiAbusePolicy {
      return { ...antiAbusePolicy, limits: { ...limits } }
    },

    /** Configure anti-abuse without rewriting engine */
    setAntiAbusePolicy(patch: Partial<EconomyAntiAbusePolicy>) {
      antiAbusePolicy = {
        ...antiAbusePolicy,
        ...patch,
        limits: patch.limits ? { ...limits, ...patch.limits } : antiAbusePolicy.limits,
      }
      if (patch.limits) limits = { ...limits, ...patch.limits }
    },

    setEarnEligibility(ctx: EarnEligibilityContext) {
      earnEligibility = { ...ctx }
    },

    /** Read-only integrity audit of this user's ledger */
    auditIntegrity() {
      return summarizeIntegrity(
        auditLedgerIntegrity(
          userId,
          repo.listTransactions(userId),
          repo.listRewards(userId)
        )
      )
    },

    /**
     * Core ledger write — every balance change goes through here.
     */
    async recordTransaction(input: {
      kind: GhcTransaction["kind"]
      amount: number
      reason: string
      sourceEvent: string
      referenceId?: string
      metadata?: Record<string, unknown>
      status?: GhcTransaction["status"]
      adjustedBy?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      return runMutation({
        name: "economy.recordTransaction",
        actorId: userId,
        input,
        validate: (i) => {
          if (!i.reason?.trim()) return "Reason required"
          if (!i.sourceEvent?.trim()) return "Source event required"
          if (!Number.isFinite(i.amount) || i.amount === 0) return "Invalid amount"
          // Idempotency — same reference must not double-post
          const dup = findDuplicateTransaction(
            repo.listTransactions(userId),
            {
              userId,
              sourceEvent: i.sourceEvent,
              referenceId: i.referenceId,
              kind: i.kind,
              amount: i.amount,
            },
            antiAbusePolicy.idempotencyWindowMs
          )
          if (dup) return "Duplicate transaction blocked (idempotency)"
          return null
        },
        authorize: (i) => {
          if (i.kind === "adjusted" && !i.adjustedBy) return "Admin adjustment requires adjustedBy"
          // Client cannot authorize free credits as "purchased" without payment ref + policy
          if (i.kind === "purchased") {
            if (!i.referenceId?.trim()) return "Purchase credit requires payment reference"
            if (antiAbusePolicy.requireServerAuthorityForPurchaseCredit) {
              const auth = (i.metadata as any)?.serverAuthority
              if (auth !== true && auth !== "server-authoritative") {
                return "GHC purchase credit requires server authority"
              }
            }
          }
          if (i.kind === "spent" || i.kind === "transfer_out" || (i.amount < 0 && i.status !== "pending")) {
            const rate = hitRateLimit(
              `spend:${userId}`,
              antiAbusePolicy.maxSpendPerMinute,
              60_000
            )
            if (!rate.ok) return rate.error
          }
          if (
            (i.kind === "spent" || i.kind === "transfer_out" || (i.amount < 0 && i.status !== "pending")) &&
            i.status !== "pending"
          ) {
            const w = wallet()
            if (!canPostDebit(w, i.amount, limits)) return "Insufficient GHC balance"
          }
          // Positive earned via recordTransaction direct path still needs eligibility
          if (i.kind === "earned" && i.amount > 0 && i.status === "posted") {
            const el = checkEarnEligibility(antiAbusePolicy, earnEligibility)
            if (!el.ok) return el.error
          }
          return null
        },
        mutate: (i) => {
          // Absolute rule: server mode must not invent ledger rows on the client.
          // Use spend() / claimReward / transfers / evaluateRewardServer instead.
          if (repo.mode === "server") {
            throw new Error(
              "Server-authoritative ledger: use spend(), claimReward(), or transfer APIs — not client recordTransaction"
            )
          }
          const built = createLedgerTransaction(
            {
              userId,
              kind: i.kind,
              amount: i.amount,
              reason: i.reason,
              sourceEvent: i.sourceEvent,
              referenceId: i.referenceId,
              metadata: i.metadata,
              status: i.status,
              adjustedBy: i.adjustedBy,
            },
            limits
          )
          if (!built.ok) throw new Error(built.error)
          repo.appendTransaction(built.tx)
          const w = computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
          domainEvents.publish(
            i.amount > 0 ? "WALLET_BALANCE_UPDATED" : "WALLET_TRANSFER_COMPLETED",
            { transferId: built.tx.id, amount: i.amount, status: built.tx.status },
            userId,
            built.tx.id
          )
          return { tx: built.tx, wallet: w }
        },
      })
    },

    async spend(input: {
      amount: number
      reason: string
      sourceEvent: string
      referenceId?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      const abs = Math.abs(Number(input.amount) || 0)
      if (!Number.isFinite(abs) || abs <= 0) {
        return { ok: false, error: "Invalid spend amount", phase: "validate", requestId: "local" }
      }
      const ref =
        (input.referenceId || "").trim() ||
        `spend_${input.sourceEvent || "GHC"}_${userId}_${Math.round(abs * 100)}_${Date.now()}`

      // SERVER-AUTHORITATIVE: never debit available balance on the client
      if (repo.mode === "server") {
        if (typeof repo.spendGhc !== "function") {
          return {
            ok: false,
            error: "Server spend unavailable — configure ledger API",
            phase: "mutate",
            requestId: "server",
          }
        }
        const remote = await repo.spendGhc({
          amount: abs,
          referenceId: ref,
          reason: input.reason,
          sourceEvent: input.sourceEvent,
          kind: "spent",
        })
        if (!remote.ok) {
          return {
            ok: false,
            error: remote.error || "Server spend failed",
            phase: "mutate",
            requestId: "server",
          }
        }
        if (typeof repo.hydrate === "function") {
          try {
            await repo.hydrate(userId)
          } catch {
            /* cache best-effort */
          }
        }
        if (remote.transaction) {
          repo.appendTransaction(remote.transaction)
        }
        const w = computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
        const tx =
          remote.transaction ||
          repo.listTransactions(userId).find((x) => x.referenceId === ref) ||
          ({
            id: ref,
            userId,
            kind: "spent" as const,
            amount: -abs,
            reason: input.reason,
            sourceEvent: input.sourceEvent,
            referenceId: ref,
            status: "posted" as const,
            createdAt: Date.now(),
          } satisfies GhcTransaction)
        try {
          domainEvents.publish(
            "WALLET_TRANSFER_COMPLETED",
            { transferId: tx.id, amount: -abs, status: "posted" },
            userId,
            tx.id
          )
        } catch {
          /* */
        }
        return { ok: true, data: { tx, wallet: w }, phase: "mutate", requestId: "server" }
      }

      // Local / Studio only
      return this.recordTransaction({
        kind: "spent",
        amount: -abs,
        reason: input.reason,
        sourceEvent: input.sourceEvent,
        referenceId: ref,
        status: "posted",
      })
    },

    /** Credit GHC after server-verified external payment (never from client alone) */
    async creditPurchase(input: {
      amount: number
      paymentRef: string
      reason?: string
      /** Must be true only from server-verified payment path */
      serverAuthority?: boolean
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      if (repo.mode === "server") {
        // Client must never invent purchase credits. Server payment completion
        // writes the ledger; client only hydrates.
        if (input.serverAuthority !== true) {
          return {
            ok: false,
            error: "GHC purchase credit requires server-verified payment authority",
            phase: "authorize",
            requestId: "server",
          }
        }
        if (typeof repo.hydrate === "function") {
          try {
            await repo.hydrate(userId)
          } catch {
            /* */
          }
        }
        const w = computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
        const existing = repo
          .listTransactions(userId)
          .find((x) => x.referenceId === input.paymentRef && x.kind === "purchased")
        if (existing) {
          return { ok: true, data: { tx: existing, wallet: w }, phase: "mutate", requestId: "server" }
        }
        return {
          ok: false,
          error: "Purchase not yet reflected on server ledger — complete Pi payment first",
          phase: "mutate",
          requestId: "server",
        }
      }
      return this.recordTransaction({
        kind: "purchased",
        amount: Math.abs(input.amount),
        reason: input.reason || "Verified payment top-up",
        sourceEvent: "GHC_PURCHASED",
        referenceId: input.paymentRef,
        status: "posted",
        metadata: {
          serverAuthority: input.serverAuthority === true ? "server-authoritative" : false,
        },
      })
    },

    async marketplaceSpend(input: {
      amount: number
      orderId: string
      reason?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      return this.spend({
        amount: input.amount,
        reason: input.reason || "Marketplace purchase",
        sourceEvent: "MARKETPLACE_SPEND",
        referenceId: input.orderId,
      })
    },

    /**
     * Real GHC sink: profile or post boost — available balance only.
     * Pending rewards cannot fund boosts.
     */
    async purchaseBoost(input: {
      target: "profile" | "post"
      targetId?: string
      /** Default 25 GHC */
      amount?: number
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      const amount = Math.abs(input.amount ?? 25)
      const wallet = computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
      if (wallet.balance < amount) {
        return {
          ok: false,
          error: wallet.pending > 0
            ? "Insufficient available GHC — claim pending rewards first"
            : "Insufficient available GHC",
          phase: "authorize",
          requestId: "local",
        }
      }
      const label = input.target === "profile" ? "Profile boost (24h)" : "Post boost (24h)"
      return this.spend({
        amount,
        reason: label,
        sourceEvent: input.target === "profile" ? "BOOST_PROFILE" : "BOOST_POST",
        referenceId: `boost_${input.target}_${input.targetId || userId}_${Date.now()}`,
      })
    },

    async reverse(
      transactionId: string,
      reason: string,
      adjustedBy = "system"
    ): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      return runMutation({
        name: "economy.reverse",
        actorId: userId,
        input: { transactionId, reason, adjustedBy },
        mutate: (i) => {
          const original = repo.listTransactions(userId).find((t) => t.id === i.transactionId)
          if (!original) throw new Error("Transaction not found")
          if (original.status !== "posted") throw new Error("Only posted transactions can be reversed")
          const rev = reverseTransaction(original, i.reason, i.adjustedBy)
          repo.appendTransaction(rev)
          // mark conceptually reversed via new tx; original remains for audit trail
          const w = computeWalletFromLedger(userId, repo.listTransactions(userId), limits)
          return { tx: rev, wallet: w }
        },
      })
    },

    /**
     * Reward engine entry — driven by verified platform events, not raw spam engagement.
     */
    async evaluateReward(input: {
      sourceEvent: string
      targetId?: string
      referenceId?: string
      metadata?: Record<string, unknown>
    }): Promise<
      MutationResult<{ rewards: RewardRecord[]; skipped?: string }>
    > {
      // Server mode: stage pending rewards only via evaluate API (never local ledger invent)
      if (repo.mode === "server" && typeof repo.evaluateRewardServer === "function") {
        const matched = rulesBySourceEvent(rules, input.sourceEvent)
        if (!matched.length) {
          return { ok: true, data: { rewards: [], skipped: "No rule for event" } }
        }
        const created: RewardRecord[] = []
        for (const rule of matched) {
          const ref =
            (input.referenceId || "").trim() ||
            `${rule.id}_${input.sourceEvent}_${userId}_${Date.now()}`
          const remote = await repo.evaluateRewardServer({
            amount: rule.amount,
            referenceId: ref,
            reason: rule.description,
            sourceEvent: rule.sourceEvent,
          })
          if (!remote.ok) continue
          if (remote.transaction) repo.appendTransaction(remote.transaction)
          const reward: RewardRecord = {
            id: remote.holdId || ref,
            userId,
            ruleId: rule.id,
            category: rule.category,
            sourceEvent: rule.sourceEvent,
            amount: rule.amount,
            validationStatus: "pending_validation",
            referenceId: ref,
            reason: rule.description,
            transactionId: remote.transaction?.id,
            createdAt: Date.now(),
          }
          repo.appendReward(reward)
          markAward(rule.id, input.targetId)
          created.push(reward)
        }
        if (typeof repo.hydrate === "function") {
          try {
            await repo.hydrate(userId)
          } catch {
            /* */
          }
        }
        return { ok: true, data: { rewards: created }, phase: "mutate", requestId: "server" }
      }

      return runMutation({
        name: "economy.evaluateReward",
        actorId: userId,
        input,
        mutate: (i) => {
          const rate = hitRateLimit(
            `rewardEval:${userId}`,
            antiAbusePolicy.maxRewardEvalsPerMinute,
            60_000
          )
          if (!rate.ok) return { rewards: [], skipped: rate.error }

          const elig = checkEarnEligibility(antiAbusePolicy, earnEligibility)
          if (!elig.ok) return { rewards: [], skipped: elig.error }

          const matched = rulesBySourceEvent(rules, i.sourceEvent)
          if (!matched.length) {
            return { rewards: [], skipped: "No rule for event" }
          }

          // Marketplace self-trade block
          if (
            antiAbusePolicy.blockMarketplaceSelfTrade &&
            i.sourceEvent === "MARKETPLACE_ORDER_COMPLETED" &&
            i.targetId === userId
          ) {
            return { rewards: [], skipped: "Self-trade reward blocked" }
          }

          const created: RewardRecord[] = []
          let earnedToday = countEarnedToday()

          for (const rule of matched) {
            if (rule.antiAbuse.blockSelf && i.targetId && i.targetId === userId) {
              continue
            }
            // Duplicate reward same reference
            const dupR = findDuplicateReward(repo.listRewards(userId), {
              ruleId: rule.id,
              referenceId: i.referenceId,
              sourceEvent: rule.sourceEvent,
            })
            if (dupR) continue
            // Achievement / same-rule same-day dedupe when reference is missing or noisy
            if (
              rule.category === "achievement" ||
              rule.sourceEvent === "ACHIEVEMENT_UNLOCKED"
            ) {
              const dayStart = new Date()
              dayStart.setHours(0, 0, 0, 0)
              const t0 = dayStart.getTime()
              const sameDay = repo.listRewards(userId).find(
                (r) =>
                  r.ruleId === rule.id &&
                  r.sourceEvent === rule.sourceEvent &&
                  r.createdAt >= t0 &&
                  r.validationStatus !== "rejected" &&
                  (i.referenceId
                    ? r.referenceId === i.referenceId
                    : r.reason === rule.description)
              )
              if (sameDay) continue
            }

            const cool = checkCooldown(rule, i.targetId)
            if (cool) continue
            if (countRuleToday(rule.id) >= rule.dailyLimit) continue
            if (earnedToday + rule.amount > limits.maxDailyEarn) continue

            // Referral daily cap
            if (
              rule.category === "referral" &&
              countRuleToday(rule.id) >= antiAbusePolicy.maxReferralCreditsPerDay
            ) {
              continue
            }

            // All awards stage as pending until claim — enforce pending inventory cap
            const pendingCount = repo
              .listRewards(userId)
              .filter((r) => r.validationStatus === "pending_validation").length
            if (pendingCount >= limits.maxPendingRewards) continue

            // Stage every positive reward as pending — not transferable until claimed
            const reward: RewardRecord = {
              id: genId("rwd"),
              userId,
              ruleId: rule.id,
              category: rule.category,
              sourceEvent: rule.sourceEvent,
              amount: rule.amount,
              validationStatus: "pending_validation",
              referenceId: i.referenceId,
              reason: rule.description,
              createdAt: Date.now(),
            }

            {
              const built = createLedgerTransaction({
                userId,
                kind: "pending",
                amount: rule.amount,
                reason: rule.description,
                sourceEvent: rule.sourceEvent,
                referenceId: reward.id,
                status: "pending",
                metadata: { claimable: true, ruleId: rule.id },
              })
              if (built.ok) {
                repo.appendTransaction(built.tx)
                reward.transactionId = built.tx.id
              }
            }

            repo.appendReward(reward)
            markAward(rule.id, i.targetId)
            created.push(reward)
          }

          return { rewards: created }
        },
      })
    },

    /**
     * Convert a pending reward into posted/available GHC.
     * Idempotent — already-paid rewards do not double-credit.
     * Pending GHC is never transferable until this path succeeds.
     */
    async _creditPendingReward(
      rewardId: string,
      actor: string
    ): Promise<MutationResult<{ reward: RewardRecord; wallet: GhcWalletSnapshot }>> {
      return runMutation({
        name: "economy.creditPendingReward",
        actorId: userId,
        input: { rewardId, actor },
        mutate: (i) => {
          const reward = repo.listRewards(userId).find((r) => r.id === i.rewardId)
          if (!reward) throw new Error("Reward not found")
          if (reward.userId !== userId) throw new Error("Not your reward")
          if (reward.validationStatus === "paid") {
            return {
              reward,
              wallet: computeWalletFromLedger(userId, repo.listTransactions(userId), limits),
            }
          }
          if (reward.validationStatus === "rejected" || reward.validationStatus === "blocked") {
            throw new Error("Reward cannot be claimed")
          }
          if (
            reward.validationStatus !== "pending_validation" &&
            reward.validationStatus !== "eligible" &&
            reward.validationStatus !== "approved"
          ) {
            throw new Error("Reward is not claimable")
          }

          const txs = repo.listTransactions(userId)
          const pendingTx = txs.find(
            (tx) =>
              tx.status === "pending" &&
              (tx.referenceId === reward.id || tx.id === reward.transactionId) &&
              tx.amount > 0
          )

          if (pendingTx && repo.updateTransaction) {
            repo.updateTransaction(userId, pendingTx.id, {
              status: "expired",
              metadata: {
                ...(pendingTx.metadata || {}),
                claimedAt: Date.now(),
                claimedBy: i.actor,
              },
            })
          }

          const alreadyPosted = txs.find(
            (tx) =>
              tx.status === "posted" &&
              tx.kind === "earned" &&
              tx.referenceId === reward.id &&
              tx.amount > 0
          )
          let postedId = alreadyPosted?.id
          if (!alreadyPosted) {
            const built = createLedgerTransaction({
              userId,
              kind: "earned",
              amount: reward.amount,
              reason: reward.reason,
              sourceEvent: reward.sourceEvent,
              referenceId: reward.id,
              status: "posted",
              metadata: { claimedBy: i.actor, fromPending: pendingTx?.id },
            })
            if (!built.ok) throw new Error(built.error)
            repo.appendTransaction(built.tx)
            postedId = built.tx.id
          }

          const next: RewardRecord = {
            ...reward,
            validationStatus: "paid",
            transactionId: postedId,
            resolvedAt: Date.now(),
          }
          repo.updateReward(reward.id, next)
          domainEvents.publish(
            "REWARD_EARNED",
            { rewardId: reward.id, kind: reward.category, points: reward.amount },
            userId,
            reward.id
          )
          return {
            reward: next,
            wallet: computeWalletFromLedger(userId, repo.listTransactions(userId), limits),
          }
        },
      })
    },

    /**
     * User claims pending GHC → available (transferable) balance.
     * Accepts a RewardRecord id, pending ledger tx id, or reward reference id.
     */
    async claimReward(
      holdOrRewardId: string
    ): Promise<MutationResult<{ reward: RewardRecord; wallet: GhcWalletSnapshot }>> {
      // Absolute rule: server mode never posts available balance client-side
      if (repo.mode === "server" && typeof repo.claimPendingReward === "function") {
        const remote = await repo.claimPendingReward(holdOrRewardId)
        if (!remote.ok) {
          return {
            ok: false,
            error: remote.error || "Server claim failed",
            phase: "mutate",
            requestId: "server",
          }
        }
        if (typeof repo.hydrate === "function") {
          try {
            await repo.hydrate(userId)
          } catch {
            /* cache best-effort */
          }
        }
        const wallet = computeWalletFromLedger(
          userId,
          repo.listTransactions(userId),
          limits
        )
        const rewards = repo.listRewards(userId)
        const reward =
          rewards.find((r) => r.id === holdOrRewardId) ||
          ({
            id: holdOrRewardId,
            userId,
            ruleId: "server_claim",
            category: "achievement",
            sourceEvent: "CLAIM",
            amount: remote.amount || 0,
            validationStatus: "paid" as const,
            createdAt: Date.now(),
          } satisfies RewardRecord)
        if (reward.validationStatus !== "paid") {
          repo.updateReward(reward.id, { validationStatus: "paid" })
        }
        return {
          ok: true,
          data: { reward: { ...reward, validationStatus: "paid" }, wallet },
          phase: "mutate",
          requestId: "server",
        }
      }

      const resolved = this._resolveClaimableRewardId(holdOrRewardId)
      if (!resolved) {
        return {
          ok: false,
          error: "Nothing claimable for this pending item",
          phase: "validate",
          requestId: "local",
        }
      }
      // Local mode only — Studio offline
      if (repo.mode === "server") {
        return {
          ok: false,
          error: "Server claim path unavailable — configure API or try again",
          phase: "mutate",
          requestId: "server",
        }
      }
      return this._creditPendingReward(resolved, userId)
    },

    /** Map wallet pending-hold id → reward id (creates a synthetic reward row if only a pending tx exists). */
    _resolveClaimableRewardId(holdOrRewardId: string): string | null {
      const rewards = repo.listRewards(userId)
      const byId = rewards.find((r) => r.id === holdOrRewardId)
      if (byId && byId.validationStatus !== "paid" && byId.validationStatus !== "rejected") {
        return byId.id
      }
      const byTx = rewards.find(
        (r) => r.transactionId === holdOrRewardId || r.referenceId === holdOrRewardId
      )
      if (byTx && byTx.validationStatus !== "paid" && byTx.validationStatus !== "rejected") {
        return byTx.id
      }

      const txs = repo.listTransactions(userId)
      const pendingTx = txs.find(
        (tx) =>
          tx.id === holdOrRewardId &&
          tx.status === "pending" &&
          tx.amount > 0
      )
      if (!pendingTx) {
        // referenceId match on pending
        const byRef = txs.find(
          (tx) =>
            tx.referenceId === holdOrRewardId &&
            tx.status === "pending" &&
            tx.amount > 0
        )
        if (!byRef) return null
        const existing = rewards.find((r) => r.id === byRef.referenceId || r.transactionId === byRef.id)
        if (existing) return existing.id
        // synthesize reward so claim path stays unified
        const synthetic: RewardRecord = {
          id: byRef.referenceId || byRef.id,
          userId,
          ruleId: "pending_hold",
          category: "achievement",
          sourceEvent: byRef.sourceEvent || "PENDING_HOLD",
          amount: byRef.amount,
          validationStatus: "pending_validation",
          transactionId: byRef.id,
          referenceId: byRef.referenceId,
          reason: byRef.reason || "Pending GHC",
          createdAt: byRef.createdAt,
        }
        repo.appendReward(synthetic)
        return synthetic.id
      }

      const existing = rewards.find(
        (r) => r.id === pendingTx.referenceId || r.transactionId === pendingTx.id
      )
      if (existing) return existing.id

      const synthetic: RewardRecord = {
        id: pendingTx.referenceId || pendingTx.id,
        userId,
        ruleId: "pending_hold",
        category: "achievement",
        sourceEvent: pendingTx.sourceEvent || "PENDING_HOLD",
        amount: pendingTx.amount,
        validationStatus: "pending_validation",
        transactionId: pendingTx.id,
        referenceId: pendingTx.referenceId,
        reason: pendingTx.reason || "Pending GHC",
        createdAt: pendingTx.createdAt,
      }
      // Avoid duplicate synthetic rows
      if (!rewards.some((r) => r.id === synthetic.id)) {
        repo.appendReward(synthetic)
      }
      return synthetic.id
    },

    /** System/admin path — same atomic credit rules as claim */
    async approveReward(
      rewardId: string,
      approvedBy = "system"
    ): Promise<MutationResult<{ reward: RewardRecord; wallet: GhcWalletSnapshot }>> {
      return this._creditPendingReward(rewardId, approvedBy)
    },

    async rejectReward(rewardId: string): Promise<MutationResult<{ rewardId: string }>> {
      return runMutation({
        name: "economy.rejectReward",
        actorId: userId,
        input: { rewardId },
        mutate: (i) => {
          const reward = repo.listRewards(userId).find((r) => r.id === i.rewardId)
          if (!reward) throw new Error("Reward not found")
          repo.updateReward(reward.id, {
            validationStatus: "rejected",
            resolvedAt: Date.now(),
          })
          return { rewardId: i.rewardId }
        },
      })
    },

    /** Premium purchase paid in GHC — spend is server-authoritative when repo.mode === "server" */
    async purchasePremium(
      planId: "monthly" | "yearly" | "lifetime",
      priceGhc: number
    ): Promise<MutationResult<{ membership: PremiumMembership; tx: GhcTransaction }>> {
      const price = Math.abs(Number(priceGhc) || 0)
      if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, error: "Invalid premium price", phase: "validate", requestId: "local" }
      }
      const spendRes = await this.spend({
        amount: price,
        reason: `Premium ${planId}`,
        sourceEvent: "PREMIUM_PURCHASE",
        referenceId: `premium_${planId}_${userId}`,
      })
      if (!spendRes.ok || !spendRes.data) {
        return {
          ok: false,
          error: spendRes.error || "Premium spend failed",
          phase: spendRes.phase || "mutate",
          requestId: spendRes.requestId || "local",
        }
      }
      const now = Date.now()
      const duration =
        planId === "monthly"
          ? 30 * 86400000
          : planId === "yearly"
            ? 365 * 86400000
            : 100 * 365 * 86400000
      const membership: PremiumMembership = {
        userId,
        planId,
        active: true,
        startedAt: now,
        expiresAt: planId === "lifetime" ? undefined : now + duration,
        lastPurchaseTxId: spendRes.data.tx.id,
      }
      repo.setPremium(membership)
      return {
        ok: true,
        data: { membership, tx: spendRes.data.tx },
        phase: "mutate",
        requestId: spendRes.requestId || "local",
      }
    }




    /**
     * Internal P2P: send GHC to another GreenHaven user.
     * Debits sender (transfer_out) and credits recipient (transfer_in) with the SAME referenceId.
     * Local Studio may write both legs via appendTransferPair; future server uses atomic POST /economy/transfers.
     * Never treats pending rewards as spendable.
     */
    async sendGhcToUser(input: {
      toUserId: string
      toUserName: string
      amount: number
      note?: string
      /** Stable idempotency key — retries with the same key do not double-post */
      referenceId?: string
      /** When fulfilling a request */
      requestId?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot; creditTxId?: string }>> {
      const amount = Math.abs(Number(input.amount))
      const partyErr = validatePeerParty(input.toUserId)
      if (partyErr) {
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: partyErr, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: partyErr }
      }
      const amtErr = validateTransferAmount(amount)
      if (amtErr) {
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: amtErr, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: amtErr }
      }

      const w = wallet()
      if (!canPostDebit(w, amount, limits)) {
        const err = "Insufficient available GHC (pending rewards are not transferable)"
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: err, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: err }
      }

      if (countSentToday() + amount > limits.dailySendLimit) {
        const err = `Daily send limit of ${limits.dailySendLimit} GHC reached`
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: err, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: err }
      }

      if (countReceivedTodayFor(input.toUserId) + amount > limits.dailyReceiveLimit) {
        const err = `Recipient daily receive limit of ${limits.dailyReceiveLimit} GHC reached`
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: err, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: err }
      }

      const ref =
        (input.referenceId || input.requestId || "").trim() ||
        `p2p_${userId}_${input.toUserId.trim()}_${amount}`

      // Idempotency: existing posted transfer_out with same reference for this user
      const existingOut = findPostedByReference(userId, ref, "transfer_out")
      if (existingOut) {
        return {
          ok: true,
          data: { tx: existingOut, wallet: wallet() },
        }
      }

      const note = (input.note || "").trim().slice(0, 120)

      // SERVER MODE: single intent POST — never local-fallback on failure
      if (repo.mode === "server" && typeof repo.executeTransfer === "function") {
        try {
          // After timeout, reconcile by reference before treating as failure to re-send
          if (typeof repo.findTransferByReference === "function") {
            const found = await repo.findTransferByReference(userId, ref)
            if (found?.debit) {
              if (!findPostedByReference(userId, ref, "transfer_out")) {
                repo.appendTransaction(found.debit)
                if (found.credit) repo.appendTransaction(found.credit)
              }
              return { ok: true, data: { tx: found.debit, wallet: wallet(), creditTxId: found.credit?.id } }
            }
          }
          const remote = await repo.executeTransfer({
            toUserId: input.toUserId.trim(),
            toUserName: input.toUserName,
            amount,
            note: note || undefined,
            referenceId: ref,
            requestId: input.requestId || ref,
          })
          if (!remote.ok) {
            try {
              domainEvents.publish(
                "WALLET_TRANSFER_FAILED",
                { reason: remote.error.message, code: remote.error.code, phase: "send" },
                userId,
                ref
              )
            } catch { /* */ }
            return { ok: false, error: remote.error.message }
          }
          // Merge authoritative legs into cache (no second money move)
          if (!findPostedByReference(userId, ref, "transfer_out")) {
            repo.appendTransaction(remote.debitTx)
          }
          if (remote.creditTx && !findPostedByReference(remote.creditTx.userId, ref, "transfer_in")) {
            repo.appendTransaction(remote.creditTx)
          }
          try {
            domainEvents.publish(
              "WALLET_TRANSFER_COMPLETED",
              {
                referenceId: ref,
                amount,
                fromUserId: userId,
                toUserId: input.toUserId.trim(),
                role: "sent",
                counterpartyName: input.toUserName,
                counterpartyId: input.toUserId.trim(),
                debitTxId: remote.debitTx.id,
                creditTxId: remote.creditTx.id,
                idempotent: remote.idempotent,
              },
              userId,
              ref
            )
            domainEvents.publish(
              "WALLET_BALANCE_UPDATED",
              { balance: wallet().balance, referenceId: ref },
              userId,
              ref
            )
          } catch { /* */ }
          return {
            ok: true,
            data: { tx: remote.debitTx, wallet: wallet(), creditTxId: remote.creditTx.id },
          }
        } catch (e) {
          const mapped = mapTransferFailure(e instanceof Error ? e.message : "SERVER_UNAVAILABLE", "SERVER_UNAVAILABLE")
          try {
            domainEvents.publish(
              "WALLET_TRANSFER_FAILED",
              { reason: mapped.message, code: mapped.code, phase: "send" },
              userId,
              ref
            )
          } catch { /* */ }
          // NO local fallback — would fork balances
          return { ok: false, error: mapped.message }
        }
      }

      // LOCAL / STUDIO MODE only below
      const debitBuilt = createLedgerTransaction(
        {
          userId,
          kind: "transfer_out",
          amount: -amount,
          reason: note
            ? `Sent to ${input.toUserName || input.toUserId}: ${note}`
            : `Sent to ${input.toUserName || input.toUserId}`,
          sourceEvent: "WALLET_TRANSFER",
          referenceId: ref,
          status: "posted",
          metadata: {
            counterpartyId: input.toUserId.trim(),
            counterpartyName: input.toUserName,
            direction: "send",
            transferStatus: "completed",
            note: note || undefined,
            requestId: input.requestId || ref,
          },
        },
        limits
      )
      if (!debitBuilt.ok) {
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: debitBuilt.error, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: debitBuilt.error }
      }

      const creditBuilt = createLedgerTransaction(
        {
          userId: input.toUserId.trim(),
          kind: "transfer_in",
          amount,
          reason: note
            ? `Received: ${note}`
            : `Received from GreenHaven member`,
          sourceEvent: "WALLET_TRANSFER",
          referenceId: ref,
          status: "posted",
          metadata: {
            counterpartyId: userId,
            counterpartyName: "Member",
            direction: "receive",
            transferStatus: "completed",
            note: note || undefined,
            requestId: input.requestId || ref,
          },
        },
        limits
      )
      if (!creditBuilt.ok) {
        // Do not post debit alone if credit leg cannot be built
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: creditBuilt.error, phase: "send" }, userId)
        } catch { /* */ }
        return { ok: false, error: creditBuilt.error }
      }

      try {
        domainEvents.publish(
          "WALLET_TRANSFER_CREATED",
          { referenceId: ref, amount, toUserId: input.toUserId.trim() },
          userId,
          ref
        )
      } catch { /* */ }

      try {
        if (typeof repo.appendTransferPair === "function") {
          repo.appendTransferPair(debitBuilt.tx, creditBuilt.tx)
        } else {
          repo.appendTransaction(debitBuilt.tx)
          repo.appendTransaction(creditBuilt.tx)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transfer persistence failed"
        try {
          domainEvents.publish("WALLET_TRANSFER_FAILED", { reason: msg, phase: "send" }, userId, ref)
        } catch { /* */ }
        return { ok: false, error: msg }
      }

      try {
        domainEvents.publish(
          "WALLET_TRANSFER_COMPLETED",
          {
            referenceId: ref,
            amount,
            fromUserId: userId,
            toUserId: input.toUserId.trim(),
                role: "sent",
                counterpartyName: input.toUserName,
                counterpartyId: input.toUserId.trim(),
            debitTxId: debitBuilt.tx.id,
            creditTxId: creditBuilt.tx.id,
          },
          userId,
          ref
        )
        domainEvents.publish(
          "WALLET_BALANCE_UPDATED",
          { balance: wallet().balance, referenceId: ref },
          userId,
          ref
        )
      } catch { /* */ }

      return {
        ok: true,
        data: {
          tx: debitBuilt.tx,
          wallet: wallet(),
          creditTxId: creditBuilt.tx.id,
        },
      }
    },

    /** Create a GHC payment request — never moves available balance */
    async requestGhcFromUser(input: {
      fromUserId: string
      fromUserName: string
      amount: number
      note?: string
      referenceId?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      const amount = Math.abs(Number(input.amount))
      const partyErr = validatePeerParty(input.fromUserId)
      if (partyErr) return { ok: false, error: partyErr }
      const amtErr = validateTransferAmount(amount)
      if (amtErr) return { ok: false, error: amtErr }

      if (countRequestsCreatedToday() >= limits.dailyRequestLimit) {
        return { ok: false, error: `Daily request limit of ${limits.dailyRequestLimit} reached` }
      }
      if (openOutgoingRequests().length >= limits.maximumOpenRequests) {
        return { ok: false, error: `Maximum open requests (${limits.maximumOpenRequests}) reached` }
      }

      const ref =
        (input.referenceId || "").trim() ||
        `req_${userId}_${input.fromUserId.trim()}_${amount}`

      const existing = repo
        .listTransactions(userId)
        .find((t) => t.referenceId === ref && t.kind === "transfer_request")
      if (existing) {
        return { ok: true, data: { tx: existing, wallet: wallet() } }
      }

      const note = (input.note || "").trim().slice(0, 120)
      const expiresAt = Date.now() + limits.requestExpiryMs
      const created = await this.recordTransaction({
        kind: "transfer_request",
        amount, // informational only — status pending so not in available
        reason: note
          ? `Request from ${input.fromUserName || input.fromUserId}: ${note}`
          : `Request ${amount} GHC from ${input.fromUserName || input.fromUserId}`,
        sourceEvent: "WALLET_TRANSFER_REQUEST",
        referenceId: ref,
        status: "pending",
        metadata: {
          counterpartyId: input.fromUserId.trim(),
          counterpartyName: input.fromUserName,
          direction: "request",
          transferStatus: "PENDING",
          note: note || undefined,
          requestId: ref,
          requesterId: userId,
          payerId: input.fromUserId.trim(),
          expiresAt,
        },
      })
      if (created.ok) {
        try {
          domainEvents.publish(
            "WALLET_TRANSFER_CREATED",
            {
              request: true,
              kind: "request",
              event: "GHC_REQUEST_CREATED",
              amount,
              referenceId: ref,
              message: `${input.fromUserName || "Someone"} — request pending`,
              counterpartyName: input.fromUserName,
              counterpartyId: input.fromUserId.trim(),
              targetUserId: input.fromUserId.trim(),
              role: "incoming_request",
              open: "requests",
            },
            userId,
            ref
          )
        } catch { /* */ }
      }
      return created
    },

    listOutgoingTransferRequests(): import("./economy-types").GhcTransferRequest[] {
      this.expireStaleTransferRequests()
      return openOutgoingRequests().map((t) => ({
        id: t.id,
        referenceId: t.referenceId || t.id,
        amount: Math.abs(t.amount),
        status: normalizeRequestStatus((t.metadata as any)?.transferStatus),
        requesterId: userId,
        payerId: String((t.metadata as any)?.payerId || (t.metadata as any)?.counterpartyId || ""),
        counterpartyName: String((t.metadata as any)?.counterpartyName || ""),
        note: (t.metadata as any)?.note,
        createdAt: t.createdAt,
        expiresAt: (t.metadata as any)?.expiresAt as number | undefined,
        direction: "outgoing" as const,
      }))
    },

    listIncomingTransferRequests(): import("./economy-types").GhcTransferRequest[] {
      this.expireStaleTransferRequests()
      // Prototype: scan all local bundles is not available; incoming are stored on requester.
      // Payer discovers requests where metadata.payerId === current user across listed txs for self
      // that were mirrored — for Studio, also scan requester side via repository list if multi-user.
      const incoming: import("./economy-types").GhcTransferRequest[] = []
      // Local multi-user: iterate is limited; use txs on current user with direction receive-request copy
      // When requester creates request only on their ledger, payer needs server. For local testing,
      // also accept requests found on current user where transferStatus PENDING and payerId === userId
      for (const t of listRequestTxsForUser(userId)) {
        const meta = (t.metadata || {}) as any
        if (String(meta.payerId || "") !== userId) continue
        if (normalizeRequestStatus(meta.transferStatus) !== "PENDING") continue
        incoming.push({
          id: t.id,
          referenceId: t.referenceId || t.id,
          amount: Math.abs(t.amount),
          status: "PENDING",
          requesterId: String(meta.requesterId || meta.counterpartyId || ""),
          payerId: userId,
          counterpartyName: String(meta.counterpartyName || "Requester"),
          note: meta.note,
          createdAt: t.createdAt,
          expiresAt: meta.expiresAt,
          direction: "incoming",
        })
      }
      return incoming
    },

    /** Mark PENDING requests past expiresAt as EXPIRED — no balance change */
    expireStaleTransferRequests(): number {
      let n = 0
      const now = Date.now()
      for (const t of listRequestTxsForUser(userId)) {
        const meta = (t.metadata || {}) as any
        if (normalizeRequestStatus(meta.transferStatus) !== "PENDING") continue
        const exp = Number(meta.expiresAt || 0)
        if (exp > 0 && exp < now) {
          if (typeof repo.updateTransaction === "function") {
            repo.updateTransaction(userId, t.id, {
              metadata: { ...meta, transferStatus: "EXPIRED" },
              status: "expired",
            })
            n++
          }
        }
      }
      return n
    },

    async declineGhcRequest(input: {
      referenceId: string
    }): Promise<MutationResult<{ referenceId: string }>> {
      const ref = (input.referenceId || "").trim()
      if (!ref) return { ok: false, error: "Request reference required" }
      const tx = listRequestTxsForUser(userId).find((t) => t.referenceId === ref || t.id === ref)
      // Also allow payer to decline if request sits on their ledger
      const target = tx || listRequestTxsForUser(userId).find((t) => (t.metadata as any)?.requestId === ref)
      if (!target) return { ok: false, error: "Request not found" }
      const st = normalizeRequestStatus((target.metadata as any)?.transferStatus)
      if (st === "ACCEPTED") return { ok: false, error: "Request already paid" }
      if (st === "DECLINED" || st === "CANCELLED" || st === "EXPIRED") {
        return { ok: true, data: { referenceId: ref } }
      }
      if (typeof repo.updateTransaction === "function") {
        repo.updateTransaction(userId, target.id, {
          metadata: { ...(target.metadata as any), transferStatus: "DECLINED" },
          status: "failed",
        })
      }
      try {
        domainEvents.publish(
          "WALLET_TRANSFER_CREATED",
          {
            request: true,
            event: "GHC_REQUEST_DECLINED",
            referenceId: ref,
            message: "Request declined",
            open: "requests",
            role: "declined",
          },
          userId,
          ref
        )
      } catch { /* */ }
      return { ok: true, data: { referenceId: ref } }
    },

    async cancelGhcRequest(input: {
      referenceId: string
    }): Promise<MutationResult<{ referenceId: string }>> {
      const ref = (input.referenceId || "").trim()
      if (!ref) return { ok: false, error: "Request reference required" }
      const target = listRequestTxsForUser(userId).find(
        (t) => t.referenceId === ref || t.id === ref || (t.metadata as any)?.requestId === ref
      )
      if (!target) return { ok: false, error: "Request not found" }
      const meta = (target.metadata || {}) as any
      if (String(meta.requesterId || userId) !== userId && meta.requesterId) {
        return { ok: false, error: "Only the requester can cancel" }
      }
      const st = normalizeRequestStatus(meta.transferStatus)
      if (st === "ACCEPTED") return { ok: false, error: "Request already paid" }
      if (st !== "PENDING") return { ok: true, data: { referenceId: ref } }
      if (typeof repo.updateTransaction === "function") {
        repo.updateTransaction(userId, target.id, {
          metadata: { ...meta, transferStatus: "CANCELLED" },
          status: "failed",
        })
      }
      try {
        domainEvents.publish(
          "WALLET_TRANSFER_CREATED",
          {
            request: true,
            event: "GHC_REQUEST_CANCELLED",
            referenceId: ref,
            message: "Request cancelled",
            open: "requests",
            role: "cancelled",
          },
          userId,
          ref
        )
      } catch { /* */ }
      return { ok: true, data: { referenceId: ref } }
    },

    /**
     * Accept/pay an open request — uses send pathway once; marks request ACCEPTED.
     * Duplicate fulfillment is blocked by reference idempotency.
     */
    async fulfillGhcRequest(input: {
      requestReferenceId: string
      toUserId: string
      toUserName: string
      amount: number
      note?: string
    }): Promise<MutationResult<{ tx: GhcTransaction; wallet: GhcWalletSnapshot }>> {
      const ref = (input.requestReferenceId || "").trim()
      if (!ref) return { ok: false, error: "Request reference required" }

      // Already paid?
      const prior = findPostedByReference(userId, ref, "transfer_out")
      if (prior) {
        return { ok: true, data: { tx: prior, wallet: wallet() } }
      }

      // Locate request on either ledger view
      let reqTx =
        listRequestTxsForUser(userId).find(
          (t) => t.referenceId === ref || (t.metadata as any)?.requestId === ref
        ) || null

      // If request lives on requester's bundle, try loading via list for toUserId
      if (!reqTx) {
        const their = repo.listTransactions(input.toUserId).find(
          (t) =>
            t.kind === "transfer_request" &&
            (t.referenceId === ref || (t.metadata as any)?.requestId === ref)
        )
        reqTx = their || null
      }

      if (reqTx) {
        const st = normalizeRequestStatus((reqTx.metadata as any)?.transferStatus)
        if (st === "ACCEPTED") {
          return { ok: false, error: "Request already accepted" }
        }
        if (st === "DECLINED" || st === "CANCELLED" || st === "EXPIRED") {
          return { ok: false, error: `Request is ${st.toLowerCase()}` }
        }
        const exp = Number((reqTx.metadata as any)?.expiresAt || 0)
        if (exp > 0 && exp < Date.now()) {
          if (typeof repo.updateTransaction === "function") {
            repo.updateTransaction(reqTx.userId, reqTx.id, {
              metadata: { ...(reqTx.metadata as any), transferStatus: "EXPIRED" },
              status: "expired",
            })
          }
          return { ok: false, error: "Request expired" }
        }
      }

      const amount = Math.abs(Number(input.amount || reqTx?.amount || 0))
      const sendRes = await this.sendGhcToUser({
        toUserId: input.toUserId,
        toUserName: input.toUserName,
        amount,
        note: input.note || `Payment for request ${ref}`,
        referenceId: ref,
        requestId: ref,
      })
      if (!sendRes.ok) return sendRes

      // Mark request ACCEPTED on requester ledger when present
      if (reqTx && typeof repo.updateTransaction === "function") {
        // Keep request row non-balance-affecting (still not a spendable credit)
        repo.updateTransaction(reqTx.userId, reqTx.id, {
          metadata: { ...(reqTx.metadata as any), transferStatus: "ACCEPTED" },
          // status remains non-posted for balance; transfer_request is ignored by ledger regardless
        })
      }
      return sendRes
    },

    /** UI-facing wallet interface model */
    getWalletInterface() {
      const w = wallet()
      const txs = this.getTransactions(100)
      const rewards = this.getRewards(50)
      const premium = this.getPremium()
      return {
        asset: "GHC" as const,
        label: "GreenHaven Coin",
        disclaimer: "In-app utility and reward credit — not an external investment asset",
        balance: w.balance,
        pending: w.pending,
        earned: w.lifetimeEarned,
        spent: w.lifetimeSpent,
        purchased: w.lifetimePurchased,
        transactions: txs,
        rewards,
        premium,
        marketplaceSpend: txs.filter(
          (t) => t.kind === "spent" && String(t.sourceEvent).includes("MARKETPLACE")
        ),
        premiumPurchases: txs.filter((t) => t.sourceEvent === "PREMIUM_PURCHASE"),
      }
    },

    getRewardsByCategory(category: RewardCategory): RewardRecord[] {
      return this.getRewards(200).filter((r) => r.category === category)
    },

    /**
     * Bridge domain events → reward engine (no per-screen reward logic).
     * Call once per session from GHCProvider.
     */
    startRewardEventBridge(): () => void {
      if (rewardBridgeUnsub) return rewardBridgeUnsub
      rewardBridgeUnsub = domainEvents.on("*", (event) => {
        try {
          // Skip pure system noise
          if (
            event.type === "WALLET_BALANCE_UPDATED" ||
            event.type === "REWARD_EARNED" ||
            event.type === "NOTIFICATION_CREATED"
          ) {
            return
          }
          const payload = (event.payload || {}) as Record<string, unknown>
          const achievementRef =
            payload.achievementId != null
              ? `achievement:${payload.achievementId}`
              : undefined
          void this.evaluateReward({
            sourceEvent: event.type,
            targetId: (payload.userId as string) || (payload.targetId as string),
            referenceId:
              achievementRef ||
              (payload.postId as string) ||
              (payload.messageId as string) ||
              (payload.referenceId as string) ||
              event.requestId,
            metadata: { actorId: event.actorId, ...payload },
          })
        } catch {
          /* never break publishers */
        }
      })
      return () => {
        rewardBridgeUnsub?.()
        rewardBridgeUnsub = null
      }
    },

    stopRewardEventBridge() {
      rewardBridgeUnsub?.()
      rewardBridgeUnsub = null
    },
  }
}

export type EconomyDomain = ReturnType<typeof createEconomyDomain>
