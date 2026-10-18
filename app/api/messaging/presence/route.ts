import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { isMessagingStoreDurable, touchMessagingPresence } from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    const rl = checkRateLimit(`messaging-global-presence:${auth.userId}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
    const result = await touchMessagingPresence({ userId: auth.userId, action: "heartbeat" })
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 503, headers: { "Cache-Control": "no-store" } })
    return NextResponse.json({ ok: true, durable: isMessagingStoreDurable() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[messaging/global-presence]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PRESENCE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
