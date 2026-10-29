/**
 * Phase 4 reward adapter surface.
 * GET  — policy + caps (authenticated)
 * POST — server-gated credit attempt (requires adapters enabled + auth; amount clamped server-side)
 *
 * This is not an open faucet. Without PI_EARNINGS_ADAPTERS_ENABLED + Testnet, all credits deny.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  evaluateAndCreditReward,
  getRewardAdapterPolicy,
  type RewardSourceKind,
} from "@/lib/server/earnings/reward-adapters"
import { piToAtomic } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

const ALLOWED: RewardSourceKind[] = [
  "activity_reward", "creator_earning", "referral", "promotion", "community", "utility", "system",
]

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  return reply({ ok: true, policy: getRewardAdapterPolicy() })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`earnings-adapter:${auth.userId}`, 20, 60_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  let body: {
    sourceKind?: string
    referenceId?: string
    amountPi?: number
    amountAtomic?: number
    counterpartyId?: string
    reason?: string
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return reply({ ok: false, error: "INVALID_JSON" }, 400)
  }

  const sourceKind = String(body.sourceKind || "").trim() as RewardSourceKind
  if (!ALLOWED.includes(sourceKind)) {
    return reply({ ok: false, error: "INVALID_SOURCE_KIND" }, 400)
  }
  // Client cannot use system kind
  if (sourceKind === "system") {
    return reply({ ok: false, error: "SYSTEM_SOURCE_FORBIDDEN" }, 403)
  }

  const referenceId = String(body.referenceId || "").trim()
  if (!referenceId) return reply({ ok: false, error: "REFERENCE_REQUIRED" }, 400)

  let amountAtomic = 0
  if (typeof body.amountAtomic === "number" && Number.isInteger(body.amountAtomic) && body.amountAtomic > 0) {
    amountAtomic = body.amountAtomic
  } else if (typeof body.amountPi === "number" && body.amountPi > 0) {
    amountAtomic = piToAtomic(body.amountPi)
  } else {
    return reply({ ok: false, error: "AMOUNT_REQUIRED" }, 400)
  }

  const decision = await evaluateAndCreditReward({
    userId: auth.userId,
    sourceKind,
    referenceId,
    amountAtomic,
    counterpartyId: body.counterpartyId,
    actorId: auth.userId,
    reason: body.reason,
  })

  if (decision.outcome === "denied") {
    return reply({ ...decision, ok: false }, decision.denyReason === "ADAPTERS_DISABLED" ? 403 : 409)
  }
  return reply({ ...decision, ok: true })
}
