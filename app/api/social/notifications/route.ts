/**
 * Social activity notifications — recipient is always session user.
 * Clients cannot create notifications or read other users' inboxes.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  listSocialNotifications,
  markSocialNotificationsRead,
  socialUnreadCount,
} from "@/lib/server/social/notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const url = new URL(request.url)
  // Ignore client userId
  void url.searchParams.get("userId")

  if (url.searchParams.get("countOnly") === "1") {
    const result = await socialUnreadCount(auth.userId)
    const count =
      result.ok && result.data ? Number(result.data.unreadCount) || 0 : 0
    return NextResponse.json({
      ok: result.ok,
      durable: result.ok,
      unreadCount: count,
      error: result.error,
    })
  }

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40) || 40))
  const before = url.searchParams.get("before")
  const beforeMs =
    before && Number.isFinite(Number(before)) ? Number(before) : null
  const unreadOnly = url.searchParams.get("unreadOnly") === "1"

  const result = await listSocialNotifications(auth.userId, {
    limit,
    beforeMs,
    unreadOnly,
  })
  const notifications =
    result.ok && result.data && Array.isArray(result.data.notifications)
      ? result.data.notifications
      : []

  return NextResponse.json({
    ok: result.ok,
    durable: result.ok,
    notifications,
    error: result.error,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    ids?: string[]
    markAll?: boolean
  }

  // No client create path — only mark read
  if (body.action === "mark_read" || body.markAll || Array.isArray(body.ids)) {
    const result = await markSocialNotificationsRead(auth.userId, {
      all: body.markAll === true || body.action === "mark_all_read",
      ids: Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : undefined,
    })
    return NextResponse.json({
      ok: result.ok,
      updated: result.data?.updated ?? 0,
      error: result.error,
    })
  }

  return NextResponse.json(
    {
      ok: false,
      error: "FORBIDDEN",
      message: "Clients cannot create social notifications.",
    },
    { status: 403 }
  )
}
