/**
 * Authoritative GHC store interface + in-memory implementation for tests.
 *
 * Production: Postgres/Supabase via ghc_execute_transfer RPC (see migrations).
 * This memory store mirrors atomicity / uniqueness / concurrency rules for unit tests.
 * It is NOT a client-side wallet and must only run on the server.
 */

import { randomUUID } from "crypto"
import type { GhcTransaction, GhcTransferRequest, EconomyLimits } from "@/lib/domains/economy-types"
import {
  notifyRequestAccepted,
  notifyRequestCancelled,
  notifyRequestCreated,
  notifyRequestDeclined,
  notifyRequestExpired,
  notifyTransferFailedEvent,
} from "./request-notifications"
import { getServerEconomyLimits } from "./limits"
import type { GhcTransferResult } from "@/lib/domains/economy-transfer-contract"
import { mapTransferFailure } from "@/lib/domains/economy-transfer-contract"

export type GhcLedgerRow = GhcTransaction

export interface GhcAuthoritativeStore {
  listTransactions(userId: string): GhcLedgerRow[]
  appendPosted(tx: GhcLedgerRow): void
  findByReference(
    referenceId: string
  ): { debit?: GhcLedgerRow; credit?: GhcLedgerRow }
  availableBalance(userId: string): number
  isBlockedEitherWay(a: string, b: string): boolean
  setBlock(blocker: string, blocked: string): void
  isRestricted(userId: string): boolean
  setRestricted(userId: string, restricted: boolean): void
  listRequests(userId: string, direction: "incoming" | "outgoing" | "all"): GhcTransferRequest[]
  getRequest(referenceId: string): GhcTransferRequest | null
  saveRequest(req: GhcTransferRequest): void
  listEvents(userId: string): Array<{ type: string; payload: unknown; referenceId?: string }>
  pushEvent(userId: string, type: string, payload: unknown, referenceId?: string): void
}

/** Per-process locks for concurrent send simulation */
const locks = new Map<string, Promise<void>>()

async function withUserLock<T>(userId: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = locks.get(userId) || Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((r) => {
    release = r
  })
  locks.set(
    userId,
    prev.then(() => gate)
  )
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (locks.get(userId) === gate) locks.delete(userId)
  }
}

export function createMemoryGhcStore(): GhcAuthoritativeStore {
  const txs: GhcLedgerRow[] = []
  const requests: GhcTransferRequest[] = []
  const blocks = new Set<string>()
  const restricted = new Set<string>()
  const events: Array<{ userId: string; type: string; payload: unknown; referenceId?: string }> = []

  const key = (a: string, b: string) => `${a}→${b}`

  return {
    listTransactions(userId) {
      return txs.filter((t) => t.userId === userId)
    },
    appendPosted(tx) {
      txs.push(tx)
    },
    findByReference(referenceId) {
      const debit = txs.find(
        (t) => t.referenceId === referenceId && t.kind === "transfer_out" && t.status === "posted"
      )
      const credit = txs.find(
        (t) => t.referenceId === referenceId && t.kind === "transfer_in" && t.status === "posted"
      )
      return { debit, credit }
    },
    availableBalance(userId) {
      return txs
        .filter(
          (t) =>
            t.userId === userId &&
            t.status === "posted" &&
            t.kind !== "transfer_request"
        )
        .reduce((s, t) => s + t.amount, 0)
    },
    isBlockedEitherWay(a, b) {
      return blocks.has(key(a, b)) || blocks.has(key(b, a))
    },
    setBlock(blocker, blocked) {
      blocks.add(key(blocker, blocked))
    },
    isRestricted(userId) {
      return restricted.has(userId)
    },
    setRestricted(userId, value) {
      if (value) restricted.add(userId)
      else restricted.delete(userId)
    },
    listRequests(userId, direction) {
      if (userId === "*") return requests.slice()
      return requests.filter((r) => {
        if (direction === "incoming") return r.payerId === userId
        if (direction === "outgoing") return r.requesterId === userId
        return r.payerId === userId || r.requesterId === userId
      })
    },
    getRequest(referenceId) {
      return requests.find((r) => r.referenceId === referenceId || r.id === referenceId) || null
    },
    saveRequest(req) {
      const i = requests.findIndex((r) => r.referenceId === req.referenceId)
      if (i >= 0) requests[i] = req
      else requests.push(req)
    },
    listEvents(userId) {
      return events.filter((e) => e.userId === userId).map(({ type, payload, referenceId }) => ({
        type,
        payload,
        referenceId,
      }))
    },
    pushEvent(userId, type, payload, referenceId) {
      events.push({ userId, type, payload, referenceId })
    },
  }
}

