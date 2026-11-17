import assert from "node:assert/strict"
import { tokenizeQuery, relevanceScore, rankByRelevance } from "../lib/marketplace/search-ranking.ts"
import { isPromotedNow, promotionLabel, limitPromotedShare } from "../lib/marketplace/boost-disclosure.ts"
import { completedRevenueByCurrency, averageHoursToComplete, topSellingListings, staleListings, restockCandidates } from "../lib/marketplace/seller-insights.ts"
import { returnGuideFor, RETURN_WINDOW_DAYS } from "../lib/marketplace/returns.ts"
import { validateAddress, normalizeAddress } from "../lib/marketplace/address-validation.ts"
import { readRecentlyViewed, recordRecentlyViewed, sanitizeRecentIds, RECENTLY_VIEWED_MAX } from "../lib/marketplace/recently-viewed.ts"
import { sortMarketplaceListings } from "../lib/marketplace/order-lifecycle.ts"

const DAY = 86_400_000
const NOW = 1_800_000_000_000

// Search ranking
assert.deepEqual(tokenizeQuery("  Ankara  ANKARA fabric!! "), ["ankara", "fabric"])
assert.deepEqual(tokenizeQuery(""), [])
assert.equal(tokenizeQuery("a b c d e f g h i j k").length, 8, "token count bounded")
const L = [
  { id: "a", title: "Silk scarf", description: "ankara print", createdAt: 3 },
  { id: "b", title: "Ankara fabric roll", createdAt: 1 },
  { id: "c", title: "Chair", tags: ["ankara"], createdAt: 2 },
]
assert.deepEqual(rankByRelevance(L, "ankara").map((x) => x.id), ["b", "c", "a"])
assert.deepEqual(rankByRelevance(L, "").map((x) => x.id), ["a", "b", "c"], "empty query keeps order")
assert.equal(rankByRelevance(L, "ankara").length, L.length, "never drops results")
assert.equal(relevanceScore({ id: "z" }, "x"), 0)
assert.deepEqual(rankByRelevance([{ id: "m", createdAt: 5 }, { id: "n", createdAt: 5 }], "q").map((x) => x.id), ["m", "n"], "ties are deterministic")

// Boost disclosure
const P = (id, until, kind = "boost") => ({ id, promotedUntil: until, promotionKind: kind })
assert.equal(isPromotedNow(P("1", NOW + 1000), NOW), true)
assert.equal(isPromotedNow(P("2", NOW - 1), NOW), false, "expired promotion is not promoted")
assert.equal(isPromotedNow({ id: "3" }, NOW), false)
assert.equal(isPromotedNow(P("4", NaN), NOW), false)
assert.equal(promotionLabel(P("5", NOW + 5, "featured"), NOW), "Featured · Promoted")
assert.equal(promotionLabel(P("6", NOW - 5), NOW), null)
const page = [P("p1", NOW + 9), P("p2", NOW + 9), P("p3", NOW + 9), P("p4", NOW + 9), ...Array.from({ length: 12 }, (_, i) => ({ id: `o${i}` }))]
const limited = limitPromotedShare(page, { now: NOW })
assert.equal(limited.length, page.length, "no listing is dropped or duplicated")
assert.deepEqual([...limited.map((x) => x.id)].sort(), [...page.map((x) => x.id)].sort())
const head = limited.slice(0, 8).filter((x) => isPromotedNow(x, NOW)).length
assert.ok(head <= Math.floor(8 * 0.5), "promoted listings do not dominate the top of the page")
const positions = limited.map((x, i) => (isPromotedNow(x, NOW) ? i : -1)).filter((i) => i >= 0)
assert.ok(positions[0] >= 3, "first promoted slot respects minimum gap")
assert.deepEqual(limitPromotedShare([{ id: "x" }, { id: "y" }], { now: NOW }).map((x) => x.id), ["x", "y"])
assert.deepEqual(limitPromotedShare([], { now: NOW }), [])

