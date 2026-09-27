/**
 * POST /api/social/posts/[id]/curation
 * Body: { choice: "upvote" | "downvote" | "neutral" }
 * Session actor only. Quality signal — zero economy side effects.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CHOICES = new Set(["upvote", "downvote", "neutral"])

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`curation:${auth.userId}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  let body: { choice?: string; userId?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const choice = String(body.choice || "").toLowerCase().trim()
  if (!CHOICES.has(choice)) {
    return NextResponse.json({ ok: false, error: "INVALID_CHOICE" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      choice,
      upvoteCount: null,
      downvoteCount: null,
      reason: "DB_UNAVAILABLE",
    })
  }

  const result = await socialRpc("gh_post_curation_set", {
    p_post_id: postId,
    p_user_id: auth.userId,
    p_choice: choice,
  })

  const data = result.data as {
    ok?: boolean
    error?: string
    choice?: string
    upvoteCount?: number
    downvoteCount?: number
  }

  if (!result.ok || data?.ok === false) {
    const err = data?.error || result.error || "CURATION_FAILED"
    if (err === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    }
    if (err === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }
    if (err === "INVALID_CHOICE") {
      return NextResponse.json({ ok: false, error: "INVALID_CHOICE" }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      durable: false,
      choice,
      upvoteCount: null,
      downvoteCount: null,
      reason: "PERSIST_FAILED",
    })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    choice: data.choice || "neutral",
    upvoteCount: data.upvoteCount ?? 0,
    downvoteCount: data.downvoteCount ?? 0,
  })
}
