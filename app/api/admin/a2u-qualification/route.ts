import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { resolvePiSandbox } from "@/lib/pi-env"
import { operatorKeyAuthorized, SHARED_WORKER_KEY_MIN_BYTES } from "@/lib/server/security/operator-key"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import type { PiBackendPayment } from "pi-backend"
import { getWalletAuthorization } from "@/lib/server/identity/wallet-authorization"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }
function authorized(request: Request) {
  return operatorKeyAuthorized(request, { headers: ["x-ghc-a2u-admin-key"], envNames: ["GHC_A2U_ADMIN_KEY"], minBytes: SHARED_WORKER_KEY_MIN_BYTES })
}
function testnetQualificationEnabled() {
  return process.env.PI_NETWORK === "testnet" && process.env.PI_A2U_TESTNET_ONLY === "true" && process.env.PI_ENV === "production" && resolvePiSandbox()
}
async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`QUALIFICATION_RPC_${response.status}`)
  return await response.json() as T
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  if (!testnetQualificationEnabled()) return reply({ ok: false, error: "TESTNET_A2U_QUALIFICATION_GATE_CLOSED" }, 503)
  try {
    const result = await rpc<Record<string, unknown>>("gh_pi_a2u_qualification_summary", {})
    if (!result) return reply({ ok: false, error: "QUALIFICATION_UNAVAILABLE" }, 503)
    return reply({ ok: true, ...result, network: "Pi Testnet", note: "KYC is operator-attested from the official Pi KYC app; this API does not independently query Pi KYC status." })
  } catch { return reply({ ok: false, error: "QUALIFICATION_UNAVAILABLE" }, 503) }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  if (!testnetQualificationEnabled()) return reply({ ok: false, error: "TESTNET_A2U_QUALIFICATION_GATE_CLOSED" }, 503)
  const parsed = await readBoundedJson(request, 16 * 1024)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsed.value as Record<string, unknown>
  const action = String(body.action || "")
  const operator = String(body.operator || "").trim().slice(0, 100)
  if (operator.length < 2) return reply({ ok: false, error: "OPERATOR_REQUIRED" }, 400)

  if (action === "attest_recipient") {
    const ghUserId = String(body.ghUserId || "").trim()
    const piAppUid = String(body.piAppUid || "").trim()
    const evidenceRef = String(body.kycEvidenceRef || "").trim()
    if (ghUserId.length < 8 || piAppUid.length < 3 || !/^[A-Za-z0-9._:-]{4,160}$/.test(evidenceRef)) return reply({ ok: false, error: "INVALID_RECIPIENT_ATTESTATION" }, 400)
    if (body.kycFullyPassed !== true) return reply({ ok: false, error: "FULL_KYC_CONFIRMATION_REQUIRED" }, 400)
    try {
      const result = await rpc<{ ok?: boolean; error?: string }>("gh_pi_a2u_qualification_attest_recipient", {
        p_gh_user_id: ghUserId, p_pi_app_uid: piAppUid, p_kyc_evidence_ref: evidenceRef, p_verified_by: operator,
      })
      if (!result?.ok) return reply({ ok: false, error: result?.error || "RECIPIENT_ATTESTATION_FAILED" }, 409)
      return reply({ ok: true, recipient: result })
    } catch { return reply({ ok: false, error: "RECIPIENT_ATTESTATION_UNAVAILABLE" }, 503) }
  }

  if (action === "record_verified_payment") {
    if (process.env.PI_A2U_ENABLED !== "true") return reply({ ok: false, error: "PI_A2U_DISABLED" }, 503)
    const paymentId = String(body.providerPaymentId || "").trim()
    const txid = String(body.txid || "").trim()
    const piAppUid = String(body.piAppUid || "").trim()
    if (!paymentId || paymentId.length > 200 || txid.length < 8 || txid.length > 300 || piAppUid.length < 3) return reply({ ok: false, error: "INVALID_PAYMENT_REFERENCE" }, 400)
    const apiKey = String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
    const walletSeed = String(process.env.PI_WALLET_PRIVATE_SEED || "").trim()
    if (!apiKey || !/^S[A-Z2-7]{55}$/.test(walletSeed)) return reply({ ok: false, error: "PI_A2U_SERVER_CREDENTIALS_MISSING" }, 503)
    try {
      const PiBackendModule = await import("pi-backend")
      const sdk = new PiBackendModule.default(apiKey, walletSeed)
      const payment = await sdk.getPayment(paymentId) as PiBackendPayment
      const amount = typeof payment.amount === "number" ? payment.amount : Number(payment.amount)
      const verified = payment.identifier === paymentId && payment.direction === "app_to_user" && payment.network === "Pi Testnet" &&
        payment.user_uid === piAppUid && Number.isFinite(amount) && amount > 0 &&
        payment.transaction?.txid === txid && (payment.status?.transaction_verified === true || payment.transaction?.verified === true) &&
        payment.status?.developer_completed === true && payment.status?.cancelled !== true && payment.status?.user_cancelled !== true &&
        String(payment.metadata?.direction || "") === "a2u" && String(payment.metadata?.payoutRequestId || "").length > 0
      if (!verified) return reply({ ok: false, error: "PROVIDER_PAYMENT_NOT_QUALIFIED", checks: { direction: payment.direction === "app_to_user", network: payment.network === "Pi Testnet", recipient: payment.user_uid === piAppUid, verifiedTx: payment.transaction?.txid === txid && (payment.status?.transaction_verified === true || payment.transaction?.verified === true), developerCompleted: payment.status?.developer_completed === true } }, 409)
      const recipient = await rpc<{ ok?: boolean; ghUserId?: string }>("gh_pi_a2u_qualification_recipient_get", { p_pi_app_uid: piAppUid })
      if (!recipient?.ok || !recipient.ghUserId) return reply({ ok: false, error: "FULL_KYC_RECIPIENT_ATTESTATION_REQUIRED" }, 409)
      const walletAuthorization = await getWalletAuthorization(recipient.ghUserId)
      const providerDestination = String(payment.to_address || "").trim()
      if (!walletAuthorization.ok || walletAuthorization.authorizationActive !== true || walletAuthorization.authorizedPiAppUid !== piAppUid || !walletAuthorization.piWalletAddress || walletAuthorization.piWalletAddress !== providerDestination) {
        return reply({ ok: false, error: "PROVIDER_DESTINATION_DOES_NOT_MATCH_VERIFIED_PI_WALLET" }, 409)
      }
      const result = await rpc<{ ok?: boolean; error?: string; qualifiedCount?: number; requiredCount?: number; qualified?: boolean }>("gh_pi_a2u_qualification_record_transaction", {
        p_provider_payment_id: paymentId, p_txid: txid, p_pi_app_uid: piAppUid, p_recipient_wallet_address: providerDestination, p_amount: amount,
        p_network: "Pi Testnet", p_direction: "app_to_user", p_transaction_verified: true,
        p_developer_completed: true, p_provider_metadata: { direction: "a2u", payoutRequestId: String(payment.metadata?.payoutRequestId || "") }, p_verified_by: operator,
      })
      if (!result?.ok) return reply({ ok: false, error: result?.error || "PAYMENT_RECORD_FAILED" }, 409)
      return reply({ ok: true, qualification: result })
    } catch { return reply({ ok: false, error: "PI_PROVIDER_VERIFICATION_UNAVAILABLE" }, 503) }
  }
  return reply({ ok: false, error: "UNKNOWN_ACTION" }, 400)
}