// Seller insights
const O = (id, o = {}) => ({ id, listingId: "l1", status: "completed", quantity: 2, unitPrice: 5, currency: "PI", createdAt: NOW - 10 * 3_600_000, completedAt: NOW, ...o })
assert.deepEqual(completedRevenueByCurrency([O("1"), O("2", { currency: "GHC", unitPrice: 0.1, quantity: 3 }), O("3", { status: "created" }), O("4", { unitPrice: -1 }), O("5", { quantity: 0 })]), { PI: 10, GHC: 0.3 })
assert.equal(averageHoursToComplete([O("1"), O("2", { createdAt: NOW - 20 * 3_600_000 })]), 15)
assert.equal(averageHoursToComplete([]), null)
assert.deepEqual(topSellingListings([O("1"), O("2", { listingId: "l2", quantity: 5 }), O("3")], 1), [{ listingId: "l2", units: 5 }])
assert.deepEqual(topSellingListings([O("1")], -3), [])
assert.equal(staleListings([{ id: "s", status: "active", updatedAt: NOW - 90 * DAY }, { id: "f", status: "active", updatedAt: NOW - 5 * DAY }, { id: "d", status: "draft", updatedAt: NOW - 99 * DAY }], NOW).length, 1)
assert.deepEqual(restockCandidates([{ id: "r", kind: "product", status: "active", availability: 2 }, { id: "s", kind: "service", status: "active", availability: 0 }, { id: "d", kind: "product", status: "draft", availability: 0 }]).map((x) => x.id), ["r"])

// Returns guide
assert.equal(returnGuideFor({ status: "created", paymentStatus: "none", now: NOW }).stage, "not_eligible")
assert.equal(returnGuideFor({ status: "fulfilling", paymentStatus: "verified", deliveryStatus: "shipped", now: NOW }).stage, "before_delivery")
let g = returnGuideFor({ status: "fulfilling", paymentStatus: "verified", deliveryStatus: "delivered", deliveredAt: NOW - 2 * DAY, now: NOW })
assert.equal(g.stage, "return_window"); assert.equal(g.daysLeft, RETURN_WINDOW_DAYS - 2); assert.equal(g.canOpenDispute, true)
g = returnGuideFor({ status: "completed", paymentStatus: "verified", deliveryStatus: "completed", completedAt: NOW - 30 * DAY, now: NOW })
assert.equal(g.stage, "window_closed"); assert.equal(g.canOpenDispute, false)
assert.equal(returnGuideFor({ status: "refunded", now: NOW }).stage, "resolved")
assert.equal(returnGuideFor({ status: "disputed", paymentStatus: "verified", now: NOW }).canOpenDispute, false, "no second dispute while one is open")

// Address validation
let v = validateAddress({ fullName: " Ada  Obi ", line1: "12 Main St", city: "Lagos", country: "ng", phone: "+234 (801) 234-5678" })
assert.deepEqual(v.issues, []); assert.equal(v.address.country, "NG"); assert.equal(v.address.phone, "+2348012345678"); assert.equal(v.address.fullName, "Ada Obi")
assert.deepEqual(validateAddress({}).issues.sort(), ["city", "country", "fullName", "line1", "phone"])
assert.equal(normalizeAddress({ line1: "a\u0000b\nc" }).line1, "a b c", "control characters are stripped")
assert.ok(validateAddress({ fullName: "Ada", line1: "12 Main", city: "Lagos", country: "NG", phone: "123" }).issues.includes("phone"))

// Recently viewed
const store = new Map()
const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, val) => store.set(k, val) }
assert.deepEqual(readRecentlyViewed("u1", storage), [])
recordRecentlyViewed("u1", "a", storage); recordRecentlyViewed("u1", "b", storage); recordRecentlyViewed("u1", "a", storage)
assert.deepEqual(readRecentlyViewed("u1", storage), ["a", "b"], "most recent first, no duplicates")
assert.deepEqual(readRecentlyViewed("u2", storage), [], "scoped per account")
for (let i = 0; i < 30; i++) recordRecentlyViewed("u1", `id${i}`, storage)
assert.equal(readRecentlyViewed("u1", storage).length, RECENTLY_VIEWED_MAX)
assert.deepEqual(recordRecentlyViewed("u1", "bad id!", storage).includes("bad id!"), false, "invalid ids rejected")
assert.deepEqual(readRecentlyViewed("../x", storage), [], "invalid account id fails closed")
assert.deepEqual(readRecentlyViewed("u1", null), [])
store.set("gh_marketplace_recent_v1:u3", "{not json")
assert.deepEqual(readRecentlyViewed("u3", storage), [], "corrupt storage fails closed")
assert.deepEqual(sanitizeRecentIds("nope"), [])
assert.doesNotThrow(() => recordRecentlyViewed("u1", "ok", { getItem: () => null, setItem: () => { throw new Error("full") } }))

// BrowseSort relevance passthrough keeps caller order and never mixes currencies
const rows = [{ id: "1", price: 9, currency: "PI", createdAt: 1 }, { id: "2", price: 1, currency: "GHC", createdAt: 2 }]
assert.deepEqual(sortMarketplaceListings(rows, "relevance").map((r) => r.id), ["1", "2"])
console.log("Phase 2 marketplace discovery/seller tests passed")
