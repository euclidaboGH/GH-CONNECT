/** Privileged settlement of an approved GHC reward from the funded protocol reserve. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MAX_SETTLEMENT_BODY_BYTES = 4_096
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_CREATOR_REWARD_OPERATOR_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-creator-reward-operator-key") || ""), "utf8")
  return expected.length >= 32 && supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
export async function POST(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("creator-reward-settle", 30, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const parsed = await readBoundedJson(request, MAX_SETTLEMENT_BODY_BYTES)
  if (!parsed.ok) {
    const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
    return reply({ ok: false, error: parsed.error }, status)
  }
  const body = parsed.value
  const rewardEventId = String(body.rewardEventId || "").trim()
  if (!rewardEventId || rewardEventId.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(rewardEventId)) return reply({ ok: false, error: "INVALID_REWARD_EVENT_ID" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "REWARD_SETTLEMENT_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_creator_reward_settle_funded`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_reward_event_id: rewardEventId }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const upstreamError = typeof result?.error === "string" ? result.error : ""
      const conflictErrors = new Set(["REWARD_EVENT_NOT_FOUND", "APPROVED_FUNDED_GHC_REWARD_REQUIRED", "INSUFFICIENT_BALANCE", "TRANSFER_LIMIT_EXCEEDED", "ACCOUNT_RESTRICTED", "BLOCKED_USER"])
      const error = conflictErrors.has(upstreamError) ? upstreamError : "REWARD_SETTLEMENT_FAILED"
      const status = conflictErrors.has(upstreamError) ? 409 : 503
      return reply({ ok: false, error, retryable: status === 503 }, status)
    }
    return reply({ ok: true, movementId: result.movementId, amount: result.amount, currency: "GHC", status: "settled", idempotent: Boolean(result.idempotent) })
  } catch {
    return reply({ ok: false, error: "REWARD_SETTLEMENT_UNAVAILABLE", retryable: true }, 503)
  }
}
