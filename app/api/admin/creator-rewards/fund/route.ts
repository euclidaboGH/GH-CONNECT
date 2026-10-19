/** Privileged, explicitly allowlisted funding of the creator reward pool. Never issues GHC. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_CREATOR_REWARD_OPERATOR_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-creator-reward-operator-key") || ""), "utf8")
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
export async function POST(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("creator-reward-pool-fund", 10, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Array.isArray(body)) return reply({ ok: false, error: "INVALID_BODY" }, 400)
  const operatorId = String(body.operatorId || "").trim()
  const referenceId = String(body.referenceId || "").trim()
  const amount = Number(body.amount)
  if (!operatorId || operatorId.length > 160 || !/^[A-Za-z0-9._:-]{8,160}$/.test(referenceId) ||
      !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000 || Math.round(amount * 10_000) !== amount * 10_000) {
    return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "REWARD_POOL_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_creator_reward_pool_fund`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_operator_id: operatorId, p_amount: amount, p_reference_id: referenceId }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "REWARD_POOL_FUNDING_FAILED")
      const status = error === "INSUFFICIENT_BALANCE" || error === "TRANSFER_LIMIT_EXCEEDED" || error === "REWARD_POOL_OPERATOR_REQUIRED" ? 409 : 503
      return reply({ ok: false, error, retryable: status === 503 }, status)
    }
    return reply({ ok: true, movementId: result.movementId, amount: result.amount, currency: "GHC", idempotent: Boolean(result.idempotent), funded: true })
  } catch {
    return reply({ ok: false, error: "REWARD_POOL_FUNDING_UNAVAILABLE", retryable: true }, 503)
  }
}
