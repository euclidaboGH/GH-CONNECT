/**
 * Phase 9 — User charity summary (GET) and record contribution (POST).
 * Contributions are segregated from withdrawable PI earnings.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  getCharityUserSummary,
  recordCharityContribution,
} from "@/lib/server/earnings/platform-utility"
import { floorPiToAtomic } from "@/lib/server/earnings/unified-ledger"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`charity-get:${auth.userId}`, 60, 60_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)
  const summary = await getCharityUserSummary(auth.userId)
  if (!summary?.ok) {
    return reply({ ok: false, error: summary?.error || "CHARITY_UNAVAILABLE" }, 503)
  }
  return reply({
    ok: true,
    ...summary,
    withdrawable: false,
    segregated: true,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`charity-post:${auth.userId}`, 10, 60_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value as {
    amountPi?: number
    amountAtomic?: number
    uniqueRef?: string
    campaignKey?: string
    reason?: string
  }

  let amountAtomic = 0
  if (typeof body.amountAtomic === "number" && Number.isInteger(body.amountAtomic) && body.amountAtomic > 0) {
    amountAtomic = body.amountAtomic
  } else if (typeof body.amountPi === "number" && body.amountPi > 0) {
    amountAtomic = floorPiToAtomic(body.amountPi)
  } else {
    return reply({ ok: false, error: "AMOUNT_REQUIRED" }, 400)
  }

  const uniqueRef = String(body.uniqueRef || "").trim()
  if (!uniqueRef || uniqueRef.length > 200) {
    return reply({ ok: false, error: "REFERENCE_REQUIRED" }, 400)
  }

  // Note: funding debit from available balance is a separate reserve path; this
  // endpoint records the charity allocation when funds are already authorized.
  const result = await recordCharityContribution({
    userId: auth.userId,
    amountAtomic,
    uniqueRef,
    campaignKey: body.campaignKey,
    reason: body.reason,
  })
  if (!result.ok) {
    return reply({ ok: false, error: result.error }, 409)
  }
  return reply({
    ...result,
    withdrawable: false,
    message: "Charity recorded. This does not increase your available earnings balance.",
    ok: true,
  })
}
