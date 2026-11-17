import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  listUnifiedNotifications,
  markUnifiedNotificationsRead,
  unifiedUnreadCount,
} from "@/lib/server/notifications/unified"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const privateNoStore = { "Cache-Control": "private, no-store" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: privateNoStore })
  const url = new URL(request.url)
  if (url.searchParams.get("countOnly") === "1") {
    const result = await unifiedUnreadCount(auth.userId)
    return NextResponse.json({ ok: result.ok, durable: result.ok, unreadCount: result.ok ? result.data : 0, error: result.error }, { headers: privateNoStore })
  }
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 60) || 60))
  const beforeCreatedAt = url.searchParams.get("beforeCreatedAt")
  const beforeId = url.searchParams.get("beforeId")
  const unreadOnly = url.searchParams.get("unreadOnly") === "1"
  const result = await listUnifiedNotifications(auth.userId, { limit, beforeCreatedAt, beforeId, unreadOnly })
  const rows = result.ok ? result.data.notifications : []
  const hasMore = result.ok && result.data.hasMore
  return NextResponse.json({ ok: result.ok, durable: result.ok, notifications: rows, hasMore, error: result.error }, { headers: privateNoStore })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: privateNoStore })
  const rl = checkRateLimit(`unified-notifications:${auth.userId}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...privateNoStore, "Retry-After": String(rl.retryAfterSec) } })
  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: privateNoStore })
  if (!isRecord(parsedBody.value)) return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400, headers: privateNoStore })
  const body = parsedBody.value
  const all = body.markAll === true || body.action === "mark_all_read"
  const ids = Array.isArray(body.ids) ? body.ids.filter((value): value is string => typeof value === "string").slice(0, 100) : undefined
  if (!all && !ids?.length) return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400, headers: privateNoStore })
  const result = await markUnifiedNotificationsRead(auth.userId, { ids, all })
  return NextResponse.json({ ok: result.ok, durable: result.ok, updated: result.ok ? result.data : 0, error: result.error }, { status: result.ok ? 200 : 503, headers: privateNoStore })
}
