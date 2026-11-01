/**
 * GET  /api/messaging/conversations — list for authenticated user
 * POST /api/messaging/conversations — create direct thread { otherUserId }
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  listConversationsForUser,
  createDirectConversation,
  isMessagingStoreDurable,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const url = new URL(request.url)
    const rawLimit = Number(url.searchParams.get("limit") || "50")
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50))
    // Ignore client userId
    void url.searchParams.get("userId")

    const items = await listConversationsForUser(auth.userId, {
      limit: Number.isFinite(limit) ? limit : 50,
    })
    return NextResponse.json(
      {
        ok: true,
        durable: isMessagingStoreDurable(),
        conversations: items,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/conversations GET]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "LIST_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const rl = checkRateLimit(`conversation-create:${auth.userId}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
    }
    const parsed = await readBoundedJson(request, 16 * 1024)
    if (!parsed.ok) {
      const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
      return NextResponse.json({ ok: false, error: parsed.error }, { status, headers: { "Cache-Control": "no-store" } })
    }
    const body = parsed.value
    const otherUserId =
      typeof body?.otherUserId === "string" ? body.otherUserId.trim() : ""
    if (!otherUserId || otherUserId.length > 180 || /[\u0000-\u001f\u007f]/.test(otherUserId) || otherUserId === auth.userId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PEER" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    // The server re-checks reciprocal blocks and the recipient's persisted privacy setting.

    const conv = await createDirectConversation({
      creatorId: auth.userId,
      otherUserId,
    })
    if (conv && "denied" in conv) {
      const status = conv.denied === "STORE_UNAVAILABLE" ? 503 : conv.denied === "PRIVACY_SETTINGS_UNCONFIGURED" ? 409 : 403
      return NextResponse.json(
        { ok: false, error: conv.denied },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (!conv) {
      return NextResponse.json(
        { ok: false, error: "CREATE_FAILED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        durable: isMessagingStoreDurable(),
        conversation: conv,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/conversations POST]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "CREATE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
