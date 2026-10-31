import { NextResponse } from "next/server"
import { assertOperatorKey } from "@/lib/server/marketplace/operational-rpc"
import {
  durationForBillingPeriod,
  renewMembershipFromVerifiedIntent,
} from "@/lib/server/membership/renewal-workflow"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0" }

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

/**
 * Operator or trusted payment-completion path: renew from verified payment intent.
 * Payment must already be completed and catalog-bound in the database RPC.
 */
export async function POST(request: Request) {
  if (!assertOperatorKey(request.headers.get("x-ghc-operator-key"))) {
    return reply({ ok: false, error: "OPERATOR_UNAUTHORIZED" }, 401)
  }
  const parsedBody = await readBoundedJson(request, 32 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value

  const paymentIntentId = String(body.paymentIntentId || "").trim()
  const userId = String(body.userId || "").trim()
  const period = String(body.billingPeriod || "monthly")
  if (!paymentIntentId || !userId) {
    return reply({ ok: false, error: "PAYMENT_INTENT_AND_USER_REQUIRED" }, 400)
  }

  const result = await renewMembershipFromVerifiedIntent({
    paymentIntentId,
    userId,
    durationInterval: String(body.durationInterval || durationForBillingPeriod(period)),
  })
  return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
}
