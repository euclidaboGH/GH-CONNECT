/** Durable, authenticated marketplace listing-report intake. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REASONS = new Set(["scam", "prohibited", "misleading", "counterfeit", "other"])

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie, Authorization",
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ listingId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)

  const { listingId: rawListingId } = await context.params
  const listingId = typeof rawListingId === "string" ? rawListingId.trim() : ""
  if (!listingId || listingId.length > 160 || /[\u0000-\u001f\u007f]/.test(listingId)) {
    return reply({ ok: false, error: "INVALID_LISTING_ID" }, 400)
  }

  const rate = await checkDurableRateLimit(`marketplace-listing-report:${auth.userId}`, 5, 10 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) {
    return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))
  }

  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) {
    return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  }

  const reason = typeof parsed.value.reason === "string" ? parsed.value.reason.trim().toLowerCase() : ""
  const note = typeof parsed.value.note === "string" ? parsed.value.note.trim().slice(0, 500) : ""
  if (!REASONS.has(reason)) return reply({ ok: false, error: "INVALID_REASON" }, 400)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
  }

  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_marketplace_listing_report_create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_listing_id: listingId,
        p_reporter_id: auth.userId,
        p_reason: reason,
        p_note: note || null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    })

    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "MARKETPLACE_REPORTS_UNAVAILABLE")
      const status = error === "LISTING_NOT_FOUND" ? 404
        : error === "CANNOT_REPORT_OWN_LISTING" ? 409
          : error === "INVALID_INPUT" || error === "INVALID_REASON" ? 400 : 503
      return reply({ ok: false, error }, status)
    }

    return reply({
      ok: true,
      durable: true,
      reportId: String(result.reportId || ""),
      status: String(result.status || "open"),
      duplicate: Boolean(result.duplicate),
      message: result.duplicate
        ? "Your earlier report is already recorded."
        : "Your report has been recorded for marketplace safety review.",
    }, result.duplicate ? 200 : 201)
  } catch {
    return reply({ ok: false, error: "MARKETPLACE_REPORTS_UNAVAILABLE" }, 503)
  }
}
