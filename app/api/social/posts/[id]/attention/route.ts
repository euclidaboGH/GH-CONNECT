/**
 * POST /api/social/posts/[id]/attention
 * Durable attention measurement only — no GHC / Pi / rewards / reputation.
 * Spec: docs/GH_ATTENTION.md
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import {
  attentionWindowKey,
  clampDwellMs,
  isAttentionEventType,
  QUALIFIED_VIEW_MIN_DWELL_MS,
  type AttentionEventType,
} from "@/lib/social/attention"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Per-user burst protection (in-process; platform WAF still recommended). */
const ATTENTION_LIMIT = 90
const ATTENTION_WINDOW_MS = 60_000

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(
    `attention:${auth.userId}`,
    ATTENTION_LIMIT,
    ATTENTION_WINDOW_MS
  )
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

  let body: {
    eventType?: string
    dwellMs?: number
    // Explicitly ignore any client identity fields
    userId?: string
    actorId?: string
    viewerId?: string
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  if (!isAttentionEventType(body.eventType)) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT_TYPE" }, { status: 400 })
  }
  const eventType: AttentionEventType = body.eventType

  // Actor is session only — never body.userId / body.actorId
  const actorId = auth.userId

  const dwellMs = clampDwellMs(body.dwellMs)
  if (eventType === "qualified_view" && dwellMs != null && dwellMs < QUALIFIED_VIEW_MIN_DWELL_MS) {
    // Soft reject: do not record under-threshold qualified_view
    return NextResponse.json({
      ok: true,
      durable: false,
      recorded: false,
      eventType,
      reason: "DWELL_BELOW_THRESHOLD",
    })
  }

  const windowKey = attentionWindowKey(eventType)

  // Feed must stay usable if analytics DB is down
  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      recorded: false,
      eventType,
      windowKey,
      reason: "DB_UNAVAILABLE",
    })
  }

  // Save: authoritative toggle remains gh_save_toggle; also log attention row
  if (eventType === "save") {
    const saveResult = await socialRpc("gh_save_toggle", {
      p_user_id: actorId,
      p_post_id: postId,
    })
    const saveData = saveResult.data as { ok?: boolean; saved?: boolean; error?: string }
    // Best-effort attention log (same window dedup)
    await socialRpc("gh_content_event_record", {
      p_content_id: postId,
      p_actor_id: actorId,
      p_event_type: "save",
      p_window_key: windowKey,
      p_content_kind: "post",
      p_metadata: {},
    }).catch(() => null)

    if (!saveResult.ok || saveData?.ok === false) {
      // Non-fatal for feed; surface soft failure
      return NextResponse.json({
        ok: true,
        durable: false,
        recorded: false,
        eventType: "save",
        error: saveData?.error || saveResult.error || "SAVE_UNAVAILABLE",
      })
    }
    return NextResponse.json({
      ok: true,
      durable: true,
      recorded: true,
      eventType: "save",
      saved: Boolean(saveData?.saved),
      windowKey,
    })
  }

  const metadata: Record<string, unknown> = {}
  if (dwellMs != null) metadata.dwellMs = dwellMs

  const result = await socialRpc("gh_content_event_record", {
    p_content_id: postId,
    p_actor_id: actorId,
    p_event_type: eventType,
    p_window_key: windowKey,
    p_content_kind: "post",
    p_metadata: metadata,
  })

  const data = result.data as {
    ok?: boolean
    recorded?: boolean
    eventType?: string
    error?: string
    windowKey?: string
  }

  if (!result.ok || data?.ok === false) {
    const err = data?.error || result.error || "ATTENTION_FAILED"
    if (err === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    }
    if (err === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }
    if (err === "INVALID_EVENT_TYPE") {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT_TYPE" }, { status: 400 })
    }
    // Soft-fail: do not break feed UX
    console.info(
      JSON.stringify({
        msg: "attention_persist_failed",
        eventType,
        postIdPrefix: postId.slice(0, 8),
        error: err,
      })
    )
    return NextResponse.json({
      ok: true,
      durable: false,
      recorded: false,
      eventType,
      windowKey,
      reason: "PERSIST_FAILED",
    })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    recorded: Boolean(data?.recorded),
    eventType: data?.eventType || eventType,
    windowKey,
  })
}
