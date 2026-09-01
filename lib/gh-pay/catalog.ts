import type { GhPayProduct } from "./types"

/**
 * GH Pay product catalog — single source for U2A / A2U commerce.
 * Amounts are in π; adjust without changing payment plumbing.
 */
export const GH_PAY_CATALOG: Record<string, GhPayProduct> = {
  // —— User → GreenHaven (U2A) ——
  membership_vip_monthly: {
    id: "membership_vip_monthly",
    direction: "u2a",
    category: "membership",
    title: "VIP · Monthly",
    description: "Priority discovery, boosts, elevated media",
    amountPi: 1,
    memo: "GreenHaven VIP (1 month)",
    fulfillment: { type: "membership", tier: "vip", period: "monthly" },
    active: true,
  },
  membership_vip_yearly: {
    id: "membership_vip_yearly",
    direction: "u2a",
    category: "membership",
    title: "VIP · Yearly",
    description: "VIP for 12 months",
    amountPi: 10,
    memo: "GreenHaven VIP (12 months)",
    fulfillment: { type: "membership", tier: "vip", period: "yearly" },
    active: true,
  },
  membership_vvip_monthly: {
    id: "membership_vvip_monthly",
    direction: "u2a",
    category: "membership",
    title: "VVIP · Monthly",
    description: "Elite access, creator tools, max media",
    amountPi: 3,
    memo: "GreenHaven VVIP (1 month)",
    fulfillment: { type: "membership", tier: "vvip", period: "monthly" },
    active: true,
  },
  membership_vvip_yearly: {
    id: "membership_vvip_yearly",
    direction: "u2a",
    category: "membership",
    title: "VVIP · Yearly",
    description: "VVIP for 12 months",
    amountPi: 28,
    memo: "GreenHaven VVIP (12 months)",
    fulfillment: { type: "membership", tier: "vvip", period: "yearly" },
    active: true,
  },
  profile_boost: {
    id: "profile_boost",
    direction: "u2a",
    category: "boost",
    title: "Profile boost",
    description: "24h discovery priority",
    amountPi: 0.5,
    memo: "GreenHaven profile boost (24h)",
    fulfillment: { type: "boost", target: "profile", hours: 24 },
    active: true,
  },
  post_boost: {
    id: "post_boost",
    direction: "u2a",
    category: "boost",
    title: "Post boost",
    description: "Amplify a post in feed",
    amountPi: 0.25,
    memo: "GreenHaven post boost",
    fulfillment: { type: "boost", target: "post", hours: 12 },
    active: true,
  },
  marketplace_feature: {
    id: "marketplace_feature",
    direction: "u2a",
    category: "marketplace",
    title: "Featured listing",
    description: "Highlight a marketplace item",
    amountPi: 1,
    memo: "GreenHaven featured listing",
    fulfillment: { type: "marketplace", feature: "featured_listing" },
    active: true,
  },
  sponsored_listing_7d: {
    id: "sponsored_listing_7d",
    direction: "u2a",
    category: "sponsored_listing",
    title: "Sponsored listing · 7 days",
    description: "Sponsored placement for one week",
    amountPi: 2,
    memo: "GreenHaven sponsored listing (7d)",
    fulfillment: { type: "sponsored_listing", listingId: "", days: 7 },
    active: true,
  },
  digital_product_generic: {
    id: "digital_product_generic",
    direction: "u2a",
    category: "digital_product",
    title: "Digital product",
    description: "One-time digital good",
    amountPi: 1,
    memo: "GreenHaven digital product",
    fulfillment: { type: "digital_product", productSku: "generic" },
    active: true,
  },
  donation_community: {
    id: "donation_community",
    direction: "u2a",
    category: "donation",
    title: "Community fund",
    description: "Support GreenHaven community causes",
    amountPi: 1,
    memo: "GreenHaven community donation",
    fulfillment: { type: "donation", causeId: "community" },
    active: true,
  },
  premium_feature_unlock: {
    id: "premium_feature_unlock",
    direction: "u2a",
    category: "premium_feature",
    title: "Premium feature unlock",
    description: "Unlock a premium capability",
    amountPi: 0.5,
    memo: "GreenHaven premium feature",
    fulfillment: { type: "premium_feature", featureKey: "unlock" },
    active: true,
  },
  pipeline_verification: {
    id: "pipeline_verification",
    direction: "u2a",
    category: "verification",
    title: "Payment pipeline check",
    description: "Minimal π to verify User-to-App setup",
    amountPi: 0.01,
    memo: "GH Pay · pipeline verification",
    fulfillment: { type: "verification" },
    active: true,
  },

  // —— GreenHaven → User (A2U) — catalog entries for payouts ——
  a2u_seller_payout: {
    id: "a2u_seller_payout",
    direction: "a2u",
    category: "seller_payout",
    title: "Seller payout",
    description: "Marketplace seller settlement",
    amountPi: 0, // set per order
    memo: "GreenHaven seller payout",
    fulfillment: { type: "payout", reason: "seller_settlement" },
    active: true,
  },
  a2u_creator_earning: {
    id: "a2u_creator_earning",
    direction: "a2u",
    category: "creator_earning",
    title: "Creator earning",
    description: "Creator revenue share",
    amountPi: 0,
    memo: "GreenHaven creator earning",
    fulfillment: { type: "payout", reason: "creator_earning" },
    active: true,
  },
  a2u_refund: {
    id: "a2u_refund",
    direction: "a2u",
    category: "refund",
    title: "Refund",
    description: "Refund to pioneer",
    amountPi: 0,
    memo: "GreenHaven refund",
    fulfillment: { type: "refund", originalOrderId: "" },
    active: true,
  },
  a2u_reward_payout: {
    id: "a2u_reward_payout",
    direction: "a2u",
    category: "reward_payout",
    title: "Approved reward payout",
    description: "Platform-approved π reward",
    amountPi: 0,
    memo: "GreenHaven reward payout",
    fulfillment: { type: "payout", reason: "approved_reward" },
    active: true,
  },
}

export function getProduct(id: string): GhPayProduct | null {
  return GH_PAY_CATALOG[id] || null
}

export function listProducts(filter?: {
  direction?: "u2a" | "a2u"
  category?: string
  activeOnly?: boolean
}): GhPayProduct[] {
  return Object.values(GH_PAY_CATALOG).filter((p) => {
    if (filter?.activeOnly !== false && !p.active) return false
    if (filter?.direction && p.direction !== filter.direction) return false
    if (filter?.category && p.category !== filter.category) return false
    return true
  })
}

export function productForMembership(
  tier: "vip" | "vvip",
  period: "monthly" | "yearly"
): GhPayProduct {
  const id = `membership_${tier}_${period}`
  return GH_PAY_CATALOG[id]
}

export function productForBoost(target: "profile" | "post"): GhPayProduct {
  const id = target === "post" ? "post_boost" : "profile_boost"
  return GH_PAY_CATALOG[id]
}
