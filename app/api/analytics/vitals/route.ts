/**
 * POST /api/analytics/vitals — privacy-safe real-user vitals intake (Phase III #21).
 * Anonymous (sendBeacon cannot attach auth). Strict allowlist validation, bounded body, IP rate limit.
 * Samples are NOT persisted: no durable store is configured, so this acknowledges with durable:false.
 * Durable aggregation requires a reviewed migration and is intentionally not created here.
 * Never carries PII, URLs, or financial data.
 */
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { validateRumBatch } from "@/lib/performance-budgets"
import { readBoundedText } from "@/lib/server/http/read-bounded-text"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 4 * 1024
const headers = { "Cache-Control": "no-store" }

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || ""
  return (fwd.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 64)
}

export async function POST(request: Request) {
  const rl = checkRateLimit(`vitals:${clientKey(request)}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...headers, "Retry-After": String(rl.retryAfterSec) } })
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 413, headers })
  const boundedBody = await readBoundedText(request, MAX_BODY_BYTES)
  if (!boundedBody.ok) return NextResponse.json({ ok: false, error: boundedBody.error === "REQUEST_TOO_LARGE" ? "TOO_LARGE" : "INVALID" }, { status: boundedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers })
  const raw = boundedBody.text
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 413, headers })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400, headers }) }
  const result = validateRumBatch(body)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400, headers })
  return NextResponse.json({ ok: true, accepted: result.samples.length, durable: false }, { status: 202, headers })
}