export async function executeAuthoritativeTransfer(
  store: GhcAuthoritativeStore,
  input: {
    senderId: string
    toUserId: string
    amount: number
    referenceId: string
    note?: string
    requestId?: string
    limits?: EconomyLimits
  }
): Promise<GhcTransferResult> {
  const limits = input.limits || getServerEconomyLimits()
  const amount = Math.abs(Number(input.amount))
  const ref = (input.referenceId || "").trim()
  const toUserId = (input.toUserId || "").trim()
  const senderId = (input.senderId || "").trim()

  if (!senderId) {
    return { ok: false, error: mapTransferFailure("auth", "AUTH_REQUIRED") }
  }
  if (!toUserId) {
    return { ok: false, error: mapTransferFailure("recipient", "INVALID_RECIPIENT") }
  }
  if (senderId === toUserId) {
    return { ok: false, error: mapTransferFailure("self", "SELF_TRANSFER") }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: mapTransferFailure("amount", "INVALID_AMOUNT") }
  }
  if (!ref) {
    return { ok: false, error: mapTransferFailure("reference required") }
  }
  if (amount < limits.minimumTransferAmount || amount > limits.maximumTransferAmount) {
    return { ok: false, error: mapTransferFailure("limit", "TRANSFER_LIMIT_EXCEEDED") }
  }

  return withUserLock(senderId, async () => {
    if (store.isRestricted(senderId)) {
      return { ok: false, error: mapTransferFailure("restricted", "ACCOUNT_RESTRICTED") }
    }
    if (store.isBlockedEitherWay(senderId, toUserId)) {
      return { ok: false, error: mapTransferFailure("block", "BLOCKED_USER") }
    }

    const existing = store.findByReference(ref)
    if (existing.debit) {
      return {
        ok: true,
        idempotent: true,
        referenceId: ref,
        debitTx: existing.debit,
        creditTx: existing.credit || existing.debit,
      }
    }

    const available = store.availableBalance(senderId)
    if (available < amount) {
      return { ok: false, error: mapTransferFailure("insufficient", "INSUFFICIENT_BALANCE") }
    }

    const dayStart = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    )
    const sentToday = store
      .listTransactions(senderId)
      .filter(
        (t) =>
          t.kind === "transfer_out" &&
          t.status === "posted" &&
          (t.createdAt || 0) >= dayStart
      )
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    if (sentToday + amount > limits.dailySendLimit) {
      return { ok: false, error: mapTransferFailure("daily send", "TRANSFER_LIMIT_EXCEEDED") }
    }
    const recvToday = store
      .listTransactions(toUserId)
      .filter(
        (t) =>
          t.kind === "transfer_in" &&
          t.status === "posted" &&
          (t.createdAt || 0) >= dayStart
      )
      .reduce((s, t) => s + t.amount, 0)
    if (recvToday + amount > limits.dailyReceiveLimit) {
      return { ok: false, error: mapTransferFailure("daily receive", "TRANSFER_LIMIT_EXCEEDED") }
    }

    const now = Date.now()
    const note = (input.note || "").trim().slice(0, 120)
    const debit: GhcLedgerRow = {
      id: randomUUID(),
      userId: senderId,
      kind: "transfer_out",
      amount: -amount,
      status: "posted",
      reason: note || "Sent GHC",
      sourceEvent: "WALLET_TRANSFER",
      referenceId: ref,
      createdAt: now,
      postedAt: now,
      metadata: {
        counterpartyId: toUserId,
        direction: "send",
        transferStatus: "completed",
        note: note || undefined,
        requestId: input.requestId || ref,
      },
    }
    const credit: GhcLedgerRow = {
      id: randomUUID(),
      userId: toUserId,
      kind: "transfer_in",
      amount,
      status: "posted",
      reason: note || "Received GHC",
      sourceEvent: "WALLET_TRANSFER",
      referenceId: ref,
      createdAt: now,
      postedAt: now,
      metadata: {
        counterpartyId: senderId,
        direction: "receive",
        transferStatus: "completed",
        note: note || undefined,
        requestId: input.requestId || ref,
      },
    }

    // Atomic: both or neither (memory: sequential append; DB uses single transaction)
    store.appendPosted(debit)
    store.appendPosted(credit)

    // Events only on first successful write (not on idempotent retry)
    store.pushEvent(
      senderId,
      "GHC_SENT",
      { amount, toUserId, referenceId: ref },
      ref
    )
    store.pushEvent(
      toUserId,
      "GHC_RECEIVED",
      { amount, fromUserId: senderId, referenceId: ref },
      ref
    )

    return {
      ok: true,
      idempotent: false,
      referenceId: ref,
      debitTx: debit,
      creditTx: credit,
    }
  })
}

