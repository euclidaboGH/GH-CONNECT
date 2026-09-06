/**
 * POST /api/economy/ledger/spend
 * Server-authoritative GHC debit (membership, boosts, catalog spends).
 * Amount from spend-catalog — client amount cannot inflate charge.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { resolveSpendAmount } from "@/lib/server/economy/spend-catalog"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"

async function rpcSpend(input: {
  userId: string
  amount: number
  referenceId: string
  reason: string
  sourceEvent: string
}): Promise<{ ok: boolean; idempotent?: boolean; tx?: unknown; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_execute_spend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_user_id: input.userId,
          p_amount: input.amount,
          p_reference_id: input.referenceId,
          p_reason: input.reason,
          p_source_event: input.sourceEvent,
        }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      return { ok: false, error: "SPEND_RPC_FAILED" }
    }
    if (data.ok === false) {
      return { ok: false, error: String(data.error || "SPEND_FAILED") }
    }
    return {
      ok: true,
      idempotent: Boolean(data.idempotent),
      tx: data.tx || { id: data.transactionId, referenceId: data.referenceId },
    }
  } catch {
    return { ok: false, error: "SPEND_RPC_FAILED" }
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`spend:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many spend attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }

  const purpose = String(body.purpose || body.sourceEvent || "").trim()
  const clientAmount = Number(body.amount)
  const referenceId = String(body.referenceId || "").trim()
  const reason = String(body.reason || "Purchase").trim()
  const kind = (body.kind as "spent" | "purchased" | undefined) || "spent"

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)

  const resolved = resolveSpendAmount(purpose, clientAmount)
  if (!resolved.ok) {
    return jsonErr(resolved.error, resolved.error, 400)
  }

  if (isDatabaseConfigured()) {
    const rpc = await rpcSpend({
      userId: auth.userId,
      amount: resolved.amount,
      referenceId,
      reason: reason || resolved.entry.description,
      sourceEvent: resolved.entry.purpose,
    })
    if (!rpc.ok) {
      const status = rpc.error === "INSUFFICIENT_BALANCE" ? 402 : 503
      return jsonErr(rpc.error || "SPEND_FAILED", rpc.error || "Spend failed", status)
    }
    return jsonOk({
      ok: true,
      idempotent: rpc.idempotent,
      transaction: rpc.tx,
      amount: resolved.amount,
      purpose: resolved.entry.purpose,
      baseGhc: resolved.entry.baseGhc,
      feeGhc: resolved.entry.feeGhc,
    })
  }

  if (!allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative spend requires database or GHC_SERVER_MEMORY=1",
      503
    )
  }

  const result = await executeAuthoritativeSpend(getProcessGhcStore(), {
    userId: auth.userId,
    amount: resolved.amount,
    referenceId,
    reason: reason || resolved.entry.description,
    sourceEvent: resolved.entry.purpose,
    kind,
  })
  if (!result.ok) {
    const status = result.error === "INSUFFICIENT_BALANCE" ? 402 : 400
    return jsonErr(result.error, result.error, status)
  }

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    transaction: result.tx,
    amount: resolved.amount,
    purpose: resolved.entry.purpose,
    baseGhc: resolved.entry.baseGhc,
    feeGhc: resolved.entry.feeGhc,
  })
}
