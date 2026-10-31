/**
 * GET  /api/social/saves — list saved post ids for session user
 * POST /api/social/saves — { postId } toggle save for session user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Saved posts", { postIds: [], count: 0 })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }
  const env = readGhcServerEnv()
  const base = env.supabaseUrl!.replace(/\/$/, "")
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 50) || 50))
  try {
    const params = new URLSearchParams({
      select: "post_id,created_at",
      user_id: `eq.${auth.userId}`,
      order: "created_at.desc",
      limit: String(limit),
    })
    const res = await fetch(`${base}/rest/v1/gh_saves?${params}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey!,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { ok: false, durable: false, error: "SAVES_LIST_FAILED", message: errText.slice(0, 120) },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }
    const rows = (await res.json().catch(() => [])) as Array<{ post_id?: string; created_at?: string }>
    const postIds = Array.isArray(rows)
      ? rows.map((r) => String(r.post_id || "").trim()).filter(Boolean)
      : []
    return NextResponse.json(
      { ok: true, durable: true, postIds, count: postIds.length },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { ok: false, durable: false, error: "SAVES_LIST_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`save:${auth.userId}`, 40, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const parsedBody = await readBoundedJson(request, 4096)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const postId = (typeof body.postId === "string" ? body.postId : "").trim()
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "POST_REQUIRED" }, { status: 400 })
  }
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Save post")
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_save_toggle", {
    p_user_id: auth.userId,
    p_post_id: postId,
  })
  const data = result.data as { ok?: boolean; saved?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    const err = String(data?.error || result.error || "SAVE_FAILED")
    if (/_HTTP_404$/.test(err) || result.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          error: "SOCIAL_RPC_UNAVAILABLE",
          diagnosticCode: result.diagnosticCode || null,
          diagnosticMessage: result.diagnosticMessage || null,
          message: "Save RPC is not installed. Apply supabase migration 20261022010099_ENSURE_social_engagement_rpcs.sql",
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { ok: false, error: err },
      { status: data?.error === "NOT_FOUND" ? 404 : data?.error === "FORBIDDEN" ? 403 : 503 }
    )
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    saved: Boolean(data?.saved),
  })
}
