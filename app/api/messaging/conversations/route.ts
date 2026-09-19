/**
 * GET  /api/messaging/conversations — list for authenticated user
 * POST /api/messaging/conversations — create direct thread { otherUserId }
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
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
    const limit = Number(url.searchParams.get("limit") || "50")
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
    const body = await request.json().catch(() => ({}))
    const otherUserId =
      typeof body?.otherUserId === "string" ? body.otherUserId.trim() : ""
    if (!otherUserId || otherUserId === auth.userId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PEER" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    // Block checks should be applied by higher-level domain before open;
    // still refuse empty/self.

    const conv = await createDirectConversation({
      creatorId: auth.userId,
      otherUserId,
    })
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
