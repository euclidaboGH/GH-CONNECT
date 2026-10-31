/** Durable account export/deletion request intake. Destructive deletion is never executed by this endpoint. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = checkRateLimit(`account-lifecycle:${auth.userId}`, 5, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)

  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const requestType = typeof body.requestType === "string" ? body.requestType : ""
  const idempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotencyKey || "").trim()
  if (!["export", "deletion"].includes(requestType)) return reply({ ok: false, error: "INVALID_REQUEST_TYPE" }, 400)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) return reply({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" }, 400)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "LIFECYCLE_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_account_lifecycle_request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_user_id: auth.userId, p_request_type: requestType, p_idempotency_key: idempotencyKey }),
      cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) return reply({ ok: false, error: result?.error || "LIFECYCLE_REQUEST_UNAVAILABLE" }, response.status === 400 ? 400 : 503)
    return reply({ ok: true, requestId: result.requestId, requestType: result.requestType, status: result.status, duplicate: Boolean(result.duplicate), deletionExecuted: false, message: requestType === "deletion" ? "Deletion request recorded. Account deletion is not performed automatically; outstanding balances, disputes, and legal retention must be reviewed before completion." : "Export request recorded. The downloadable export workflow must complete before an export is marked ready." }, 202)
  } catch {
    return reply({ ok: false, error: "LIFECYCLE_SERVICE_UNAVAILABLE" }, 503)
  }
}
