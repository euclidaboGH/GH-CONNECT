import { createHmac, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { createNubanRecipient, paystackTransfersEnabled, PaystackError, resolveNubanAccount } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const params = new URLSearchParams({ user_id: `eq.${auth.userId}`, select: "id,bank_name,bank_code,account_name,account_last4,currency,status,created_at", order: "created_at.desc", limit: "20" })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_bank_beneficiaries?${params}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return reply({ ok: false, error: "BENEFICIARY_LIST_UNAVAILABLE" }, 503)
    const rows = await response.json()
    return Array.isArray(rows) ? reply({ ok: true, beneficiaries: rows }) : reply({ ok: false, error: "BENEFICIARY_RESPONSE_INVALID" }, 503)
  } catch { return reply({ ok: false, error: "BENEFICIARY_LIST_UNAVAILABLE" }, 503) }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`payout-bank-beneficiary-create:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  const fingerprintKey = String(process.env.GHC_BENEFICIARY_FINGERPRINT_KEY || "").trim()
  if (fingerprintKey.length < 32) return reply({ ok: false, error: "BENEFICIARY_FINGERPRINT_KEY_NOT_CONFIGURED" }, 503)
  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  if (typeof body.accountNumber !== "string" || typeof body.bankCode !== "string" || typeof body.accountName !== "string") return reply({ ok: false, error: "INVALID_BANK_DETAILS" }, 400)
  const accountNumber = body.accountNumber.trim()
  const bankCode = body.bankCode.trim()
  const accountName = body.accountName.trim().replace(/\s+/g, " ")
  if (!/^\d{10}$/.test(accountNumber) || !/^[A-Za-z0-9_-]{2,20}$/.test(bankCode) || accountName.length < 2 || accountName.length > 120) return reply({ ok: false, error: "INVALID_BANK_DETAILS" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const fingerprint = createHmac("sha256", fingerprintKey).update(`${bankCode}:${accountNumber}`).digest("hex")
  try {
    const resolved = await resolveNubanAccount(accountNumber, bankCode)
    const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "")
    if (resolved.account_number !== accountNumber || !resolved.account_name?.trim() || normalize(resolved.account_name) !== normalize(accountName)) return reply({ ok: false, error: "ACCOUNT_HOLDER_NAME_MISMATCH", verifiedAccountName: resolved.account_name?.trim().slice(0, 120) || null }, 409)

    const recipient = await createNubanRecipient({ name: resolved.account_name.trim(), accountNumber, bankCode, description: `GreenHaven beneficiary for ${auth.userId.slice(0, 12)}` })
    if (!recipient.active || !/^RCP_[A-Za-z0-9]+$/.test(recipient.recipient_code) || recipient.currency !== "NGN" || recipient.type !== "nuban") return reply({ ok: false, error: "PROVIDER_BENEFICIARY_NOT_ACTIVE" }, 409)
    const bankName = String(recipient.details?.bank_name || "").trim()
    if (!bankName) return reply({ ok: false, error: "PROVIDER_BANK_DETAILS_INCOMPLETE" }, 409)
    const id = `gbn_${randomUUID().replace(/-/g, "")}`
    const payload = {
      id, user_id: auth.userId, provider: "paystack", provider_recipient_code: recipient.recipient_code,
      account_fingerprint: fingerprint, bank_code: bankCode, bank_name: bankName.slice(0, 120),
      account_name: resolved.account_name.trim().slice(0, 120), account_last4: accountNumber.slice(-4), currency: "NGN", status: "verified",
    }
    const response = await fetch(`${base}/rest/v1/gh_bank_beneficiaries`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, Prefer: "return=representation" },
      body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(12_000),
    })
    const saved = await response.json().catch(() => null) as Array<Record<string, unknown>> | { code?: string; message?: string } | null
    if (response.status === 409 || (saved && !Array.isArray(saved) && saved.code === "23505")) return reply({ ok: false, error: "BANK_BENEFICIARY_ALREADY_REGISTERED" }, 409)
    if (!response.ok || !Array.isArray(saved) || !saved[0]) return reply({ ok: false, error: "BENEFICIARY_PERSISTENCE_FAILED", providerRecipientCreated: true, retryable: true }, 503)
    return reply({ ok: true, beneficiary: { id, bankName: payload.bank_name, bankCode, accountName: payload.account_name, accountLast4: payload.account_last4, currency: "NGN", status: "verified" } }, 201)
  } catch (error) {
    const e = error instanceof PaystackError ? error : null
    return reply({ ok: false, error: e?.code || "BENEFICIARY_REGISTRATION_FAILED", retryable: e?.retryable === true }, e?.retryable ? 503 : 422)
  }
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`payout-bank-beneficiary-disable:${auth.userId}`, 5, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const beneficiaryId = typeof body.beneficiaryId === "string" ? body.beneficiaryId.trim() : ""
  if (!/^gbn_[a-f0-9]{32}$/i.test(beneficiaryId)) return reply({ ok: false, error: "INVALID_BENEFICIARY_ID" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_bank_beneficiary_disable`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_user_id: auth.userId, p_beneficiary_id: beneficiaryId }), cache: "no-store", signal: AbortSignal.timeout(12_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || result?.ok !== true) {
      const error = String(result?.error || "BENEFICIARY_DISABLE_FAILED")
      return reply({ ok: false, error }, error === "BENEFICIARY_NOT_FOUND" ? 404 : error === "BENEFICIARY_OWNER_MISMATCH" || error === "BENEFICIARY_HAS_IN_FLIGHT_PAYOUT" ? 409 : 503)
    }
    return reply({ ok: true, beneficiaryId, status: "disabled" })
  } catch { return reply({ ok: false, error: "BENEFICIARY_DISABLE_UNAVAILABLE", retryable: true }, 503) }
}
