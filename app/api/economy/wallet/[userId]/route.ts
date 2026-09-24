import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { requireSameUser } from "@/lib/server/foundation/authorization"
import { getRequestContext } from "@/lib/server/foundation/request-context"
import { getProcessGhcStore } from "@/lib/server/economy/store"
import {
  rpcListTransactions,
  rpcWalletSnapshot,
  rpcListTransferRequests,
} from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { computeWalletFromLedger } from "@/lib/domains/economy-ledger"
import { getServerEconomyLimits } from "@/lib/server/economy/limits"
import type {
  GhcTransferRequest,
  GhcTransferRequestStatus,
} from "@/lib/domains/economy-types"

const TRANSFER_STATUSES = new Set<GhcTransferRequestStatus>([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
])

/** Normalize durable REST rows or domain objects into GhcTransferRequest. */
function normalizeTransferRequests(
  rows: GhcTransferRequest[] | Array<Record<string, unknown>> | null | undefined,
  userId: string
): GhcTransferRequest[] {
  if (!Array.isArray(rows)) return []
  return rows.map((raw) => {
    // Already domain-shaped (memory store)
    if (
      raw &&
      typeof raw === "object" &&
      "referenceId" in raw &&
      "requesterId" in raw &&
      "payerId" in raw &&
      "direction" in raw
    ) {
      return raw as GhcTransferRequest
    }
    const row = raw as Record<string, unknown>
    const requesterId = String(row.requester_id ?? row.requesterId ?? "")
    const payerId = String(row.payer_id ?? row.payerId ?? "")
    const statusRaw = String(row.status ?? "PENDING").toUpperCase()
    const status = (
      TRANSFER_STATUSES.has(statusRaw as GhcTransferRequestStatus)
        ? statusRaw
        : "PENDING"
    ) as GhcTransferRequestStatus
    const createdRaw = row.created_at ?? row.createdAt ?? Date.now()
    const createdAt =
      typeof createdRaw === "string"
        ? Date.parse(createdRaw) || Date.now()
        : Number(createdRaw) || Date.now()
    const expiresRaw = row.expires_at ?? row.expiresAt
    let expiresAt: number | undefined
    if (expiresRaw != null) {
      expiresAt =
        typeof expiresRaw === "string"
          ? Date.parse(String(expiresRaw)) || undefined
          : Number(expiresRaw) || undefined
    }
    return {
      id: String(row.id ?? row.reference_id ?? row.referenceId ?? ""),
      referenceId: String(row.reference_id ?? row.referenceId ?? row.id ?? ""),
      amount: Number(row.amount ?? 0),
      status,
      requesterId,
      payerId,
      counterpartyName: String(
        row.counterparty_name ?? row.counterpartyName ?? ""
      ),
      note: row.note != null ? String(row.note) : undefined,
      createdAt,
      expiresAt,
      direction: payerId === userId ? "incoming" : "outgoing",
    }
  })
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const reqCtx = getRequestContext(request.headers)
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth)
    return jsonErr("AUTH_REQUIRED", "Authentication required", 401, {
      requestId: reqCtx.requestId,
    })

  const { userId } = await ctx.params
  const owner = requireSameUser(auth, userId)
  if (!owner.ok) return owner.response

  let transactions = [] as ReturnType<typeof getProcessGhcStore> extends never
    ? never
    : ReturnType<ReturnType<typeof getProcessGhcStore>["listTransactions"]>

  let transferRequests: GhcTransferRequest[] = []

  if (isDatabaseConfigured()) {
    const rows = await rpcListTransactions(userId)
    if (!rows) {
      return jsonErr("SERVER_UNAVAILABLE", "Failed to load wallet ledger", 503)
    }
    transactions = rows
    const reqs = await rpcListTransferRequests(userId, "all")
    transferRequests = normalizeTransferRequests(reqs, userId)
  } else if (allowMemoryServer()) {
    transactions = getProcessGhcStore().listTransactions(userId)
    transferRequests = getProcessGhcStore().listRequests(userId, "all")
  } else {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const limits = getServerEconomyLimits()
  // Prefer full-ledger RPC snapshot; fall back to compute from returned rows
  let snapshot = computeWalletFromLedger(userId, transactions, limits)
  if (isDatabaseConfigured()) {
    const full = await rpcWalletSnapshot(userId)
    if (full) {
      snapshot = {
        userId: full.userId,
        balance: full.balance,
        pending: full.pending,
        lifetimeEarned: full.lifetimeEarned,
        lifetimeSpent: full.lifetimeSpent,
        lifetimePurchased: full.lifetimePurchased,
        updatedAt: full.updatedAt,
      }
    }
  }

  return jsonOk({
    transactions,
    rewards: [],
    premium: null,
    transferRequests,
    updatedAt: snapshot.updatedAt || Date.now(),
    snapshot,
    balance: snapshot.balance,
  })
}