export async function createTransferRequest(
  store: GhcAuthoritativeStore,
  input: {
    requesterId: string
    payerId: string
    amount: number
    referenceId: string
    note?: string
    limits?: EconomyLimits
  }
): Promise<{ ok: true; request: GhcTransferRequest } | { ok: false; error: string; code: string }> {
  const limits = input.limits || getServerEconomyLimits()
  const amount = Math.abs(Number(input.amount))
  if (!input.requesterId) return { ok: false, error: "Authentication required", code: "AUTH_REQUIRED" }
  if (input.requesterId === input.payerId) {
    return { ok: false, error: "Cannot request from yourself", code: "SELF_TRANSFER" }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount", code: "INVALID_AMOUNT" }
  }
  if (amount < limits.minimumTransferAmount || amount > limits.maximumTransferAmount) {
    return { ok: false, error: "Amount outside limits", code: "TRANSFER_LIMIT_EXCEEDED" }
  }
  if (store.isBlockedEitherWay(input.requesterId, input.payerId)) {
    return { ok: false, error: "Not allowed", code: "BLOCKED_USER" }
  }
  const existing = store.getRequest(input.referenceId)
  if (existing) return { ok: true, request: existing }

  const open = store.listRequests(input.requesterId, "outgoing").filter((r) => r.status === "PENDING")
  if (open.length >= limits.maximumOpenRequests) {
    return { ok: false, error: "Too many open requests", code: "REQUEST_LIMIT_EXCEEDED" }
  }

  const now = Date.now()
  const req: GhcTransferRequest = {
    id: randomUUID(),
    referenceId: input.referenceId,
    amount,
    status: "PENDING",
    requesterId: input.requesterId,
    payerId: input.payerId,
    counterpartyName: "",
    note: input.note,
    createdAt: now,
    expiresAt: now + limits.requestExpiryMs,
    direction: "outgoing",
  }
  store.saveRequest(req)
  store.pushEvent(
    input.payerId,
    "GHC_REQUEST_RECEIVED",
    { amount, fromUserId: input.requesterId, referenceId: req.referenceId },
    req.referenceId
  )
  try {
    await notifyRequestCreated({
      requesterId: input.requesterId,
      payerId: input.payerId,
      amount,
      referenceId: req.referenceId,
      note: input.note,
    })
  } catch { /* non-blocking */ }
  return { ok: true, request: req }
}

