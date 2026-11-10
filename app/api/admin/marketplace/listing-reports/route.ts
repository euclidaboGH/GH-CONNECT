/** Operator-only marketplace listing report queue and review transitions. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "x-ghc-operator-key",
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS })
}

function authorized(request: Request): boolean {
  const configured = String(process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_ADMIN_API_KEY || process.env.GHC_A2U_ADMIN_KEY || "").trim()
  const supplied = String(request.headers.get("x-ghc-operator-key") || "")
  const expectedBytes = Buffer.from(configured, "utf8")
  const suppliedBytes = Buffer.from(supplied, "utf8")
  return expectedBytes.length >= 32 && suppliedBytes.length === expectedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

function databaseConfig() {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  return { baseUrl: env.supabaseUrl.replace(/\/$/, ""), key: env.supabaseServiceRoleKey }
}

export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rate = await checkDurableRateLimit("operator-marketplace-report-list", 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))

  const config = databaseConfig()
  if (!config) return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
  const url = new URL(request.url)
  const status = url.searchParams.get("status") || "open"
  if (!new Set(["open", "reviewing", "resolved", "dismissed", "all"]).has(status)) {
    return reply({ ok: false, error: "INVALID_STATUS" }, 400)
  }
  const limitInput = Number(url.searchParams.get("limit") || 50)
  const limit = Number.isFinite(limitInput) ? Math.min(100, Math.max(1, Math.floor(limitInput))) : 50
  const params = new URLSearchParams({
    select: "id,listing_id,seller_id,reporter_id,reason,note,status,created_at,updated_at,resolved_at,resolver_id",
    order: "created_at.desc",
    limit: String(limit),
  })
  if (status !== "all") params.set("status", `eq.${status}`)

  try {
    const response = await fetch(`${config.baseUrl}/rest/v1/gh_marketplace_listing_reports?${params.toString()}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    })
    const reports = await response.json().catch(() => null)
    if (!response.ok || !Array.isArray(reports)) return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
    return reply({ ok: true, durable: true, reports })
  } catch {
    return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rate = await checkDurableRateLimit("operator-marketplace-report-review", 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))

  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const reportId = typeof parsed.value.reportId === "string" ? parsed.value.reportId.trim() : ""
  const status = typeof parsed.value.status === "string" ? parsed.value.status.trim().toLowerCase() : ""
  if (!reportId || reportId.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(reportId) || !new Set(["reviewing", "resolved", "dismissed"]).has(status)) {
    return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  }

  const config = databaseConfig()
  if (!config) return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${config.baseUrl}/rest/v1/rpc/gh_marketplace_listing_report_transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.key, Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ p_report_id: reportId, p_resolver_id: "operator", p_status: status }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "MARKETPLACE_REPORT_REVIEW_UNAVAILABLE")
      const statusCode = error === "REPORT_NOT_FOUND" ? 404 : error === "REPORT_ALREADY_CLOSED" ? 409 : error === "INVALID_STATUS" || error === "INVALID_INPUT" ? 400 : 503
      return reply({ ok: false, error }, statusCode)
    }
    return reply({ ok: true, durable: true, reportId: String(result.id || reportId), status: String(result.status || status), idempotent: Boolean(result.idempotent) })
  } catch {
    return reply({ ok: false, error: "MARKETPLACE_REPORT_REVIEW_UNAVAILABLE" }, 503)
  }
}
