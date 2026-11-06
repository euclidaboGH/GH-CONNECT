import fs from "node:fs"
const cart = fs.readFileSync("lib/marketplace/cart.ts", "utf8")
const screen = fs.readFileSync("components/ghc/marketplace-screen.tsx", "utf8")
const checks = [
  ["cart line count is bounded", cart.includes("MAX_CART_LINES = 100")],
  ["cart quantity is bounded", cart.includes("MAX_QUANTITY = 99")],
  ["stored cart lines are schema-normalized", cart.includes("normalizeCartItem") && cart.includes("normalizeCart(parsed)")],
  ["invalid price and quantity are rejected", cart.includes("price < 0") && cart.includes("!Number.isSafeInteger(quantity)")],
  ["duplicate listing ids are consolidated", cart.includes("unique.get(item.listingId)")],
  ["reserved-line cleanup preserves unrelated cart lines", cart.includes("removeMarketplaceCartItemsByIds")],
  ["cart synchronizes across browser tabs", screen.includes('window.addEventListener("storage", handler)')],
  ["cart editing is disabled while checkout runs", screen.includes("disabled={busy || item.quantity <= 1}")],
  ["server order creation and payment remain authoritative", screen.includes("socialCreateMarketplaceOrder") && screen.includes("socialPayMarketplaceOrder")],
  ["Pi checkout handoff remains intact", screen.includes("openPayForListing")],
]
let failed = 0
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`)
  if (!pass) failed++
}
if (failed) process.exit(1)
console.log(`Phase 4 marketplace cart static: ${checks.length}/${checks.length} PASS`)
