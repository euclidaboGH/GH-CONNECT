/**
 * GET  /api/communities — list public communities
 * POST /api/communities — create (owner = session user)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId() {
  return `com_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  // Listing public communities may be useful pre-auth; still prefer session when present
  void auth

  if (!socialDbConfigured()) {
    return NextResponse.json(
      { ok: true, durable: false, communities: [] },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") || 50), 1),
    100
  )
  const result = await socialRpc("gh_community_list_public", { p_limit: limit })
  const data = result.data as { communities?: unknown[] }
  return NextResponse.json(
    {
      ok: true,
      durable: result.ok,
      communities: Array.isArray(data?.communities) ? data.communities : [],
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  if (!name || name.length > 80) {
    return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 })
  }

  const privacy = ["public", "private", "invite-only"].includes(String(body.privacy || ""))
    ? String(body.privacy)
    : "public"

  const row = {
    id: String(body.id || "").trim() || genId(),
    name,
    purpose: String(body.purpose || "").slice(0, 200),
    description: String(body.description || "").slice(0, 2000),
    category: String(body.category || "general").slice(0, 40),
    privacy,
    createdBy: auth.userId,
    coverImage: body.coverImage ? String(body.coverImage).slice(0, 2000) : null,
    rules: Array.isArray(body.rules) ? body.rules.slice(0, 20) : [],
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
    welcomeMessage: String(body.welcomeMessage || "").slice(0, 500),
    conversationId: body.conversationId ? String(body.conversationId) : null,
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, community: row })
  }

  const result = await socialRpc("gh_community_create", { p_row: row })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "CREATE_FAILED" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, durable: true, community: row })
}