export async function acceptTransferRequest(
  store: GhcAuthoritativeStore,
  input: { actorId: string; referenceId: string }
): Promise<GhcTransferResult | { ok: false; error: { code: string; message: string } }> {
  const req = store.getRequest(input.referenceId)
  if (!req) {
    return { ok: false, error: mapTransferFailure("not found", "REQUEST_NOT_FOUND") }
  }
  if (req.payerId !== input.actorId) {
    return { ok: false, error: mapTransferFailure("auth", "AUTH_REQUIRED") }
  }
  if (req.status === "ACCEPTED") {
    const found = store.findByReference(req.referenceId)
    if (found.debit && found.credit) {
      return {
        ok: true,
        idempotent: true,
        referenceId: req.referenceId,
        debitTx: found.debit,
        creditTx: found.credit,
      }
    }
  }
  if (req.status !== "PENDING") {
    return { ok: false, error: mapTransferFailure("closed", "REQUEST_CLOSED") }
  }
  if (req.expiresAt && req.expiresAt < Date.now()) {
    store.saveRequest({ ...req, status: "EXPIRED" })
    store.pushEvent(req.requesterId, "GHC_REQUEST_EXPIRED", { referenceId: req.referenceId }, req.referenceId)
    return { ok: false, error: mapTransferFailure("expired", "REQUEST_CLOSED") }
  }

  const transfer = await executeAuthoritativeTransfer(store, {
    senderId: input.actorId,
    toUserId: req.requesterId,
    amount: req.amount,
    referenceId: req.referenceId,
    note: req.note,
    requestId: req.referenceId,
  })
  if (!transfer.ok) {
    store.pushEvent(
      input.actorId,
      "GHC_TRANSFER_FAILED",
      { referenceId: req.referenceId, code: transfer.error.code },
      req.referenceId
    )
    try {
      await notifyTransferFailedEvent({
        userId: input.actorId,
        referenceId: req.referenceId,
        reason: transfer.error.message,
        code: transfer.error.code,
      })
    } catch { /* */ }
    return transfer
  }
  store.saveRequest({ ...req, status: "ACCEPTED" })
  store.pushEvent(
    req.requesterId,
    "GHC_REQUEST_ACCEPTED",
    { referenceId: req.referenceId, amount: req.amount },
    req.referenceId
  )
  try {
    await notifyRequestAccepted({
      requesterId: req.requesterId,
      payerId: req.payerId,
      amount: req.amount,
      referenceId: req.referenceId,
    })
  } catch { /* */ }
  return transfer
}

export async function declineTransferRequest(
  store: GhcAuthoritativeStore,
  input: { actorId: string; referenceId: string }
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const req = store.getRequest(input.referenceId)
  if (!req) return { ok: false, error: "Request not found", code: "REQUEST_NOT_FOUND" }
  if (req.payerId !== input.actorId) return { ok: false, error: "Not allowed", code: "AUTH_REQUIRED" }
  if (req.status !== "PENDING") return { ok: true }
  store.saveRequest({ ...req, status: "DECLINED" })
  store.pushEvent(
    req.requesterId,
    "GHC_REQUEST_DECLINED",
    { referenceId: req.referenceId },
    req.referenceId
  )
  try {
    await notifyRequestDeclined({
      requesterId: req.requesterId,
      payerId: req.payerId,
      amount: req.amount,
      referenceId: req.referenceId,
    })
  } catch { /* */ }
  return { ok: true }
}

