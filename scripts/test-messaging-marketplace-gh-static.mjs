/**
 * Section G (messaging/communities) + H (marketplace/membership) static gates.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []
const read = (rel) => {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fails.push(`missing ${rel}`)
    return ""
  }
  return readFileSync(p, "utf8")
}

// G41 durable messaging gate
const flag = read("lib/messaging/durable-flag.ts")
if (!flag.includes("isDurableMessagingEnabled")) fails.push("durable messaging flag required")
if (!flag.includes("NEXT_PUBLIC_MESSAGING_DURABLE")) fails.push("env flag name required")
const msgStore = read("lib/server/messaging/message-store.ts")
if (!msgStore.includes("isMessagingStoreDurable")) fails.push("server isMessagingStoreDurable required")

// G42 single create community path
const comm = read("components/ghc/communities-screen.tsx")
if (!comm.includes("openCreateCommunity")) fails.push("openCreateCommunity single entry required")
const setShowTrue = (comm.match(/setShowCreate\(true\)/g) || []).length
if (setShowTrue > 1) {
  fails.push(`setShowCreate(true) should only appear in openCreateCommunity (found ${setShowTrue})`)
}
if ((comm.match(/openCreateCommunity/g) || []).length < 2) {
  fails.push("Create CTAs should call openCreateCommunity")
}

// G43 community roles
if (!existsSync(join(root, "app/api/communities/[id]/roles/route.ts"))) {
  fails.push("community roles API required")
}
const roles = read("app/api/communities/[id]/roles/route.ts")
if (!roles.includes("member") || !roles.includes("moderator") || !roles.includes("admin")) {
  fails.push("roles API must allow member/moderator/admin only")
}
if (/ALLOWED = new Set\(\[[^\]]*owner/.test(roles)) {
  fails.push("roles API must not allow client owner injection")
}
const hub = read("components/ghc/premium-community-hub.tsx")
if (!hub.includes("isMod && onCreateAnnouncement")) {
  fails.push("announcements require isMod")
}

// G44 presence optional + offline messaging
const msg = read("components/ghc/message-screen.tsx")
if (!msg.includes("isOffline")) fails.push("message screen offline handling required")
if (!msg.includes("isOnline={Boolean(selected.online)}")) {
  fails.push("presence display should remain optional for chat")
}

// H45 checkout idempotency + stock
const orders = read("app/api/marketplace/orders/route.ts")
if (!orders.includes("IDEMPOTENCY_KEY_REQUIRED")) fails.push("orders must require idempotency key")
if (!orders.includes("reserveListingStock")) fails.push("orders must reserve stock atomically")
const pay = read("app/api/marketplace/orders/[orderId]/pay/route.ts")
if (!pay.includes("validateListingStockReservation") && !pay.includes("STOCK_RESERVATION")) {
  fails.push("pay must validate stock reservation")
}

// H46 membership status from server
const mem = read("components/ghc/premium-membership-screen.tsx")
if (!mem.includes("/api/membership/status")) fails.push("membership UI must fetch /api/membership/status")
if (!mem.includes("visibilitychange") && !mem.includes("pageshow")) {
  fails.push("membership should refresh after Pi return / visibility")
}
if (!existsSync(join(root, "app/api/membership/status/route.ts"))) {
  fails.push("membership status API required")
}

// H47 seller analytics read-only
const analytics = read("app/api/marketplace/seller/analytics/route.ts")
if (!analytics.includes("authoritative")) fails.push("seller analytics should mark authoritative source")
if (!analytics.includes("unavailableMetrics")) fails.push("seller analytics must declare unavailable metrics")
if (/Math\.random|fakeRevenue|invented/i.test(analytics)) {
  fails.push("seller analytics must not invent revenue")
}

if (fails.length) {
  console.error("test-messaging-marketplace-gh-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-messaging-marketplace-gh-static: PASS")
