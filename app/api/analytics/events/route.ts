/**
 * POST /api/analytics/events — lightweight client analytics intake.
 *
 * Receives batches from lib/analytics-service.ts (fetch or navigator.sendBeacon).
 * Anonymous-safe: sendBeacon cannot attach auth headers. Validates and bounds
 * the payload, rate-limits by IP, and acknowledges. Events are NOT persisted
 * (no analytics store is configured) — this removes the 404 and is the single
 * place to add durable storage later. Never put PII or money data here.
 */
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 64 * 1024
const MAX_EVENTS = 100

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || ""
  return (fwd.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 64)
}

export async function POST(request: Request) {
  const rl = checkRateLimit(`analytics:${clientKey(request)}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 413 })
  }

  let raw = ""
  try {
    raw = await request.text()
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 })
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 })
  }

  const events = (body as { events?: unknown })?.events
  if (!Array.isArray(events)) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 })
  }

  const accepted = events
    .slice(0, MAX_EVENTS)
    .filter((e) => e && typeof e === "object" && typeof (e as { name?: unknown }).name === "string")
    .length

  return NextResponse.json(
    { ok: true, accepted, durable: false },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  )
}
