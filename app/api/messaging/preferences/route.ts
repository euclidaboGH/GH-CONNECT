import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getMessagingPreference, isMessagingStoreDurable, setMessagingPreference, type MessagingAudience, type OnlineStatusAudience } from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
const validAudience = (value: unknown): value is MessagingAudience => value === "everyone" || value === "matches-only" || value === "no-one"
const validOnlineAudience = (value: unknown): value is OnlineStatusAudience => value === "everyone" || value === "matches-only" || value === "hidden"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`messaging-preference-read:${auth.userId}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
    const preference = await getMessagingPreference(auth.userId)
    if (!preference) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: noStore })
    return NextResponse.json({ ok: true, durable: isMessagingStoreDurable(), ...preference }, { headers: noStore })
  } catch (error) {
    console.error("[messaging/preferences GET]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PREFERENCE_READ_FAILED" }, { status: 503, headers: noStore })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`messaging-preference-write:${auth.userId}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
    const contentLength = request.headers.get("content-length")
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 4096)) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: noStore })
    }
    const body = await request.json().catch(() => ({}))
    const hasWho = body?.whoCanMessage !== undefined
    const hasOnline = body?.onlineStatus !== undefined
    if ((!hasWho && !hasOnline) || (hasWho && !validAudience(body.whoCanMessage)) || (hasOnline && !validOnlineAudience(body.onlineStatus))) {
      return NextResponse.json({ ok: false, error: "INVALID_PREFERENCE" }, { status: 400, headers: noStore })
    }
    const saved = await setMessagingPreference({
      userId: auth.userId,
      ...(hasWho ? { whoCanMessage: body.whoCanMessage as MessagingAudience } : {}),
      ...(hasOnline ? { onlineStatus: body.onlineStatus as OnlineStatusAudience } : {}),
      onlyIfUnconfigured: body?.seedIfMissing === true,
    })
    if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error }, { status: 503, headers: noStore })
    const canonical = await getMessagingPreference(auth.userId)
    if (!canonical) return NextResponse.json({ ok: false, error: "PREFERENCE_READ_FAILED" }, { status: 503, headers: noStore })
    return NextResponse.json({ ok: true, durable: saved.durable, ...canonical }, { headers: noStore })
  } catch (error) {
    console.error("[messaging/preferences PATCH]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PREFERENCE_SAVE_FAILED" }, { status: 503, headers: noStore })
  }
}
