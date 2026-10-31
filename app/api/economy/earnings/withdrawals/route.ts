/** Create a durable PI earnings payout request. This endpoint never sends a Pi transfer. */
import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { quoteWithdrawal, createPiEarningsPayoutRequest } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`pi-earnings-payout-request:${auth.userId}`, 5, 60_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

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
  return reply({
    ok: true, requestId: result.requestId, status: result.status,
    duplicate: result.duplicate === true, grossAtomic: result.grossAtomic,
    feeAtomic: result.feeAtomic, netAtomic: result.netAtomic,
    network: "Pi Testnet", transferSubmitted: false,
    message: "Payout request reserved. Pi transfer execution is not enabled in this release.",
  }, result.duplicate ? 200 : 201)
}
