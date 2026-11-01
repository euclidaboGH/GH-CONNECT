/** Privileged Paystack transfer execution. A durable approved request and NGN obligation are mandatory. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { initiateNgnTransfer, paystackLiveTransfersApproved, paystackTransfersEnabled, PaystackError } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_PAYOUT_RECONCILIATION_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-payout-reconciliation-key") || ""), "utf8")
  return expected.length > 0 && expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("paystack-bank-transfer-execute", 5, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  if (!paystackLiveTransfersApproved()) return reply({ ok: false, error: "LIVE_BANK_TRANSFERS_NOT_APPROVED" }, 503)
  const { requestId } = await context.params
  if (!/^gbp_[a-f0-9]{32}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const rpc = async (name: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey!, Authorization: `Bearer ${env.supabaseServiceRoleKey!}` }, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || result?.ok !== true) throw new Error(String(result?.error || `${name.toUpperCase()}_FAILED`))
    return result
  }
  const maxTransferKobo = Number(process.env.PAYSTACK_MAX_TRANSFER_KOBO || 0)
  const dailyLimitKobo = Number(process.env.PAYSTACK_DAILY_TRANSFER_LIMIT_KOBO || 0)
  if (!Number.isSafeInteger(maxTransferKobo) || maxTransferKobo < 100 || !Number.isSafeInteger(dailyLimitKobo) || dailyLimitKobo < 100) return reply({ ok: false, error: "PAYOUT_LIMITS_NOT_CONFIGURED" }, 503)
  try {
    // The DB locks the request, atomically reserves daily capacity, and returns the same reference on every retry.
    const begun = await rpc("gh_bank_payout_begin_transfer", { p_request_id: requestId, p_max_transfer_kobo: maxTransferKobo, p_daily_limit_kobo: dailyLimitKobo })
    const amountKobo = Number(begun.amountKobo)
    const recipientCode = String(begun.recipientCode || "")
    const reference = String(begun.providerReference || "")
    if (!Number.isSafeInteger(amountKobo) || amountKobo < 100 || !/^RCP_[A-Za-z0-9]+$/.test(recipientCode) || !/^ghb_[a-f0-9]{32}$/.test(reference)) return reply({ ok: false, error: "BANK_PAYOUT_BINDING_INVALID" }, 409)
    const transfer = await initiateNgnTransfer({ amountKobo, recipientCode, reference, reason: `GreenHaven seller payout ${requestId}` })
    if (transfer.reference !== reference || transfer.amount !== amountKobo || transfer.currency !== "NGN") return reply({ ok: false, error: "PAYSTACK_TRANSFER_BINDING_MISMATCH", manualReviewRequired: true }, 409)
    const recorded = await rpc("gh_bank_payout_record_submission", { p_request_id: requestId, p_provider_reference: reference, p_transfer_code: String(transfer.transfer_code || ""), p_provider_status: String(transfer.status || "pending"), p_provider_transfer_id: String(transfer.id || "") })
    const finalStatus = String(recorded.status || "processing")
    const alreadyPaid = recorded.paid === true || finalStatus === "paid"
    const needsOtp = transfer.status === "otp"
    const message = alreadyPaid
      ? "Provider confirmation has already been reconciled for this request."
      : ["failed", "reversed"].includes(finalStatus)
        ? "The provider reported a terminal non-success state. Keep the obligation under review; do not issue a new transfer reference."
        : needsOtp
          ? "Paystack requires operator OTP confirmation. This endpoint will not bypass OTP; complete the provider-controlled confirmation workflow and reconcile the same reference."
          : "Transfer submitted. Final payment status is controlled by a verified Paystack webhook or provider reconciliation."
    return reply({ ok: true, requestId, provider: "paystack", status: finalStatus, providerReference: reference, transferCode: transfer.transfer_code || null, paid: alreadyPaid, requiresOperatorOtp: needsOtp, message }, alreadyPaid ? 200 : 202)
  } catch (error) {
    const message = error instanceof PaystackError ? error.code : error instanceof Error ? error.message : "BANK_PAYOUT_EXECUTION_FAILED"
    const conflict = ["PAYOUT_EXCEEDS_SINGLE_TRANSFER_LIMIT", "PAYOUT_DAILY_LIMIT_EXCEEDED", "PAYOUT_NOT_APPROVED", "BENEFICIARY_NOT_VERIFIED", "PAYOUT_PROVIDER_REFERENCE_MISSING"].includes(message)
    return reply({ ok: false, error: message, retryable: error instanceof PaystackError ? error.retryable : !conflict, message: "Do not create a new request or reference after an uncertain provider response. Retry using the same payout request and reference." }, conflict ? 409 : 503)
  }
}
