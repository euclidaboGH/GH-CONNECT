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
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
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


const HISTORY_CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const HISTORY_CURSOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function decodeHistoryCursor(value: string | null, userId: string): { createdAt: string; id: string } | null | false {
  if (!value) return null
  if (value.length > 512) return false
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : ""
    const id = typeof parsed.id === "string" ? parsed.id : ""
    if (parsed.userId !== userId || !HISTORY_CURSOR_TIMESTAMP.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || !HISTORY_CURSOR_UUID.test(id)) return false
    return { createdAt, id }
  } catch {
    return false
  }
}

/** Normalize durable REST rows or domain objects into GhcTransferRequest. */
function normalizeTransferRequests(
  rows: GhcTransferRequest[] | Array<Record<string, unknown>> | null | undefined,
  userId: string
): GhcTransferRequest[] {
  if (!Array.isArray(rows)) return []
  return rows.map((raw) => {
    // Normalize both durable and memory rows through one validation path.
    // A malformed row must not be trusted merely because it resembles a domain object.
    const row = raw as Record<string, unknown>
    const requesterId = String(row.requester_id ?? row.requesterId ?? "")
    const payerId = String(row.payer_id ?? row.payerId ?? "")
    const statusRaw = String(row.status ?? "").toUpperCase()
    const status = statusRaw as GhcTransferRequestStatus
    const createdRaw = row.created_at ?? row.createdAt ?? Date.now()
    const createdAt =
      typeof createdRaw === "string"
        ? Date.parse(createdRaw)
        : Number(createdRaw)
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
  }).filter((item) =>
    Boolean(item.id && item.referenceId && item.requesterId && item.payerId) &&
    TRANSFER_STATUSES.has(item.status) &&
    Number.isFinite(item.amount) && item.amount > 0 &&
    Number.isFinite(item.createdAt) && item.createdAt > 0
  )
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

  const rateLimit = await checkDurableRateLimit(`wallet-history:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rateLimit.ok) {
    return jsonErr(durableRateLimitCode(rateLimit), "Wallet history is temporarily rate limited", durableRateLimitStatus(rateLimit), {
      requestId: reqCtx.requestId,
    })
  }

  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get("limit") || 100)
  const limitTx = Math.min(Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 100, 1), 200)
  const before = decodeHistoryCursor(url.searchParams.get("cursor"), userId)
  if (before === false) return jsonErr("INVALID_CURSOR", "History cursor is invalid or belongs to another account", 400)
  const fromRaw = url.searchParams.get("from"), toRaw = url.searchParams.get("to")
  const validDate = (value: string | null) => {
    if (value == null) return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (!validDate(fromRaw) || !validDate(toRaw) || (fromRaw && toRaw && fromRaw > toRaw)) return jsonErr("INVALID_DATE_RANGE", "History date range is invalid", 400)
  const statusRaw = url.searchParams.get("status")
  const kindRaw = url.searchParams.get("kind")
  const queryRaw = (url.searchParams.get("q") || "").normalize("NFKC").trim().slice(0, 160)
  const allowedStatuses = ["pending", "posted", "failed", "reversed", "expired"]
  const allowedKinds = ["earned", "spent", "purchased", "pending", "reversed", "expired", "adjusted", "transfer_out", "transfer_in", "transfer_request"]
  if (statusRaw && !allowedStatuses.includes(statusRaw)) return jsonErr("INVALID_STATUS_FILTER", "History status filter is invalid", 400)
  if (kindRaw && !allowedKinds.includes(kindRaw)) return jsonErr("INVALID_KIND_FILTER", "History kind filter is invalid", 400)

  let transactions = [] as ReturnType<typeof getProcessGhcStore> extends never
    ? never
    : ReturnType<ReturnType<typeof getProcessGhcStore>["listTransactions"]>

  let transferRequests: GhcTransferRequest[] = []

  if (isDatabaseConfigured()) {
    const rows = await rpcListTransactions(userId, undefined, { limit: limitTx + 1, before: before || undefined, from: fromRaw || undefined, to: toRaw || undefined, status: statusRaw ? statusRaw as "pending" | "posted" | "failed" | "reversed" | "expired" : undefined, kind: kindRaw ? kindRaw as "earned" | "spent" | "purchased" | "pending" | "reversed" | "expired" | "adjusted" | "transfer_out" | "transfer_in" | "transfer_request" : undefined, q: queryRaw || undefined })
    if (!rows) {
      return jsonErr("SERVER_UNAVAILABLE", "Failed to load wallet ledger", 503)
    }
    transactions = rows
    const reqs = await rpcListTransferRequests(userId, "all")
    if (!reqs) {
      return jsonErr("SERVER_UNAVAILABLE", "Failed to load transfer requests", 503, {
        requestId: reqCtx.requestId,
      })
    }
    transferRequests = normalizeTransferRequests(reqs, userId)
  } else if (allowMemoryServer()) {
    transactions = getProcessGhcStore().listTransactions(userId).filter((row) => {
      const fromMs = fromRaw ? Date.parse(`${fromRaw}T00:00:00.000Z`) : null
      const toMs = toRaw ? Date.parse(`${toRaw}T23:59:59.999Z`) : null
      const statusMatch = !statusRaw || row.status === statusRaw
      const kindMatch = !kindRaw || row.kind === kindRaw
      const tokens = queryRaw.trim().normalize("NFKC").replace(/[%,()\\*]/g, " ").toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
      const fields = [row.reason, row.sourceEvent, row.referenceId].map((value) => String(value || "").normalize("NFKC").toLocaleLowerCase())
      const queryMatch = tokens.length === 0 || tokens.every((token) => fields.some((field) => field.includes(token)))
      return statusMatch && kindMatch && queryMatch && (fromMs == null || row.createdAt >= fromMs) && (toMs == null || row.createdAt <= toMs)
    })
    transferRequests = getProcessGhcStore().listRequests(userId, "all")
  } else {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const limits = getServerEconomyLimits()
  // A DB-backed balance must come from the complete canonical wallet snapshot,
  // never from the current history page. History pagination is read-only.
  let snapshot = computeWalletFromLedger(userId, transactions, limits)
  if (isDatabaseConfigured()) {
    const full = await rpcWalletSnapshot(userId)
    if (!full) return jsonErr("SERVER_UNAVAILABLE", "Failed to load authoritative wallet snapshot", 503, { requestId: reqCtx.requestId })
    snapshot = {
      userId: full.userId,
      balance: full.balance,
      ledgerBalance: full.ledgerBalance,
      locked: full.locked,
      pending: full.pending,
      lifetimeEarned: full.lifetimeEarned,
      lifetimeSpent: full.lifetimeSpent,
      lifetimePurchased: full.lifetimePurchased,
      updatedAt: full.updatedAt,
    }
  }

  if (!isDatabaseConfigured() && before) {
    const beforeTime = Date.parse(before.createdAt)
    transactions = transactions.filter((row) => row.createdAt < beforeTime || (row.createdAt === beforeTime && row.id < before.id))
  }
  // Database pages are already ordered by exact created_at DESC, id DESC at
  // the source. Do not re-sort them by millisecond timestamps in JavaScript:
  // that would discard Postgres sub-millisecond ordering before cursor creation.
  if (!isDatabaseConfigured()) {
    transactions = [...transactions].sort((a, b) => {
      const timeOrder = b.createdAt - a.createdAt
      if (timeOrder !== 0) return timeOrder
      return a.id === b.id ? 0 : a.id < b.id ? 1 : -1
    })
  }
  const hasMore = Array.isArray(transactions) && transactions.length > limitTx
  const boundedRows = Array.isArray(transactions) ? transactions.slice(0, limitTx) : []
  const publicRows = boundedRows.map(({ createdAtCursor: _cursorTimestamp, ...row }) => row)
  const lastRow = boundedRows[boundedRows.length - 1]
  const nextCursor = hasMore && lastRow
    ? Buffer.from(JSON.stringify({
        userId,
        createdAt: lastRow.createdAtCursor || new Date(lastRow.createdAt).toISOString(),
        id: lastRow.id,
      }), "utf8").toString("base64url")
    : null

  return jsonOk({
    transactions: publicRows,
    pagination: {
      limit: limitTx,
      nextCursor,
      hasMore: hasMore && Boolean(nextCursor),
      ordering: "created_at_desc_id_desc",
    },
    rewards: [],
    premium: null,
    transferRequests,
    updatedAt: snapshot.updatedAt || Date.now(),
    snapshot,
    balance: snapshot.balance,
  })
}
