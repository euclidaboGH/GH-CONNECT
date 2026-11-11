import assert from "node:assert/strict"
import { isSafeInternalNotificationPath, resolveNotificationDeepLinkFromRecord, sanitizeNotificationDeepLink } from "../lib/notification-targets.ts"

const cases = [
  ["post notification opens exact post", { type: "post_like", data: { eventType: "post_like", postId: "post-1" } }, { open: "feed", tab: "home", section: "post", postId: "post-1" }],
  ["comment notification opens exact comment", { type: "post_comment", data: { eventType: "post_comment", postId: "post-1", commentId: "comment-1", parentId: "root-1" } }, { open: "feed", tab: "home", section: "comments", postId: "post-1", commentId: "comment-1", parentId: "root-1" }],
  ["reply opens the response in its thread", { type: "comment_reply", data: { eventType: "comment_reply", postId: "post-2", commentId: "reply-2", parentId: "comment-2", threadRootId: "comment-2" } }, { open: "feed", section: "comments", commentId: "reply-2", parentId: "comment-2", threadRootId: "comment-2" }],
  ["marketplace listing opens listing", { type: "marketplace_listing", data: { eventType: "marketplace_listing_created", listingId: "listing-1" } }, { open: "marketplace", section: "listing", listingId: "listing-1" }],
  ["marketplace order opens order", { type: "marketplace_order", data: { eventType: "marketplace_order_paid", orderId: "order-1", listingId: "listing-1" } }, { open: "marketplace", section: "order", orderId: "order-1", listingId: "listing-1" }],
  ["marketplace response preserves exact timeline action and time", { type: "marketplace_order", data: { eventType: "marketplace_order_response", orderId: "order-2", responseAction: "seller_dispatch", responseAt: 1794410000000, deepLink: { open: "marketplace", section: "order", orderId: "order-2", responseAction: "seller_dispatch", responseAt: 1794410000000 } } }, { open: "marketplace", orderId: "order-2", responseAction: "seller_dispatch", responseAt: 1794410000000 }],
  ["listing-linked social comment still opens the exact post response", { type: "comment", data: { eventType: "post_comment", listingId: "listing-2", postId: "post-2", commentId: "comment-2" } }, { open: "feed", section: "comments", postId: "post-2", commentId: "comment-2" }],
  ["marketplace response event opens the order or listing", { type: "marketplace_comment", data: { eventType: "marketplace_listing_response", listingId: "listing-2" } }, { open: "marketplace", section: "listing", listingId: "listing-2" }],
  ["marketplace payment receipt opens its exact order", { type: "marketplace_order", data: { eventType: "marketplace_payment_completed", orderId: "order-paid-1", deepLink: { open: "marketplace", section: "order", orderId: "order-paid-1" } } }, { open: "marketplace", section: "order", orderId: "order-paid-1" }],
  ["Pi payment opens its payment intent", { type: "payment", data: { eventType: "pi_payment_completed", paymentIntentId: "intent-1", transactionId: "tx-1", deepLink: { open: "wallet", section: "payment", paymentIntentId: "intent-1" } } }, { open: "wallet", section: "payment", paymentIntentId: "intent-1", transactionId: "tx-1" }],
  ["GHC transfer opens its ledger reference", { type: "ghc_received", data: { eventType: "GHC_RECEIVED", referenceId: "ledger-1" } }, { open: "wallet", section: "transaction", transactionId: "ledger-1", referenceId: "ledger-1" }],
  ["daily claim opens reward history", { type: "reward", data: { eventType: "GHC_REWARD_CLAIMED", referenceId: "claim-1", rewardId: "claim-1", deepLink: { open: "rewards", tab: "rewards", section: "history", rewardId: "claim-1" } } }, { open: "rewards", section: "history", rewardId: "claim-1" }],
  ["transfer request opens wallet requests", { type: "system", data: { open: "requests", requestId: "request-1" } }, { open: "wallet", section: "transfer-request", requestId: "request-1" }],
  ["message opens exact conversation", { type: "message", data: { conversationId: "conversation-1", userId: "user-2" } }, { open: "chat", section: "conversation", conversationId: "conversation-1", userId: "user-2" }],
  ["system security notice may open settings", { type: "system", data: { category: "system", open: "settings", section: "security" } }, { open: "settings", tab: "settings", section: "security" }],
]

let passed = 0
for (const [name, input, expected] of cases) {
  const actual = resolveNotificationDeepLinkFromRecord(input)
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${name}: ${key}`)
  passed += 1
  console.log(`PASS ${name}`)
}

const blockedSettings = resolveNotificationDeepLinkFromRecord({ type: "comment", data: { postId: "post-3", deepLink: { open: "settings", tab: "settings" } } })
assert.equal(blockedSettings.open, "feed")
assert.equal(blockedSettings.postId, "post-3")
passed += 1
console.log("PASS social targets cannot be redirected into Settings")

const invalid = sanitizeNotificationDeepLink({ open: "wallet", transactionId: "https://evil.example/redirect", paymentIntentId: "intent-safe" })
assert.equal(invalid.transactionId, undefined)
assert.equal(invalid.paymentIntentId, "intent-safe")
passed += 1
console.log("PASS URL-like target identifiers are rejected")

const control = sanitizeNotificationDeepLink({ open: "wallet", requestId: "req\nattack", orderId: "order-safe" })
assert.equal(control.requestId, undefined)
assert.equal(control.orderId, "order-safe")
passed += 1
console.log("PASS control-character identifiers are rejected")

assert.equal(isSafeInternalNotificationPath("/wallet?tab=activity"), true)
assert.equal(isSafeInternalNotificationPath("/\\evil.example"), false)
assert.equal(isSafeInternalNotificationPath("//evil.example"), false)
assert.equal(isSafeInternalNotificationPath("/%2f%2fevil.example"), false)
assert.equal(isSafeInternalNotificationPath("https://evil.example"), false)
passed += 1
console.log("PASS announcement action paths are restricted to safe same-origin routes")

const unknown = resolveNotificationDeepLinkFromRecord({ type: "system", data: { title: "A new GreenHaven update" } })
assert.equal(unknown.open, "feed")
passed += 1
console.log("PASS unknown notification falls back to Home, not Settings")

console.log(`Run #289 notification target tests: ${passed}/${passed} passed`)
