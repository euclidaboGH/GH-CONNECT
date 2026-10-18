import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  getConversationPresence,
  isMessagingStoreDurable,
  touchMessagingPresence,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }
const noStore = { "Cache-Control": "no-store" }

function validConversationId(value: string) {
  return Boolean(value && value.length <= 180 && !/[\u0000-\u001f\u007f]/.test(value))
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`messaging-presence-read:${auth.userId}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
    const { conversationId } = await ctx.params
    if (!validConversationId(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
    const presence = await getConversationPresence({ conversationId, userId: auth.userId })
    return NextResponse.json({ ok: true, durable: isMessagingStoreDurable(), presence }, { headers: noStore })
  } catch (error) {
    console.error("[messaging/presence GET]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PRESENCE_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`messaging-presence-write:${auth.userId}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
    const { conversationId } = await ctx.params
    if (!validConversationId(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
    const body = await request.json().catch(() => ({}))
    const action = body?.action
    if (action !== "heartbeat" && action !== "typing" && action !== "stop_typing") {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400, headers: noStore })
    }
    const result = await touchMessagingPresence({ userId: auth.userId, conversationId, action })
    if (!result.ok) {
      const status = result.error === "FORBIDDEN" || result.error === "BLOCKED" || result.error === "PRIVACY_RESTRICTED" || result.error === "PRESENCE_HIDDEN" ? 403 : result.error === "CONVERSATION_REQUIRED" ? 400 : 503
      return NextResponse.json({ ok: false, error: result.error }, { status, headers: noStore })
    }
    return NextResponse.json({ ok: true, durable: result.durable, presence: result.presence }, { headers: noStore })
  } catch (error) {
    console.error("[messaging/presence POST]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PRESENCE_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}
