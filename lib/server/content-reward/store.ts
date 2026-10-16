/**
 * Content reward read path — service-role RPC only.
 * Never trusts client amounts. Never mints GHC from votes.
 */
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import type { ContentRewardPublic, ContentRewardStatus } from "@/lib/content-reward/public-types"

function statusLabel(s: ContentRewardStatus): string {
  switch (s) {
    case "accruing":
      return "ACCRUING"
    case "finalized":
      return "FINALIZED"
    case "distributed":
      return "DISTRIBUTED"
    case "voided":
      return "VOIDED"
    default:
      return "INACTIVE"
  }
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function inactivePublic(postId: string, votes: { up: number; down: number }, durable: boolean): ContentRewardPublic {
  return {
    ok: true,
    postId,
    enabled: false,
    status: "inactive",
    statusLabel: statusLabel("inactive"),
    totalEarned: null,
    authorReward: null,
    curationReward: null,
    upvoteImpact: null,
    downvoteImpact: null,
    netImpact: null,
    currency: "GHC",
    upvoteCount: votes.up,
    downvoteCount: votes.down,
    topContributors: [],
    durable,
    note:
      "Content rewards activate only when a platform-funded pool is allocated by the system. Votes are quality signals — they do not mint GHC by themselves.",
  }
}

async function loadVoteCounts(postId: string): Promise<{ up: number; down: number }> {
  const r = await socialRpc("gh_post_curation_counts", { p_post_id: postId })
  const d = r.data as { ok?: boolean; upvoteCount?: number; downvoteCount?: number } | null
  if (r.ok && d && d.ok !== false) {
    return {
      up: Math.max(0, Number(d.upvoteCount) || 0),
      down: Math.max(0, Number(d.downvoteCount) || 0),
    }
  }
  // Fallback: derive from GHPV snapshot if counts RPC missing
  const snap = await socialRpc("gh_ghpv_settlement_snapshot", { p_content_id: postId })
  const sd = snap.data as {
    ok?: boolean
    votes?: Array<{ choice?: string }>
  } | null
  if (snap.ok && sd && Array.isArray(sd.votes)) {
    let up = 0
    let down = 0
    for (const v of sd.votes) {
      if (v.choice === "upvote") up++
      else if (v.choice === "downvote") down++
    }
    return { up, down }
  }
  return { up: 0, down: 0 }
}

/**
 * Public reward view for a post. Amounts only from durable system-written rows.
 */
export async function getPublicContentReward(postId: string): Promise<ContentRewardPublic> {
  const id = String(postId || "").trim()
  if (!id || id.length > 128) {
    return inactivePublic("", { up: 0, down: 0 }, false)
  }

  if (!socialDbConfigured()) {
    return inactivePublic(id, { up: 0, down: 0 }, false)
  }

  const votes = await loadVoteCounts(id)

  const r = await socialRpc("gh_content_reward_get_public", { p_post_id: id })
  const d = r.data as Record<string, unknown> | null

  if (!r.ok || !d || d.ok === false) {
    // Missing RPC/table = feature not applied yet → fail-closed inactive (not an error page)
    return inactivePublic(id, votes, true)
  }

  const statusRaw = String(d.status || "inactive").toLowerCase()
  const status: ContentRewardStatus =
    statusRaw === "accruing" ||
    statusRaw === "finalized" ||
    statusRaw === "distributed" ||
    statusRaw === "voided"
      ? statusRaw
      : "inactive"

  const enabled = status !== "inactive" && status !== "voided"
  const showAmounts = status === "accruing" || status === "finalized" || status === "distributed"

  const contributorsRaw = Array.isArray(d.topContributors) ? d.topContributors : []
  const topContributors = contributorsRaw
    .slice(0, 10)
    .map((c) => {
      const row = c as Record<string, unknown>
      return {
        username: String(row.username || row.handle || "member").replace(/^@/, ""),
        amount: showAmounts ? num(row.amount) : null,
      }
    })
    .filter((c) => c.username.length > 0)

  return {
    ok: true,
    postId: id,
    enabled: Boolean(d.enabled) && enabled,
    status,
    statusLabel: statusLabel(status),
    totalEarned: showAmounts ? num(d.totalEarned ?? d.total_earned) : null,
    authorReward: showAmounts ? num(d.authorReward ?? d.author_reward) : null,
    curationReward: showAmounts ? num(d.curationReward ?? d.curation_reward) : null,
    upvoteImpact: showAmounts ? num(d.upvoteImpact ?? d.upvote_impact) : null,
    downvoteImpact: showAmounts ? num(d.downvoteImpact ?? d.downvote_impact) : null,
    netImpact: showAmounts ? num(d.netImpact ?? d.net_impact) : null,
    currency: "GHC",
    upvoteCount: Math.max(votes.up, Number(d.upvoteCount ?? d.upvote_count) || 0),
    downvoteCount: Math.max(votes.down, Number(d.downvoteCount ?? d.downvote_count) || 0),
    topContributors,
    durable: true,
    note:
      status === "inactive"
        ? "Content rewards are inactive until the system allocates a funded pool for this post."
        : status === "voided"
          ? "This content reward was voided and does not credit GHC."
          : undefined,
  }
}
