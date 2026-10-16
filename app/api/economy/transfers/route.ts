/**
 * POST /api/economy/transfers — Phase C.1 / D6
 * Intent only. Sender from verified session. Atomic money move via ghc_execute_transfer RPC.
 * Notifications recorded only after authoritative success (deduped by referenceId).
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  executeAuthoritativeTransfer,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { rpcExecuteTransfer } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { notifyTransferCompleted } from "@/lib/server/economy/notifications"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  // Phase 4: server-verifiable step-up required for transfers
  const stepUpErr = await requireRecentStepUp(auth)
  if (stepUpErr) {
    return jsonErr(stepUpErr.code, stepUpErr.message, stepUpErr.status)
  }

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`transfer:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many transfers; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("TRANSFER_FAILED", "Invalid JSON body", 400)
  }

  // Sender is ONLY auth.userId — ignore client-supplied sender/user fields
  void body.senderId
  void body.fromUserId
  void body.userId
  void body.balance

  const toUserId = String(body.toUserId || "").trim()
  const referenceId = String(body.referenceId || "").trim()
  const note = body.note != null ? String(body.note) : undefined
  const requestId = body.requestId != null ? String(body.requestId) : undefined
  const toUserName = body.toUserName != null ? String(body.toUserName) : undefined

  if (!toUserId) return jsonErr("INVALID_RECIPIENT", "Recipient required", 400)
  if (!referenceId) return jsonErr("TRANSFER_FAILED", "referenceId required", 400)

  const { validatePositiveGhcAmount } = await import("@/lib/server/economy/amount")
  const amt = validatePositiveGhcAmount(body.amount, { max: 5_000 })
  if (!amt.ok) {
    return jsonErr(amt.code, amt.message, 400)
  }
  const amount = amt.amount

  if (toUserId === auth.userId) {
    return jsonErr("SELF_TRANSFER", "Cannot send to yourself", 400)
  }

  if (isDatabaseConfigured()) {
    const result = await rpcExecuteTransfer({
      senderId: auth.userId,
      toUserId,
      amount,
      referenceId,
      note,
      requestId,
    })
    if (!result.ok) {
      const status =
        result.error.code === "AUTH_REQUIRED"
          ? 401
          : result.error.code === "INSUFFICIENT_BALANCE"
            ? 402
            : result.error.code === "SERVER_UNAVAILABLE"
              ? 503
              : 400
      return jsonErr(result.error.code, result.error.message, status)
    }
    try {
      await notifyTransferCompleted({
        senderId: auth.userId,
        recipientId: toUserId,
        amount: Math.abs(amount),
        referenceId: result.referenceId || referenceId,
        recipientName: toUserName,
      })
    } catch {
      /* non-blocking */
    }
    return jsonOk({
      ok: true,
      idempotent: result.idempotent,
      referenceId: result.referenceId,
      debitTx: result.debitTx,
      creditTx: result.creditTx,
      wallet: result.wallet,
    })
  }

  if (!allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative GHC transfers require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL) after applying migrations. In-memory transfers are disabled on this deployment.",
      503
    )
  }

  const result = await executeAuthoritativeTransfer(getProcessGhcStore(), {
    senderId: auth.userId,
    toUserId,
    amount,
    referenceId,
    note,
    requestId,
  })

  if (!result.ok) {
    const status =
      result.error.code === "AUTH_REQUIRED"
        ? 401
        : result.error.code === "INSUFFICIENT_BALANCE"
          ? 402
          : 400
    return jsonErr(result.error.code, result.error.message, status)
  }

  try {
    await notifyTransferCompleted({
      senderId: auth.userId,
      recipientId: toUserId,
      amount: Math.abs(amount),
      referenceId: result.referenceId || referenceId,
      recipientName: toUserName,
    })
  } catch {
    /* non-blocking */
  }

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    referenceId: result.referenceId,
    debitTx: result.debitTx,
    creditTx: result.creditTx,
    wallet: result.wallet,
  })
}