export async function cancelTransferRequest(
  store: GhcAuthoritativeStore,
  input: { actorId: string; referenceId: string }
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const req = store.getRequest(input.referenceId)
  if (!req) return { ok: false, error: "Request not found", code: "REQUEST_NOT_FOUND" }
  if (req.requesterId !== input.actorId) return { ok: false, error: "Not allowed", code: "AUTH_REQUIRED" }
  if (req.status === "ACCEPTED") return { ok: false, error: "Already paid", code: "REQUEST_CLOSED" }
  if (req.status !== "PENDING") return { ok: true }
  store.saveRequest({ ...req, status: "CANCELLED" })
  try {
    await notifyRequestCancelled({
      requesterId: req.requesterId,
      payerId: req.payerId,
      amount: req.amount,
      referenceId: req.referenceId,
    })
  } catch { /* */ }
  return { ok: true }
}

/** Process-local store for Studio API when DATABASE is not configured — tests only */
let singletonStore: GhcAuthoritativeStore | null = null

export function getProcessGhcStore(): GhcAuthoritativeStore {
  if (!singletonStore) singletonStore = createMemoryGhcStore()
  return singletonStore
}

/** Alias used by reward-engine and payment fulfillment */
export function getGhcAuthoritativeStore(): GhcAuthoritativeStore {
  return getProcessGhcStore()
}

export function resetProcessGhcStoreForTests() {
  singletonStore = createMemoryGhcStore()
}


/** Expire PENDING requests past expiresAt; emit notifications once per request */
export async function expirePendingRequests(
  store: GhcAuthoritativeStore
): Promise<number> {
  let n = 0
  const all = store.listRequests("*", "all")
  const now = Date.now()
  for (const req of all) {
    if (req.status !== "PENDING") continue
    if (!req.expiresAt || req.expiresAt > now) continue
    store.saveRequest({ ...req, status: "EXPIRED" })
    try {
      await notifyRequestExpired({
        requesterId: req.requesterId,
        payerId: req.payerId,
        amount: req.amount,
        referenceId: req.referenceId,
      })
    } catch { /* */ }
    n++
  }
  return n
}


