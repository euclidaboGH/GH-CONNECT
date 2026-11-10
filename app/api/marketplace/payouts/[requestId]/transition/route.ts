/** Privileged seller-payout lifecycle operator. This endpoint can never mark a payout paid. */
import { NextResponse } from "next/server"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readGhcServerEnv } from "@/lib/server/economy/env"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { operatorKeyAuthorized, OPERATOR_KEY_MIN_BYTES } from "@/lib/server/security/operator-key"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}
function authorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-payout-reconciliation-key"],
    envNames: ["GHC_PAYOUT_RECONCILIATION_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = await checkDurableRateLimit("seller-payout-operator-transition", 30, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return reply({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, durableRateLimitStatus(rl))
  const { requestId } = await context.params
  if (!/^spr_[a-f0-9]{16,40}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const nextStatus = String(body.nextStatus || "")
  // Paid is intentionally excluded. PI/GHC settlement functions are the only code paths
  // allowed to set paid after their respective financial evidence is committed.
  if (!["under_review", "approved", "processing", "rejected", "failed", "cancelled"].includes(nextStatus)) {
    return reply({ ok: false, error: "INVALID_OPERATOR_TRANSITION" }, 400)
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_seller_payout_transition`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_next_status: nextStatus, p_operator_note: String(body.note || "Operator workflow transition").slice(0, 1000), p_payout_reference: null }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "PAYOUT_TRANSITION_FAILED")
      return reply({ ok: false, error }, error === "NOT_FOUND" ? 404 : error === "INVALID_TRANSITION" || error === "TERMINAL_STATUS" ? 409 : 503)
    }
    return reply({ ok: true, requestId, status: result.status, paid: false })
  } catch {
    return reply({ ok: false, error: "PAYOUT_TRANSITION_UNAVAILABLE", retryable: true }, 503)
  }
}
