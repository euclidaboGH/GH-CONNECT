/** Durable marketplace saves — authenticated user only. */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RpcResult = Record<string, unknown> | null

async function rpc(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: RpcResult }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify(body), cache: "no-store",
    })
    const data = await response.json().catch(() => null) as RpcResult
    return { ok: response.ok && Boolean(data), data }
  } catch { return { ok: false, data: null } }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = checkRateLimit(`marketplace-saves:${auth.userId}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } })
  const url = new URL(request.url)
  const raw = Number(url.searchParams.get("limit") || 50)
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.floor(raw))) : 50
  const result = await rpc("gh_marketplace_saved_listings_list", { p_user_id: auth.userId, p_limit: limit })
  if (!result.ok || result.data?.ok === false) return NextResponse.json({ ok: false, error: "MARKETPLACE_SAVES_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, durable: true, saved: Array.isArray(result.data?.saved) ? result.data.saved : [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`marketplace-save-write:${auth.userId}`, 40, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } })
  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const listingId = String(body.listingId || body.id || "").trim()
  if (!listingId || listingId.length > 160 || /[\u0000-\u001f\u007f]/.test(listingId)) return NextResponse.json({ ok: false, error: "INVALID_LISTING_ID" }, { status: 400 })
  const result = await rpc("gh_marketplace_saved_listing_toggle", { p_user_id: auth.userId, p_listing_id: listingId })
  if (!result.ok || result.data?.ok === false) {
    const error = String(result.data?.error || "MARKETPLACE_SAVE_FAILED")
    return NextResponse.json({ ok: false, error }, { status: error === "LISTING_NOT_FOUND" ? 404 : 503 })
  }
  return NextResponse.json({ ok: true, durable: true, saved: Boolean(result.data?.saved), listingId }, { headers: { "Cache-Control": "no-store" } })
}