/** Authoritative credit (reward claim, promo, admin) — posted positive amount */
export async function executeAuthoritativeCredit(
  store: GhcAuthoritativeStore,
  input: {
    userId: string
    amount: number
    referenceId: string
    reason: string
    sourceEvent?: string
    kind?: GhcLedgerRow["kind"]
  }
): Promise<{ ok: true; tx: GhcLedgerRow; idempotent?: boolean } | { ok: false; error: string }> {
  const amount = Math.abs(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
  const ref = String(input.referenceId || "").trim()
  if (!ref) return { ok: false, error: "REFERENCE_REQUIRED" }

  return withUserLock(input.userId, () => {
    const existing = store.listTransactions(input.userId).find(
      (t) => t.referenceId === ref && t.status === "posted" && t.amount > 0
    )
    if (existing) return { ok: true as const, tx: existing, idempotent: true }

    const tx: GhcLedgerRow = {
      id: `tx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId: input.userId,
      kind: input.kind || "earned",
      amount,
      status: "posted",
      reason: input.reason,
      sourceEvent: input.sourceEvent || "SYSTEM",
      referenceId: ref,
      createdAt: Date.now(),
    }
    store.appendPosted(tx)
    return { ok: true as const, tx }
  })
}

/** Stage pending hold (not transferable until claim) */
export async function executeAuthoritativePending(
  store: GhcAuthoritativeStore,
  input: {
    userId: string
    amount: number
    referenceId: string
    reason: string
    sourceEvent?: string
  }
): Promise<{ ok: true; tx: GhcLedgerRow; idempotent?: boolean } | { ok: false; error: string }> {
  const amount = Math.abs(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
  const ref = String(input.referenceId || "").trim()
  if (!ref) return { ok: false, error: "REFERENCE_REQUIRED" }

  return withUserLock(input.userId, () => {
    const existing = store.listTransactions(input.userId).find(
      (t) => t.referenceId === ref && (t.status === "pending" || t.status === "posted")
    )
    if (existing) return { ok: true as const, tx: existing, idempotent: true }

    const tx: GhcLedgerRow = {
      id: `tx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId: input.userId,
      kind: "pending",
      amount,
      status: "pending",
      reason: input.reason,
      sourceEvent: input.sourceEvent || "SYSTEM",
      referenceId: ref,
      createdAt: Date.now(),
    }
    store.appendPosted(tx)
    return { ok: true as const, tx }
  })
}

/** Claim pending → posted available (zero out pending, post reward) */
export async function executeAuthoritativeClaimPending(
  store: GhcAuthoritativeStore,
  input: { userId: string; holdId: string }
): Promise<
  | { ok: true; tx: GhcLedgerRow; amount: number; alreadyClaimed?: boolean }
  | { ok: false; error: string }
> {
  return withUserLock(input.userId, () => {
    const txs = store.listTransactions(input.userId)
    const pending = txs.find(
      (t) =>
        (t.id === input.holdId || t.referenceId === input.holdId) &&
        t.status === "pending" &&
        t.amount > 0
    )
    if (!pending) {
      const already = txs.find(
        (t) =>
          (t.id === input.holdId || t.referenceId === input.holdId) &&
          t.status === "posted" &&
          t.amount > 0
      )
      if (already) return { ok: true as const, tx: already, amount: already.amount, alreadyClaimed: true }
      return { ok: false, error: "NOT_CLAIMABLE" }
    }

    // Mark original pending as cancelled via zeroing post pattern — append claim credit
    const claimRef = `claim:${pending.referenceId || pending.id}`
    const existingClaim = txs.find((t) => t.referenceId === claimRef && t.status === "posted")
    if (existingClaim) {
      return { ok: true as const, tx: existingClaim, amount: existingClaim.amount, alreadyClaimed: true }
    }

    // Append negative pending clear + positive available (net: available increases)
    const clear: GhcLedgerRow = {
      id: `tx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId: input.userId,
      kind: "pending",
      amount: -Math.abs(pending.amount),
      status: "posted",
      reason: "Claim clear",
      referenceId: claimRef + ":clear",
      createdAt: Date.now(),
      metadata: { clearedHoldId: pending.id },
    }
    const credit: GhcLedgerRow = {
      id: `tx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId: input.userId,
      kind: "earned",
      amount: Math.abs(pending.amount),
      status: "posted",
      reason: pending.reason || "Claimed reward",
      sourceEvent: pending.sourceEvent,
      referenceId: claimRef,
      createdAt: Date.now(),
      metadata: { claimedFrom: pending.id },
    }
    store.appendPosted(clear)
    store.appendPosted(credit)
    return { ok: true as const, tx: credit, amount: credit.amount }
  })
}

/** Authoritative spend (membership, marketplace, boost) */
export async function executeAuthoritativeSpend(
  store: GhcAuthoritativeStore,
  input: {
    userId: string
    amount: number
    referenceId: string
    reason: string
    sourceEvent?: string
    kind?: GhcLedgerRow["kind"]
  }
): Promise<{ ok: true; tx: GhcLedgerRow; idempotent?: boolean } | { ok: false; error: string }> {
  const amount = Math.abs(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
  const ref = String(input.referenceId || "").trim()
  if (!ref) return { ok: false, error: "REFERENCE_REQUIRED" }

  return withUserLock(input.userId, () => {
    const existing = store.listTransactions(input.userId).find(
      (t) => t.referenceId === ref && t.status === "posted" && t.amount < 0
    )
    if (existing) return { ok: true as const, tx: existing, idempotent: true }

    const available = store.availableBalance(input.userId)
    if (available < amount) return { ok: false, error: "INSUFFICIENT_BALANCE" }

    const tx: GhcLedgerRow = {
      id: `tx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId: input.userId,
      kind: input.kind || "spent",
      amount: -amount,
      status: "posted",
      reason: input.reason,
      sourceEvent: input.sourceEvent || "SYSTEM",
      referenceId: ref,
      createdAt: Date.now(),
    }
    store.appendPosted(tx)
    return { ok: true as const, tx }
  })
}

