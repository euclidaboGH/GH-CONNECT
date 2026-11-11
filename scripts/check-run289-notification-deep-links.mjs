import { readFileSync } from "node:fs"
const read = (path) => readFileSync(path, "utf8")
const center = read("lib/notification-center.ts")
const targets = read("lib/notification-targets.ts")
const bell = read("components/ghc/notification-bell.tsx")
const app = read("components/ghc/app.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const commentsSheet = read("components/ghc/comment-sheet.tsx")
const wallet = read("features/wallet/wallet-screen.tsx")
const rewards = read("components/ghc/rewards-centre-screen.tsx")
const market = read("components/ghc/marketplace-screen.tsx")
const comments = read("app/api/social/posts/[id]/comments/route.ts")
const social = read("lib/server/social/notifications.ts")
const unified = read("lib/server/notifications/unified.ts")
const pay = read("app/api/payments/complete/route.ts")
const fulfill = read("app/api/payments/fulfill/route.ts")
const orderPay = read("app/api/marketplace/orders/[orderId]/pay/route.ts")
const orderCommerce = read("app/api/marketplace/orders/[orderId]/commerce/route.ts")
const daily = read("app/api/economy/rewards/daily/route.ts")
const transfers = read("lib/server/economy/notifications.ts")
const walletGate = read("scripts/check-wallet-upgrades-source.mjs")
const vercelHygiene = read("scripts/check-vercel-build-hygiene.mjs")
const vercelIgnore = read(".vercelignore")
const pkg = JSON.parse(read("package.json"))
const checks = [
  ["notification target resolution is centralized", center.includes("resolveNotificationDeepLinkFromRecord")],
  ["notification target sanitizer blocks URL-like IDs", targets.includes("text.includes(\"://\")") && targets.includes("sanitizeNotificationDeepLink")],
  ["announcement action paths use same-origin URL validation", targets.includes("isSafeInternalNotificationPath") && bell.includes("notificationData.durableAnnouncement && isSafeInternalNotificationPath") && read("app/api/system/announcements/route.ts").includes("!isSafeInternalNotificationPath(actionPath)")],
  ["primary notification tap opens target directly", /onClick=\{\(\) => openTarget\(n\)\}/.test(bell)],
  ["details/history has its own secondary action", /Notification details and history/.test(bell)],
  ["unified projection prevents duplicate social rows", bell.includes("social_${n.id}") && bell.includes("unifiedAvailable")],
  ["unified projection prevents duplicate economy rows", bell.includes("economy_${n.id}")],
  ["legacy read IDs strip projection prefixes", bell.includes('unifiedId.slice(7)') && bell.includes('unifiedId.slice(8)')],
  ["mark-all synchronizes only existing legacy economy read routes", bell.includes("legacyEconomyIds.map") && bell.includes("/api/economy/notifications/${encodeURIComponent(id)}/read") && !bell.includes("/api/economy/notifications/read-all")],
  ["post request event is shell-routed once", app.includes('addEventListener("ghc:open-post-request"') && feed.includes('addEventListener("ghc:open-post-ready"')],
  ["comments notify post owner and thread participants", comments.includes("lookupCommentThreadParticipants") && comments.includes("recipientIds")],
  ["social comments retain the exact post destination even for listing posts", comments.includes('open: "feed"') && comments.includes("listingId: listingId || undefined")],
  ["reply target survives app shell and feed event relays", app.includes("threadRootId") && feed.includes("threadRootId")],
  ["reply thread expands and scrolls to exact response", commentsSheet.includes("pendingFocus") && commentsSheet.includes("data-comment-id") && commentsSheet.includes("threadRootId || detail.parentId")],
  ["older comment pages load until the target response is found", commentsSheet.includes("pendingFocus.attempts >= 16") && commentsSheet.includes("append: true")],
  ["comment notifications carry post/comment/thread/listing targets", comments.includes("threadRootId") && comments.includes("listingId: listingId || undefined")],
  ["thread participant lookup is bounded and cycle-safe", social.includes("depth < 8") && social.includes("visited.has(cursor)" )],
  ["wallet target survives lazy screen mounting", app.includes("initialNotificationTarget={walletNotificationTarget}") && wallet.includes("initialNotificationTarget")],
  ["wallet history searches the payment or transaction identifier", wallet.includes("setQuery(target)") && wallet.includes("paymentIntentId ? \"pi\" : \"ghc\"")],
  ["reward history accepts claim target and survives lazy mount", rewards.includes("ghc.notification.rewards-target") && rewards.includes("data-reward-reference")],
  ["marketplace order notification focuses exact order", app.includes("initialOrderId={marketplaceOrderId}") && market.includes("data-order-id={o.id}")],
  ["marketplace response scrolls to matching timeline event", orderCommerce.includes("responseAt") && app.includes("initialResponseAt={marketplaceResponseAt}") && market.includes("data-order-event-id") && market.includes("focusAt={focusedResponseAt}")],
  ["marketplace order responses create durable recipient notification", orderCommerce.includes("createUnifiedNotification") && orderCommerce.includes("marketplace_order_response")],
  ["marketplace payment creates seller and buyer notices", orderPay.includes("notifyMarketplaceOrderPaid") && unified.includes("marketplace_order_paid") && unified.includes("marketplace_payment_completed")],
  ["marketplace payment receipts stay in the Marketplace notification bucket", bell.includes("marketplace.*payment|payment.*marketplace")],
  ["verified Pi payment completion and fulfillment create one idempotent target notification", pay.includes("notifyVerifiedPaymentIntent") && fulfill.includes("notifyVerifiedPaymentIntent") && unified.includes("pi-payment-completed:") && unified.includes("paymentIntentId: input.intent.id")],
  ["payment notice requires the authenticated intent owner and a completed state", unified.includes("input.intent.userId !== input.recipientUserId") && unified.includes('status !== "COMPLETED"') && unified.includes('status !== "FULFILLED"')],
  ["marketplace buyer and seller notices have independent stable dedupe keys", unified.includes("marketplace-order-paid:${order.id}:seller") && unified.includes("marketplace-order-paid:${order.id}:buyer")],
  ["marketplace order notice actor must be the verified buyer", unified.includes("input.actorUserId !== order.buyerId")],
  ["daily claim carries reward and transaction identifiers", daily.includes("rewardId:") && daily.includes("transactionId: atomic.transactionId")],
  ["GHC transfers carry transaction deep links", transfers.includes("deepLink: { open: \"wallet\"") && transfers.includes("transactionId: input.referenceId")],
  ["prebuild wallet copy assertion matches current UX", walletGate.includes("held for incomplete withdrawal requests")],
  ["Vercel upload excludes heavyweight caches and local secrets", vercelIgnore.includes(".next/**") && vercelIgnore.includes("node_modules/**") && vercelIgnore.includes(".env*")],
  ["Vercel cache cleanup remains root-contained", vercelHygiene.includes("cache cleanup is contained inside project root") && vercelHygiene.includes("isSymbolicLink()")],
  ["new notification tests are registered in prebuild", pkg.scripts["prebuild:checks"].includes("check-run289-notification-deep-links.mjs") && pkg.scripts["prebuild:checks"].includes("test-run289-notification-deep-links.mjs")],
  ["new notification tests are registered in pretypecheck", pkg.scripts.pretypecheck.includes("check-run289-notification-deep-links.mjs")],
  ["Vercel hygiene check is registered in prebuild and pretypecheck", pkg.scripts["prebuild:checks"].includes("check-vercel-build-hygiene.mjs") && pkg.scripts.pretypecheck.includes("check-vercel-build-hygiene.mjs")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Run #289 notification source gates: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
