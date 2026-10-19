/** Audited operator-only release for provider-confirmed failed/reversed transfers. Never marks paid. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_PAYOUT_RECONCILIATION_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-payout-reconciliation-key") || ""), "utf8")
  return expected.length > 0 && expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("bank-payout-exception-resolution", 10, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const { requestId } = await context.params
  if (!/^gbp_[a-f0-9]{32}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const resolution = String(body?.resolution || "")
  const note = String(body?.note || "").trim()
  if (!new Set(["release_failed_obligation", "release_reversed_obligation"]).has(resolution) || note.length < 12 || note.length > 1000) return reply({ ok: false, error: "INVALID_RESOLUTION", message: "A supported resolution and a meaningful audit note are required." }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_bank_payout_resolve_exception`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_resolution: resolution, p_operator_note: note }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || result?.ok !== true) {
      const error = String(result?.error || "BANK_PAYOUT_EXCEPTION_RESOLUTION_FAILED")
      return reply({ ok: false, error }, error === "PAYOUT_NOT_FOUND" || error === "OBLIGATION_NOT_FOUND" ? 404 : error === "PAYOUT_EXCEPTION_NOT_RESOLVABLE" || error === "OPERATOR_NOTE_REQUIRED" ? 409 : 503)
    }
    return reply({ ok: true, requestId, status: result.status, obligationStatus: result.obligationStatus, actionId: result.actionId, paid: false })
  } catch { return reply({ ok: false, error: "BANK_PAYOUT_EXCEPTION_RESOLUTION_UNAVAILABLE", retryable: true }, 503) }
}
