/** Create a durable PI earnings payout request. This endpoint never sends a Pi transfer. */
import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitStatus, durableRateLimitCode } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { quoteWithdrawal, createPiEarningsPayoutRequest } from "@/lib/server/earnings/unified-ledger"
import { checkPinProof, pinProofConfigured } from "@/lib/server/identity/withdrawal-pin-proof"
import { assertPayoutWalletAuthorization } from "@/lib/server/identity/wallet-authorization"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = await checkDurableRateLimit(`pi-earnings-payout-request:${auth.userId}`, 5, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))

  // Request creation is intentionally disabled until the reviewed migration is applied
  // and the operator has explicitly enabled Testnet request intake.
  if (process.env.PI_EARNINGS_PAYOUT_REQUESTS_ENABLED !== "true" || process.env.PI_NETWORK !== "testnet") {
    return reply({ ok: false, error: "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED" }, 503)
  }
  // Never reserve (lock) a user's available PI unless the Testnet executor that can
  // settle or release that reservation is also enabled. Otherwise the requested
  // amount is stranded in "reserved" and the user's genuinely earned balance
  // (registration bonus, rewards, cashback) cannot be used.
  if (
    process.env.PI_EARNINGS_PAYOUT_EXECUTION_ENABLED !== "true" ||
    process.env.PI_A2U_ENABLED !== "true" ||
    process.env.PI_A2U_TESTNET_ONLY !== "true"
  ) {
    return reply({
      ok: false,
      error: "PI_EARNINGS_PAYOUT_EXECUTION_DISABLED",
      message: "Withdrawals are not being processed yet. Your balance is untouched and stays available.",
    }, 503)
  }
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsed.value as { amountAtomic?: unknown; idempotencyKey?: unknown; pinProof?: unknown }
  if (typeof body.amountAtomic !== "number" || !Number.isSafeInteger(body.amountAtomic) || body.amountAtomic <= 0) {
    return reply({ ok: false, error: "INVALID_AMOUNT_ATOMIC" }, 400)
  }
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
  if (key.length < 16 || key.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    return reply({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" }, 400)
  }

  // Server-enforced withdrawal PIN: no valid proof for this user + key, no reservation.
  if (!pinProofConfigured()) return reply({ ok: false, error: "PIN_PROOF_SECRET_MISSING" }, 503)
  if (!checkPinProof(auth.userId, key, body.pinProof)) {
    return reply({ ok: false, error: "PIN_PROOF_REQUIRED", message: "Verify your withdrawal PIN to continue." }, 403)
  }

  const quote = await quoteWithdrawal({ userId: auth.userId, grossAtomic: body.amountAtomic })
  if (!quote.ok || !Number.isSafeInteger(quote.grossAtomic) || !Number.isSafeInteger(quote.feeAtomic) || !Number.isSafeInteger(quote.netAtomic)) {
    return reply({ ok: false, error: quote.error || "WITHDRAWAL_QUOTE_INVALID" }, quote.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409)
  }
  const recipientUid = String(quote.recipientPiAppUid || "").trim()
  if (!recipientUid) {
    return reply({ ok: false, error: "VERIFIED_PI_RECIPIENT_REQUIRED" }, 409)
  }
  // Require explicit, active consent before even reserving a payout request.
  // The execution worker independently rechecks consent immediately before A2U.
  const walletAuthorization = await assertPayoutWalletAuthorization({
    ghUserId: auth.userId,
    recipientUid,
  })
  if (!walletAuthorization.ok) {
    const error = walletAuthorization.error || "WALLET_AUTHORIZATION_REQUIRED"
    return reply({
      ok: false,
      error,
      message: error === "WALLET_AUTHORIZATION_REQUIRED"
        ? "Authorize Pi wallet payouts before requesting a withdrawal."
        : undefined,
    }, error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409)
  }

  const fingerprint = createHash("sha256").update([
    auth.userId, "PI", "Pi Testnet", quote.grossAtomic, quote.feeAtomic, quote.netAtomic,
    recipientUid,
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
