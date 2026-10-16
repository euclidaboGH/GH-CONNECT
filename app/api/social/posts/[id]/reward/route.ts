/**
 * GET /api/social/posts/[id]/reward
 * Public content-reward view. Amounts only from server-written state.
 * No mutation handlers — clients cannot set rewards (use system upsert RPC only).
 */
import { NextResponse } from "next/server"
import { getPublicContentReward } from "@/lib/server/content-reward/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const reward = await getPublicContentReward(postId)
  return NextResponse.json(reward)
}
