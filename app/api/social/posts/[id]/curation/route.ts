/**
 * POST /api/social/posts/[id]/curation
 * Body: { choice: "upvote" | "downvote" | "neutral" }
 * Session actor only. Quality signal — zero economy side effects.
 * GHPV-1A: server-derived curation weight recorded for later settlement.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import {
  resolveWeightedVote,
  stripClientAuthority,
  inferJudgmentMode,
} from "@/lib/server/ghpv/vote-weight"
import type { CurationChoice } from "@/lib/server/ghpv/types"

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

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  // GHPV-1A: never trust client identity or authority fields
  stripClientAuthority(body)

  const choice = String(body.choice || "").toLowerCase().trim()
  if (!CHOICES.has(choice)) {
    return NextResponse.json({ ok: false, error: "INVALID_CHOICE" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post curation", {
      extra: {
        choice,
        upvoteCount: null,
        downvoteCount: null,
        reason: "DB_UNAVAILABLE",
        ghpv: { recorded: false },
      },
    })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  // Authoritative actor = session only
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
    return NextResponse.json(
      { ok: false, error: err, durable: false },
      { status: 503 }
    )
  }

  const finalChoice = String(data.choice || choice) as CurationChoice

  // GHPV-1A: weighted judgment signal (not settlement, not GHC)
  let ghpv: Record<string, unknown> = { recorded: false }
  try {
    const weighted = await resolveWeightedVote({
      reviewerId: auth.userId,
      choice: finalChoice === "neutral" ? "neutral" : finalChoice,
    })
    const mode = inferJudgmentMode({})
    const rec = await socialRpc("gh_ghpv_record_curation_weight", {
      p_content_id: postId,
      p_reviewer_id: auth.userId,
      p_choice: finalChoice,
      p_weight: finalChoice === "neutral" ? 0 : weighted.effectiveWeight,
      p_judgment_mode: mode,
    })
    const recData = rec.data as { ok?: boolean; ghcMutated?: boolean }
    ghpv = {
      recorded: Boolean(rec.ok && recData?.ok !== false),
      curationPower: weighted.curationPower,
      weight: finalChoice === "neutral" ? 0 : weighted.effectiveWeight,
      reputationLevel: weighted.reputationLevel,
      maxConsensusShare: weighted.maxConsensusShare,
      settled: false,
      ghcMutated: false,
    }
  } catch {
    ghpv = { recorded: false, settled: false, ghcMutated: false }
  }

  // Safe public curation notice — no JCS/weights/private calibration
  if (finalChoice === "up" || finalChoice === "down") {
    void (async () => {
      const authorId = await lookupPostAuthor(postId)
      if (!authorId || authorId === auth.userId) return
      await emitSocialNotification({
        recipientUserId: authorId,
        actorUserId: auth.userId,
        type: "curation",
        entityType: "post",
        entityId: postId,
        title: "Community review",
        body: "Your post received a new community review.",
        dedupeKey: `curation:${auth.userId}:${postId}`,
        metadata: { postId, publicOnly: true },
      })
    })()
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    choice: finalChoice,
    upvoteCount: data.upvoteCount ?? 0,
    downvoteCount: data.downvoteCount ?? 0,
    ghpv,
  })
}
