import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { callOperationalRpc } from "@/lib/server/marketplace/operational-rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    })
  }

  const result = await callOperationalRpc("ghc_membership_get_lifecycle", {
    p_user_id: auth.userId,
    p_limit: 20,
  })
  if (!result || result.ok !== true || !Array.isArray(result.items)) {
    return NextResponse.json({ ok: false, error: "MEMBERSHIP_LIFECYCLE_UNAVAILABLE" }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    })
  }

  // Return only the authenticated account's lifecycle fields; never payment amounts.
  const items = result.items.slice(0, 20).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return []
    const row = value as Record<string, unknown>
    const eventType = String(row.event_type || "")
    const tier = String(row.tier || "")
    const createdAt = typeof row.created_at === "string" ? row.created_at : ""
    if (!new Set(["granted", "renewed", "tier_changed", "expired", "revoked", "payment_linked"]).has(eventType)) return []
    if (!new Set(["free", "vip", "vvip"]).has(tier) || !Number.isFinite(Date.parse(createdAt))) return []
    return [{
      id: typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : undefined,
      eventType,
      tier,
      source: typeof row.source === "string" ? row.source : "unknown",
      createdAt,
      expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined,
      previousExpiresAt: typeof row.previous_expires_at === "string" ? row.previous_expires_at : undefined,
    }]
  })

  return NextResponse.json({ ok: true, items, readOnly: true }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}
