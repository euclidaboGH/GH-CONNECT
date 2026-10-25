/**
 * POST /api/social/posts/[id]/curation
 * Body: { choice: "upvote" | "downvote" | "neutral", rewardPercentage?: number }
 * Session actor only. Vote mutation and GHC reward decision use one atomic server RPC.
 * GHPV-1A: server-derived curation weight recorded for later settlement.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { redistributeCurationReward, curationRedistributeEnabled } from "@/lib/server/curation/redistribute"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { refreshReputationIntelligence } from "@/lib/server/reputation/intelligence"
import {
  resolveWeightedVote,
  stripClientAuthority,
  inferJudgmentMode,
} from "@/lib/server/ghpv/vote-weight"
import type { CurationChoice } from "@/lib/server/ghpv/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isCurationChoice(v: string): v is CurationChoice {
  return v === "upvote" || v === "downvote" || v === "neutral"
}

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

  const rawChoice = String(body.choice || "").toLowerCase().trim()
  if (!isCurationChoice(rawChoice)) {
    return NextResponse.json({ ok: false, error: "INVALID_CHOICE" }, { status: 400 })
  }
  const choice: CurationChoice = rawChoice
  const rawPercentage = body.rewardPercentage === undefined ? 100 : Number(body.rewardPercentage)
  if (!Number.isFinite(rawPercentage) || rawPercentage < 0 || rawPercentage > 100) {
    return NextResponse.json({ ok: false, error: "INVALID_REWARD_PERCENTAGE" }, { status: 400 })
  }
  const rewardPercentage = Math.round(rawPercentage * 100) / 100

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

  // Compute reviewer weight from server-side reputation/calibration before the
  // transaction. The DB RPC atomically persists the vote, reward decision, and
  // percentage-scaled active GHPV weight; no client authority is accepted.
  // Refresh the server-owned intelligence snapshot before deriving curation power.
  // A failed refresh is not itself proof that voting must fail: a previously persisted,
  // valid snapshot may still be usable. However, never silently discard the failure.
  // Record a sanitized diagnostic so operators can distinguish RPC/schema/dependency
  // failures from a missing snapshot without exposing database details to the client.
  const intelligenceRefresh = await refreshReputationIntelligence(auth.userId)
  if (!intelligenceRefresh.ok) {
    const refreshReason = String(intelligenceRefresh.error || "REFRESH_FAILED")
    const refreshDiagnosticCode = /DB_UNAVAILABLE|SUPABASE/i.test(refreshReason)
      ? "CURATION_DATABASE_CONFIGURATION"
      : /does not exist|schema cache|PGRST202|PGRST203|POSTGREST_SCHEMA_CACHE_STALE|RPC_OR_DEPENDENCY_NOT_FOUND|SQLSTATE_(?:42883|42P01|42703)|function .* not found|relation .* does not exist/i.test(refreshReason)
        ? "CURATION_MIGRATION_NOT_READY"
        : "CURATION_INTELLIGENCE_REFRESH_FAILED"
    console.error("[curation] reputation intelligence refresh failed", {
      diagnosticCode: refreshDiagnosticCode,
      reason: refreshReason.slice(0, 180),
    })
  }

  let weightedVote: Awaited<ReturnType<typeof resolveWeightedVote>>
  try {
    weightedVote = await resolveWeightedVote({
      reviewerId: auth.userId,
      choice,
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : "CURATION_WEIGHT_UNAVAILABLE"
    if (reason === "CURATION_REVIEW_REQUIRED") {
      return NextResponse.json({ ok: false, error: reason, durable: true }, { status: 403 })
    }
    // Keep the public error stable, but distinguish deployment/configuration
    // failures in server logs so an operator can tell a missing migration or
    // service-role configuration from a genuine review hold. Never return raw
    // PostgREST messages or secrets to the client, and never fall back to a
    // client/formula-derived vote weight.
    const diagnosticCode = /DB_UNAVAILABLE|SUPABASE/i.test(reason)
      ? "CURATION_DATABASE_CONFIGURATION"
      : /does not exist|schema cache|PGRST202|function .* not found|relation .* does not exist/i.test(reason)
        ? "CURATION_MIGRATION_NOT_READY"
        : reason === "CURATION_INTELLIGENCE_UNAVAILABLE"
          ? "CURATION_SNAPSHOT_MISSING_OR_UNREADABLE"
          : "CURATION_WEIGHT_RESOLUTION_FAILED"
    console.error("[curation] authoritative weight resolution failed", {
      diagnosticCode,
      reason: reason.slice(0, 180),
    })
    return NextResponse.json({
      ok: false,
      error: "CURATION_INTELLIGENCE_UNAVAILABLE",
      diagnosticCode,
      message: diagnosticCode === "CURATION_MIGRATION_NOT_READY"
        ? "Curation services are being prepared. Please try again later."
        : diagnosticCode === "CURATION_DATABASE_CONFIGURATION"
          ? "Curation is temporarily unavailable. Please try again later."
          : "GreenHaven could not verify curation intelligence. Please try again shortly.",
      durable: false,
    }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const judgmentMode = inferJudgmentMode({})
  const result = await socialRpc("gh_post_curation_set_with_reward", {
    p_post_id: postId,
    p_user_id: auth.userId,
    p_choice: choice,
    p_percentage: rewardPercentage,
    p_curation_weight: weightedVote.effectiveWeight,
    p_judgment_mode: judgmentMode,
  })

  const data = result.data as {
    ok?: boolean
    error?: string
    choice?: string
    upvoteCount?: number
    downvoteCount?: number
    reward?: { ok?: boolean; credited?: boolean; amount?: number; reason?: string; status?: string }
    ghpv?: { ok?: boolean; weight?: number; upvoteWeight?: number; downvoteWeight?: number; independentVoters?: number; settled?: boolean; ghcMutated?: boolean }
  }

  if (!result.ok || data?.ok === false) {
    const err = String(data?.error || result.error || "CURATION_FAILED")
    if (err === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    }
    if (err === "FORBIDDEN" || err === "SELF_CURATION_FORBIDDEN" || err === "DAILY_CURATION_LIMIT" || err === "CURATION_REVIEW_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          error: err,
          message:
            err === "SELF_CURATION_FORBIDDEN"
              ? "You cannot upvote or downvote your own post."
              : err === "DAILY_CURATION_LIMIT"
                ? "Your daily curation limit has been reached. Try again tomorrow."
                : err === "CURATION_REVIEW_REQUIRED"
                  ? "Curation is temporarily limited while this activity is reviewed."
                  : "You cannot curate this post.",
        },
        { status: err === "DAILY_CURATION_LIMIT" ? 429 : 403 }
      )
    }
    if (err === "INVALID_CHOICE") {
      return NextResponse.json({ ok: false, error: "INVALID_CHOICE" }, { status: 400 })
    }
    if (result.status === 404 || result.diagnosticCode === "PGRST202" || result.diagnosticCode === "PGRST203") {
      return NextResponse.json(
        { ok: false, error: "SOCIAL_RPC_UNAVAILABLE", diagnosticCode: result.diagnosticCode || null, durable: false },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { ok: false, error: err, durable: false },
      { status: 503 }
    )
  }

  const rpcChoice = String(data.choice || choice).toLowerCase().trim()
  const finalChoice: CurationChoice = isCurationChoice(rpcChoice) ? rpcChoice : choice

  // GHPV was written by the same DB transaction as the vote and reward.
  const ghpvResult = data.ghpv
  const ghpv: Record<string, unknown> = {
    recorded: Boolean(ghpvResult?.ok),
    curationPower: weightedVote.curationPower,
    weight: Number(ghpvResult?.weight ?? (finalChoice === "neutral" ? 0 : weightedVote.effectiveWeight * rewardPercentage / 100)),
    reputationLevel: weightedVote.reputationLevel,
    maxConsensusShare: weightedVote.maxConsensusShare,
    settled: false,
    ghcMutated: false,
  }

  // Reward decision is valid only from the canonical atomic RPC. There is no
  // vote-only fallback in the final convergence architecture.
  const rewardData = data.reward
  const reward: Record<string, unknown> = rewardData
    ? {
        credited: Boolean(rewardData.credited),
        amount: Number(rewardData.amount || 0),
        reason: rewardData.reason,
        status: rewardData.status,
      }
    : { credited: false, amount: 0, reason: "NO_REWARD_FOR_NON_UPVOTE" }

  // Safe public curation notice — no JCS/weights/private calibration
  if (finalChoice === "upvote" || finalChoice === "downvote") {
    void (async () => {
      const authorId = await lookupPostAuthor(postId)
      if (!authorId || authorId === auth.userId) return
      const isUp = choice === "upvote"
      const isDown = choice === "downvote"
      if (choice === "neutral") return
      await emitSocialNotification({
        recipientUserId: authorId,
        actorUserId: auth.userId,
        type: "curation",
        entityType: "post",
        entityId: postId,
        title: isUp ? "New upvote on your post" : "New downvote on your post",
        body: isUp
          ? "Someone upvoted your post"
          : "Someone downvoted your post",
        dedupeKey: `curation:${auth.userId}:${postId}:${choice}`,
        metadata: { postId, choice, publicOnly: true, category: "social" },
      })
    })()
  }

  // Stage 4: optional balance-funded redistribution (flagged; no mint)
  let redistribute: Record<string, unknown> | undefined
  if (
    curationRedistributeEnabled() &&
    finalChoice === "upvote" &&
    rewardPercentage > 0
  ) {
    const authorId = await lookupPostAuthor(postId)
    if (authorId && authorId !== auth.userId) {
      const amount = Math.min(1, Math.max(0, (Number(rewardPercentage) / 100) * 0.1))
      if (amount > 0) {
        const red = await redistributeCurationReward({
          voterId: auth.userId,
          authorId,
          postId,
          amount,
          referenceId: `curation_redist_${postId}_${auth.userId}`,
        })
        redistribute = {
          attempted: true,
          ok: red.ok,
          credited: red.credited,
          amount: red.amount,
          reason: red.reason || red.error,
          availableBalanceAfter: (red as { availableBalanceAfter?: number }).availableBalanceAfter,
          requiredBalance: (red as { requiredBalance?: number }).requiredBalance,
          contentRewardRecorded: (red as { contentRewardRecorded?: boolean }).contentRewardRecorded,
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    contentRewardUpdated: Boolean(redistribute?.credited) || Boolean(reward?.credited),
    redistribute,
    choice: finalChoice,
    upvoteCount: data.upvoteCount ?? 0,
    downvoteCount: data.downvoteCount ?? 0,
    ghpv,
    reward,
    funding: {
      enabled: curationRedistributeEnabled(),
      balanceFunded: true,
      contributionRecorded: Boolean(redistribute?.credited),
      contentRewardRecorded: Boolean((redistribute as Record<string, unknown> | undefined)?.contentRewardRecorded),
      reason: redistribute?.reason || null,
    },
  })
}
