import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { listNigerianBanks, paystackTransfersEnabled, PaystackError } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = await checkDurableRateLimit(`payout-bank-list:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return reply({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, durableRateLimitStatus(rl))
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  try {
    const banks = await listNigerianBanks()
    return reply({ ok: true, currency: "NGN", banks: banks.map(({ name, code }) => ({ name, code })) })
  } catch (error) {
    const e = error instanceof PaystackError ? error : null
    return reply({ ok: false, error: e?.code || "BANK_LIST_UNAVAILABLE", retryable: e?.retryable === true }, 503)
  }
}
