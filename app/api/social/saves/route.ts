/**
 * POST /api/social/saves — { postId } toggle save for session user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const postId = String(body.postId || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "POST_REQUIRED" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, saved: true })
  }
  const result = await socialRpc("gh_save_toggle", {
    p_user_id: auth.userId,
    p_post_id: postId,
  })
  const data = result.data as { ok?: boolean; saved?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "SAVE_FAILED" },
      { status: data?.error === "NOT_FOUND" ? 404 : 503 }
    )
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    saved: Boolean(data?.saved),
  })
}
