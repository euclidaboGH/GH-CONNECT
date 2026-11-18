/**
 * POST /api/field/unlock
 * Body: { code: string, label?: string }
 * Public: any browser. Issues scoped field cookie only.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import {
  buildFieldSessionCookie,
  fieldAccessConfigured,
  mintFieldToken,
  verifyFieldAccessCode,
} from "@/lib/server/field/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const rawIp = request.headers.get("x-real-ip")?.trim() || "unknown"
  const ip = /^[0-9a-fA-F:.]{1,64}$/.test(rawIp) ? rawIp : "unknown"
  const rate = await checkDurableRateLimit(`field-unlock:${ip}`, 10, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec },
      { status: durableRateLimitStatus(rate), headers: { "Cache-Control": "no-store" } },
    )
  }

  if (!fieldAccessConfigured()) {
    return NextResponse.json(
      { ok: false, error: "FIELD_DESK_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_BODY" },
      { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    )
  }
  const code = typeof parsed.value.code === "string" ? parsed.value.code : ""
  const label = typeof parsed.value.label === "string" ? parsed.value.label : undefined

  if (!verifyFieldAccessCode(code)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACCESS_CODE" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const token = mintFieldToken(label)
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "FIELD_SESSION_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const res = NextResponse.json(
    { ok: true, expiresInSec: 12 * 60 * 60 },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  )
  res.headers.append("Set-Cookie", buildFieldSessionCookie(token))
  return res
}
