/**
 * Phase 6 — Withdrawal quote: 3% fee, net to auth-linked Pi wallet.
 * POST { amountPi | amountAtomic } — never trusts client recipient.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  quoteWithdrawal,
  piToAtomic,
  floorPiToAtomic,
} from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`earnings-quote:${auth.userId}`, 30, 60_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) {
    return reply(
      { ok: false, error: parsedBody.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON" },
      parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400,
    )
  }
  const body = parsedBody.value as { amountPi?: unknown; amountAtomic?: unknown }

  let grossAtomic = 0
  if (typeof body.amountAtomic === "number" && Number.isSafeInteger(body.amountAtomic) && body.amountAtomic > 0) {
    grossAtomic = body.amountAtomic
  } else if (typeof body.amountPi === "number" && Number.isFinite(body.amountPi) && body.amountPi > 0) {
    grossAtomic = floorPiToAtomic(body.amountPi)
    if (!Number.isSafeInteger(grossAtomic) || grossAtomic <= 0) grossAtomic = 0
  } else {
    return reply({ ok: false, error: "AMOUNT_REQUIRED" }, 400)
  }

  const quote = await quoteWithdrawal({ userId: auth.userId, grossAtomic })
  if (!quote.ok) {
    const status =
      quote.error === "EARNINGS_LEDGER_UNAVAILABLE"
        ? 503
        : quote.error === "LINKED_PI_IDENTITY_REQUIRED" || quote.error === "WALLET_AUTHORIZATION_REQUIRED"
          ? 409
          : 409
    return reply({
      ok: false,
      error: quote.error,
      message:
        quote.error === "LINKED_PI_IDENTITY_REQUIRED"
          ? "Sign in with Pi so your wallet is linked before withdrawing."
          : quote.error === "WALLET_AUTHORIZATION_REQUIRED"
            ? "Authorize Pi wallet payouts in Identity settings before withdrawing."
            : undefined,
    }, status)
  }

  return reply({
    ...quote,
    // Explicit: recipient is never taken from the request body
    recipientSource: "gh_pi_identities",
    feePolicy: "3% of gross withdrawal (fee_bps=300)",
    ok: true,
  })
}
