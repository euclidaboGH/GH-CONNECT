/**
 * POST /api/messaging/conversations/:id/read
 * Marks last_read_at for the authenticated member only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  markConversationRead,
  isMessagingStoreDurable,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const { conversationId } = await ctx.params
    const result = await markConversationRead({
      conversationId,
      ghUserId: auth.userId,
    })
    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : 400
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      { ok: true, durable: isMessagingStoreDurable() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/read]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "READ_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
