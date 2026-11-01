import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { paystackTransfersEnabled, PaystackError, resolveNubanAccount } from "@/lib/server/payouts/paystack"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`payout-bank-resolve:${auth.userId}`, 5, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const accountNumber = String(body?.accountNumber || "").trim()
  const bankCode = String(body?.bankCode || "").trim()
  if (!/^\d{10}$/.test(accountNumber) || !/^[A-Za-z0-9_-]{2,20}$/.test(bankCode)) return reply({ ok: false, error: "INVALID_BANK_DETAILS" }, 400)
  try {
    const resolved = await resolveNubanAccount(accountNumber, bankCode)
    if (resolved.account_number !== accountNumber || !resolved.account_name?.trim()) return reply({ ok: false, error: "BANK_ACCOUNT_VERIFICATION_MISMATCH" }, 409)
    return reply({ ok: true, verified: true, accountName: resolved.account_name.trim().slice(0, 120), accountLast4: accountNumber.slice(-4), bankCode })
  } catch (error) {
    const e = error instanceof PaystackError ? error : null
    return reply({ ok: false, error: e?.code || "BANK_ACCOUNT_RESOLUTION_FAILED", retryable: e?.retryable === true }, e?.retryable ? 503 : 422)
  }
}
