import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function list(value: string | undefined): string[] {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8)
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const limit = await checkDurableRateLimit(`call-config:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return NextResponse.json({ ok: false, error: limit.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED" }, { status: limit.unavailable ? 503 : 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec) } })

  const turnUrls = list(process.env.GH_CALL_TURN_URLS)
  const stunUrls = list(process.env.GH_CALL_STUN_URLS)
  const sharedSecret = process.env.GH_CALL_TURN_SHARED_SECRET || ""
  const enabled = process.env.GH_CALLS_ENABLED === "true" && turnUrls.length > 0 && Boolean(sharedSecret)
  if (!enabled) {
    return NextResponse.json({ ok: true, enabled: false, reason: "CALL_TRANSPORT_NOT_CONFIGURED" }, { headers: { "Cache-Control": "no-store" } })
  }

  // Coturn REST credentials: username expires after one hour; the shared secret
  // never leaves the server. Configure the same secret on the TURN server.
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const username = `${expiresAt}:${auth.userId}`
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64")
  const iceServers: RTCIceServer[] = []
  if (stunUrls.length) iceServers.push({ urls: stunUrls })
  iceServers.push({ urls: turnUrls, username, credential })
  return NextResponse.json({ ok: true, enabled: true, iceServers, expiresAt }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } })
}
