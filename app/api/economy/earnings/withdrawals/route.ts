/** Create a durable PI earnings payout request. This endpoint never sends a Pi transfer. */
import { createHash } from "node:crypto"
import { after, NextResponse } from "next/server"
import { resolvePiSandbox } from "@/lib/pi-env"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitStatus, durableRateLimitCode } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { quoteWithdrawal, createPiEarningsPayoutRequest } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }

async function handlePost(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = await checkDurableRateLimit(`pi-earnings-payout-request:${auth.userId}`, 5, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))

  // Request creation is intentionally disabled until the reviewed migration is applied
  // and the operator has explicitly enabled Testnet request intake.
  if (process.env.PI_EARNINGS_PAYOUT_REQUESTS_ENABLED !== "true" || process.env.PI_NETWORK !== "testnet") {
    return reply({ ok: false, error: "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED" }, 503)
  }
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsed.value as { amountAtomic?: unknown; idempotencyKey?: unknown }
  if (typeof body.amountAtomic !== "number" || !Number.isSafeInteger(body.amountAtomic) || body.amountAtomic <= 0) {
    return reply({ ok: false, error: "INVALID_AMOUNT_ATOMIC" }, 400)
  }
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
  if (key.length < 16 || key.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    return reply({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" }, 400)
  }

  const quote = await quoteWithdrawal({ userId: auth.userId, grossAtomic: body.amountAtomic })
  if (!quote.ok || !Number.isSafeInteger(quote.grossAtomic) || !Number.isSafeInteger(quote.feeAtomic) || !Number.isSafeInteger(quote.netAtomic)) {
    return reply({ ok: false, error: quote.error || "WITHDRAWAL_QUOTE_INVALID" }, quote.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409)
  }
  const fingerprint = createHash("sha256").update([
    auth.userId, "PI", "Pi Testnet", quote.grossAtomic, quote.feeAtomic, quote.netAtomic,
    quote.recipientPiAppUid || "",
  ].join("|")).digest("hex")
  const result = await createPiEarningsPayoutRequest({
    userId: auth.userId, idempotencyKey: key, requestFingerprint: fingerprint,
    grossAtomic: quote.grossAtomic!, feeAtomic: quote.feeAtomic!, netAtomic: quote.netAtomic!, network: "Pi Testnet",
  })
  if (!result.ok) {
    const status = result.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409
    return reply({ ok: false, error: result.error }, status)
  }
  const executionReady = process.env.PI_EARNINGS_PAYOUT_EXECUTION_ENABLED === "true" &&
    process.env.PI_A2U_ENABLED === "true" && process.env.PI_A2U_TESTNET_ONLY === "true" &&
    process.env.PI_NETWORK === "testnet" && process.env.PI_ENV === "production" && resolvePiSandbox() &&
    Boolean(String(process.env.PI_EARNINGS_EXECUTOR_KEY || process.env.GHC_A2U_ADMIN_KEY || "").trim())
  if (executionReady && result.status !== "paid") {
    // Server-side dispatch only. The executor secret never reaches the client. The worker
    // independently validates identity authorization, the durable reservation, provider receipt,
    // and Testnet-only flags before any Pi can leave the app wallet.
    after(async () => {
      const executorKey = String(process.env.PI_EARNINGS_EXECUTOR_KEY || process.env.GHC_A2U_ADMIN_KEY || "").trim()
      try {
        const response = await fetch(new URL("/api/economy/earnings/withdrawals/execute", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ghc-pi-earnings-key": executorKey, Accept: "application/json" },
          body: JSON.stringify({ requestId: result.requestId }),
          cache: "no-store",
          signal: AbortSignal.timeout(240_000),
        })
        if (!response.ok) console.error("[pi-earnings] server-side payout dispatch returned non-success", { requestId: result.requestId, status: response.status })
        else {
          const workerResult = await response.json().catch(() => null) as { ok?: boolean; error?: string; status?: string } | null
          if (!workerResult?.ok) console.error("[pi-earnings] payout remains pending after dispatch", { requestId: result.requestId, error: String(workerResult?.error || "WORKER_UNCONFIRMED").slice(0, 100) })
        }
      } catch (error) {
        console.error("[pi-earnings] payout dispatch failed; durable reservation remains recoverable", { requestId: result.requestId, error: error instanceof Error ? error.message.slice(0, 100) : "DISPATCH_FAILED" })
      }
    })
  }
  return reply({
    ok: true, requestId: result.requestId, status: result.status,
    duplicate: result.duplicate === true, grossAtomic: result.grossAtomic,
    feeAtomic: result.feeAtomic, netAtomic: result.netAtomic,
    network: "Pi Testnet", transferSubmitted: false,
    executionTriggered: executionReady,
    message: executionReady
      ? "Payout request reserved. A server-side Testnet execution attempt is queued; this response is not a payment confirmation."
      : "Payout request reserved. Pi has not been transferred because the Testnet execution gates are not all enabled.",
  }, result.duplicate ? 200 : 201)
}
export async function POST(request: Request) {
  try { return await handlePost(request) }
  catch (error) {
    console.error("[pi-earnings] payout request endpoint failed safely", { error: error instanceof Error ? error.name : "UNKNOWN_ERROR" })
    return reply({ ok: false, error: "PAYOUT_REQUEST_TEMPORARILY_UNAVAILABLE", message: "The payout service is temporarily unavailable. Check withdrawal status before retrying." }, 503)
  }
}
