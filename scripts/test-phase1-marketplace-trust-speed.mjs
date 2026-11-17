import assert from "node:assert/strict"
import { assessReviews, featuredReviews, summarizeVerifiedRatings, isVerifiedReview } from "../lib/marketplace/review-quality.ts"
import { computeLandedCost, formatLandedCostLine } from "../lib/marketplace/landed-cost.ts"
import { stockBadge, deliveryBadge, sellerTrustBadges } from "../lib/marketplace/listing-badges.ts"
import { sellerChecklist, checklistProgress } from "../lib/marketplace/seller-checklist.ts"

// Reviews
const rv = (id, o = {}) => ({ id, orderId: `o-${id}`, reviewerId: `u-${id}`, rating: 5, text: "Arrived quickly and exactly as described.", createdAt: Number(id.replace(/\D/g, "")) || 1, ...o })
assert.equal(isVerifiedReview(rv("1")), true)
assert.equal(isVerifiedReview(rv("2", { orderId: "" })), false, "no order id is not verified")
assert.equal(isVerifiedReview(rv("3", { orderId: null })), false)
const list = [
  rv("1"),
  rv("2", { text: "Ok" }),
  rv("3", { text: "!!!!!!!!!!!!" }),
  rv("4", { text: "aaaaaaaaaaaa" }),
  rv("5", { orderId: null }),
  rv("6", { reviewerId: "u-6", text: "Arrived quickly and exactly as described." }),
  rv("7", { reviewerId: "u-6", text: "  ARRIVED quickly and EXACTLY as described. " }),
]
const assessed = assessReviews(list)
assert.deepEqual(assessed[1].flags, ["too_short"])
assert.ok(assessed[2].flags.includes("no_letters"))
assert.ok(assessed[3].flags.includes("repeated_characters"))
assert.ok(assessed[4].flags.includes("unverified"))
assert.ok(assessed[6].flags.includes("duplicate_text"), "same reviewer duplicate text is flagged after normalization")
assert.equal(assessed[5].featured, true, "different reviewer with same wording is not a duplicate")
const featured = featuredReviews(list, 3)
assert.ok(featured.length <= 3)
assert.ok(featured.every((r) => isVerifiedReview(r)))
assert.equal(featuredReviews(list, -5).length, 0, "invalid limits are bounded")
assert.equal(featuredReviews([], 3).length, 0)
const sum = summarizeVerifiedRatings([...list, rv("8", { rating: 99 }), rv("9", { rating: NaN }), rv("10", { rating: 3 })])
assert.equal(sum.count, 7, "unverified and invalid ratings are excluded")
assert.equal(sum.distribution[3], 1)
assert.equal(summarizeVerifiedRatings([]).average, 0)
assert.equal(list[1].text, "Ok", "inputs are never mutated")

// Landed cost
let c = computeLandedCost({ unitPrice: 10, quantity: 3, currency: "PI", shippingFee: 1.5 })
assert.equal(c.total, 31.5)
c = computeLandedCost({ unitPrice: 0.1, quantity: 3, currency: "GHC", shippingFee: 0.2 })
assert.equal(c.total, 0.5, "no floating-point drift")
c = computeLandedCost({ unitPrice: 10, quantity: 1, currency: "PI" })
assert.equal(c.total, null); assert.equal(c.shippingPending, true)
c = computeLandedCost({ unitPrice: 10, quantity: 1, currency: "PI", shippingFee: 5, shippingCurrency: "GHC" })
assert.equal(c.mixedCurrency, true); assert.equal(c.total, null, "currencies are never summed")
assert.equal(computeLandedCost({ unitPrice: -1, quantity: 1, currency: "PI" }), null)
assert.equal(computeLandedCost({ unitPrice: 1, quantity: 0, currency: "PI" }), null)
assert.equal(computeLandedCost({ unitPrice: 1, quantity: 1000, currency: "PI" }), null)
assert.equal(computeLandedCost({ unitPrice: 1, quantity: 1, currency: "PI", shippingFee: -2 }), null)
assert.equal(computeLandedCost({ unitPrice: Infinity, quantity: 1, currency: "PI" }), null)
assert.equal(formatLandedCostLine("Delivery", null, "PI"), "Delivery: confirmed at checkout")
assert.match(formatLandedCostLine("Item", 5, "PI"), /5 π/)

// Badges
assert.equal(stockBadge("service", 0), null)
assert.equal(stockBadge("product", 0).tone, "bad")
assert.equal(stockBadge("product", 2).label, "2 left")
assert.equal(stockBadge("product", 50).id, "stock-ok")
assert.equal(stockBadge("product", NaN), null)
assert.equal(deliveryBadge("shipping: DHL").label, "Shipping")
assert.equal(deliveryBadge("???"), null)
assert.deepEqual(sellerTrustBadges(null), [])
assert.ok(sellerTrustBadges({ completedOrders: 0 }).some((b) => b.id === "seller-new"))
assert.ok(sellerTrustBadges({ completedOrders: 30, reviewCount: 10, averageRating: 4.8, identityVerified: true }).some((b) => b.id === "seller-rated"))
assert.ok(!sellerTrustBadges({ completedOrders: 30, reviewCount: 2, averageRating: 5 }).some((b) => b.id === "seller-rated"), "rating badge needs enough reviews")

// Checklist
let items = sellerChecklist({ kind: "product" })
assert.equal(checklistProgress(items).requiredMet, false)
items = sellerChecklist({ kind: "product", title: "Ankara fabric", price: 5, mediaCount: 1, availability: 4, description: "x".repeat(40), category: "Fashion", deliveryMode: "shipping" })
assert.deepEqual(checklistProgress(items), { done: 7, total: 7, requiredMet: true, percent: 100 })
assert.equal(checklistProgress(sellerChecklist({ kind: "service", title: "Tutoring", price: 3 })).requiredMet, true, "services need no photo or stock")
console.log("Phase 1 marketplace trust/speed tests passed")
