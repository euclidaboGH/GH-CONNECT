import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  listUnifiedNotifications,
  markUnifiedNotificationsRead,
  unifiedUnreadCount,
} from "@/lib/server/notifications/unified"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const url = new URL(request.url)
  if (url.searchParams.get("countOnly") === "1") {
    const result = await unifiedUnreadCount(auth.userId)
    return NextResponse.json({ ok: result.ok, durable: result.ok, unreadCount: Number(result.data ?? 0) || 0, error: result.error })
  }
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 60) || 60))
  const beforeCreatedAt = url.searchParams.get("beforeCreatedAt")
  const beforeId = url.searchParams.get("beforeId")
  const unreadOnly = url.searchParams.get("unreadOnly") === "1"
  const result = await listUnifiedNotifications(auth.userId, { limit, beforeCreatedAt, beforeId, unreadOnly })
  const rows = result.ok && Array.isArray(result.data?.notifications) ? result.data.notifications : []
  return NextResponse.json({ ok: result.ok, durable: result.ok, notifications: rows, hasMore: Boolean(result.data?.hasMore), error: result.error })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`unified-notifications:${auth.userId}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } })
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; markAll?: boolean; action?: string }
  const all = body.markAll === true || body.action === "mark_all_read"
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : undefined
  if (!all && !ids?.length) return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 })
  const result = await markUnifiedNotificationsRead(auth.userId, { ids, all })
  return NextResponse.json({ ok: result.ok, durable: result.ok, updated: Number(result.data ?? 0) || 0, error: result.error }, { status: result.ok ? 200 : 503 })
}
