/**
 * POST /api/field/report — text-only situation / result / general report.
 * Requires field session cookie (or Authorization: Field <token>).
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { fieldTokenFromRequest } from "@/lib/server/field/access"
import { persistFieldReport, type FieldReportKind } from "@/lib/server/field/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = fieldTokenFromRequest(request)
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "FIELD_AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const rateKey = `field-report:${session.jti}`
  const rate = await checkDurableRateLimit(rateKey, 20, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec },
      { status: durableRateLimitStatus(rate), headers: { "Cache-Control": "no-store" } },
    )
  }

  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_BODY" },
      { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const kindRaw = String(parsed.value.kind || "general")
  if (!["situation", "result", "survey", "general"].includes(kindRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_KIND" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const kind = kindRaw as FieldReportKind
  const body = typeof parsed.value.body === "string" ? parsed.value.body : ""
  const locationHint = typeof parsed.value.locationHint === "string" ? parsed.value.locationHint : undefined
  const surveyId = typeof parsed.value.surveyId === "string" ? parsed.value.surveyId : undefined

  const result = await persistFieldReport({
    kind,
    body,
    label: session.label,
    locationHint,
    surveyId,
    fieldSessionJti: session.jti,
  })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      id: result.report.id,
      createdAt: result.report.createdAt,
      message: "Report received. Central desk has been notified.",
      evidenceUploadAvailable: result.report.fieldSessionJti === session.jti,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  )
}
