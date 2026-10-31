import type { GhcTransaction, RewardRecord } from "./economy-types"

export type GhcActivityTarget =
  | { kind: "post"; postId: string; commentId?: string }
  | { kind: "community"; communityId: string }
  | { kind: "marketplace"; listingId?: string; orderId?: string }
  | { kind: "profile"; userId: string }
  | { kind: "reward"; rewardId: string }
  | { kind: "payment"; paymentId: string }

export type GhcActivityAttribution = {
  category: "social" | "community" | "marketplace" | "membership" | "transfer" | "reward" | "payment" | "system"
  label: string
  target?: GhcActivityTarget
  related: Array<{ label: string; value: string }>
}

const clean = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined
  const s = String(v).trim()
  return s || undefined
}

function first(meta: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(meta?.[key])
    if (value) return value
  }
  return undefined
}

/**
 * Resolve a durable ledger row to the product object that caused it.
 * This is deliberately read-only: it never creates rewards or infers money.
 */
export function resolveGhcActivityAttribution(tx: GhcTransaction): GhcActivityAttribution {
  const rawMeta = tx.metadata || {}
  const correlation = rawMeta.correlation && typeof rawMeta.correlation === "object" ? rawMeta.correlation as Record<string, unknown> : {}
  const meta = { ...rawMeta, ...correlation }
  const source = String(tx.sourceEvent || "").toUpperCase()
  const postId = first(meta, ["postId", "post_id", "contentId", "content_id"])
  const commentId = first(meta, ["commentId", "comment_id"])
  const communityId = first(meta, ["communityId", "community_id", "groupId", "group_id"])
  const listingId = first(meta, ["listingId", "listing_id"])
  const orderId = first(meta, ["orderId", "order_id"]) || (/^market_order_/i.test(String(tx.referenceId || "")) ? String(tx.referenceId).replace(/^market_order_/i, "") : undefined)
  const rewardId = first(meta, ["rewardId", "reward_id"])
  const paymentId = first(meta, ["paymentId", "payment_id", "intentId", "intent_id"])
  const userId = first(meta, ["creatorId", "creator_id", "counterpartyId", "counterparty_id", "toUserId", "fromUserId"])

  const related: Array<{ label: string; value: string }> = []
  if (postId) related.push({ label: "Post", value: postId })
  if (commentId) related.push({ label: "Comment", value: commentId })
  if (communityId) related.push({ label: "Community", value: communityId })
  if (listingId) related.push({ label: "Listing", value: listingId })
  if (orderId) related.push({ label: "Order", value: orderId })
  if (rewardId) related.push({ label: "Reward", value: rewardId })
  if (paymentId) related.push({ label: "Payment", value: paymentId })

  const correlationKind = String(meta.kind || "").toLowerCase()
  const correlationEvent = String(meta.event || "").toUpperCase()
  if (correlationKind === "creator_tip") {
    return { category: "social", label: /RECEIVED/.test(correlationEvent) ? "Creator tip received" : "Creator tip sent", target: postId ? { kind: "post", postId, commentId } : userId ? { kind: "profile", userId } : undefined, related }
  }
  if (postId || commentId || /POST|COMMENT|CURATION|CONTENT|SOCIAL|CREATOR/.test(source)) {
    return { category: "social", label: commentId ? "Social comment activity" : /CURATION/.test(source) ? "Post curation" : "Social content activity", target: postId ? { kind: "post", postId, commentId } : undefined, related }
  }
  if (communityId || /COMMUNITY|GROUP/.test(source)) {
    return { category: "community", label: "Community activity", target: communityId ? { kind: "community", communityId } : undefined, related }
  }
  if (listingId || orderId || /MARKETPLACE|ORDER|LISTING/.test(source)) {
    return { category: "marketplace", label: orderId ? "Marketplace order" : "Marketplace activity", target: { kind: "marketplace", listingId, orderId }, related }
  }
  if (/PREMIUM|MEMBERSHIP/.test(source)) return { category: "membership", label: "Membership", related }
  if (/TRANSFER/.test(source) || tx.kind === "transfer_in" || tx.kind === "transfer_out" || tx.kind === "transfer_request") {
    return { category: "transfer", label: "Wallet transfer", target: userId ? { kind: "profile", userId } : undefined, related }
  }
  if (rewardId || /CLAIM|REWARD|ACHIEVEMENT|REFERRAL/.test(source)) {
    return { category: "reward", label: "Reward activity", target: rewardId ? { kind: "reward", rewardId } : undefined, related }
  }
  if (paymentId || /PI_|PAYMENT|PURCHASE/.test(source)) {
    return { category: "payment", label: "Payment activity", target: paymentId ? { kind: "payment", paymentId } : undefined, related }
  }
  return { category: "system", label: "Ledger activity", related }
}

export function resolveRewardActivityTarget(reward: RewardRecord): GhcActivityTarget | undefined {
  const ref = String(reward.referenceId || "").trim()
  const source = String(reward.sourceEvent || "").toUpperCase()
  if (!ref) return undefined
  if (/POST|COMMENT|CURATION|CONTENT|SOCIAL|CREATOR/.test(source)) return { kind: "post", postId: ref }
  if (/COMMUNITY|GROUP/.test(source)) return { kind: "community", communityId: ref }
  if (/MARKETPLACE|ORDER|LISTING/.test(source)) return { kind: "marketplace", orderId: ref.replace(/^market_order_/i, "") }
  return undefined
}

export function navigateGhcActivityTarget(target: GhcActivityTarget): boolean {
  if (typeof window === "undefined") return false
  if (target.kind === "post") {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId: target.postId, commentId: target.commentId, action: target.commentId ? "comment" : "focus" } })), 80)
    return true
  }
  if (target.kind === "community") {
    window.dispatchEvent(new CustomEvent("ghc:open-community", { detail: { groupId: target.communityId } }))
    return true
  }
  if (target.kind === "marketplace") {
    window.dispatchEvent(new CustomEvent("ghc:open-marketplace", { detail: { listingId: target.listingId || null, orderId: target.orderId || null } }))
    return true
  }
  if (target.kind === "profile") {
    window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId: target.userId } }))
    return true
  }
  if (target.kind === "reward") {
    window.dispatchEvent(new CustomEvent("ghc:open-rewards", { detail: { rewardId: target.rewardId } }))
    return true
  }
  return false
}
