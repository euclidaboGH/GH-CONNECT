import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { listNigerianBanks, paystackTransfersEnabled, PaystackError } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = checkRateLimit(`payout-bank-list:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  try {
    const banks = await listNigerianBanks()
    return reply({ ok: true, currency: "NGN", banks: banks.map(({ name, code }) => ({ name, code })) })
  } catch (error) {
    const e = error instanceof PaystackError ? error : null
    return reply({ ok: false, error: e?.code || "BANK_LIST_UNAVAILABLE", retryable: e?.retryable === true }, 503)
  }
}
