/**
 * Durable feed curation preferences.
 * Actor identity always comes from the authenticated request; client-supplied user IDs are ignored.
 * These preferences affect feed visibility only and never award XP, reputation, or GHC.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FEEDBACK = new Set(["show_less", "show_more", "hide"])

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: false, error: "PREFERENCES_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const result = await socialRpc("gh_post_curation_feedback_list", { p_user_id: auth.userId })
  const data = result.data as { ok?: boolean; error?: string; items?: unknown[] } | null
  if (!result.ok || data?.ok === false) {
    return NextResponse.json({ ok: false, error: data?.error || result.error || "PREFERENCES_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, items: Array.isArray(data?.items) ? data.items : [], rankingPaused: process.env.GHC_RANKING_PAUSED === "1" }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

  const rl = checkRateLimit(`curation-preferences:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } })
  }

  const parsed: unknown = await request.json().catch(() => ({}))
  const body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
  const postId = String(body.postId || "").trim()
  const feedback = String(body.feedback || "show_less").trim().toLowerCase()
  // Deliberately ignore client actor IDs and all reward/ranking score fields.
  if (!postId || postId.length > 128 || !FEEDBACK.has(feedback)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: false, durable: false, error: "PREFERENCES_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const result = await socialRpc("gh_post_curation_feedback_set", {
    p_user_id: auth.userId,
    p_post_id: postId,
    p_feedback: feedback,
  })
  const data = result.data as { ok?: boolean; error?: string; postId?: string; feedback?: string } | null
  if (!result.ok || data?.ok === false) {
    const error = String(data?.error || result.error || "PREFERENCE_SAVE_FAILED")
    const status = error === "NOT_FOUND" ? 404 : error === "OWN_POST" || error === "BLOCKED" ? 403 : error === "INVALID_INPUT" ? 400 : 503
    return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, postId: data?.postId || postId, feedback: data?.feedback || feedback }, { headers: { "Cache-Control": "no-store" } })
}


/** Reset the authenticated user's personal feed feedback; never touches votes or rewards. */
export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

  const rl = checkRateLimit(`curation-preferences-reset:${auth.userId}`, 3, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: false, error: "PREFERENCES_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const result = await socialRpc("gh_post_curation_feedback_reset", { p_user_id: auth.userId })
  const data = result.data as { ok?: boolean; error?: string; deletedCount?: number } | null
  if (!result.ok || data?.ok !== true) {
    return NextResponse.json({ ok: false, error: data?.error || result.error || "PREFERENCE_RESET_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, deletedCount: Number(data.deletedCount) || 0 }, { headers: { "Cache-Control": "no-store" } })
}
