#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const cart = read("lib/marketplace/cart.ts")
ok("cart sellerName field", cart.includes("sellerName?: string"))
ok("cart unit count helper", cart.includes("getMarketplaceCartUnitCount"))
ok("cart remove by seller", cart.includes("removeMarketplaceCartItemsBySeller"))

const market = read("components/ghc/marketplace-screen.tsx")
ok("add-to-cart captures sellerName", market.includes("sellerName: sellerLabel"))
ok("checkout hard timeout 45s", market.includes("45_000"))
ok("checkout timeout human message", market.includes("Checkout timed out"))
ok("remove own listings CTA", market.includes("Remove my listings from cart"))
ok("totals exclude own listings", market.includes("for (const item of purchasableItems)"))
ok("orders load timeout 15s", market.includes("15_000") && market.includes("loadDurableOrders"))
ok("orders role empty states", market.includes("No purchases yet") && market.includes("No sales yet"))
ok("CANNOT_BUY_OWN humanized still", market.includes("humanizeClientErrorCode"))
ok("seller name on cart line", market.includes("Seller · ${item.sellerName}") || market.includes("item.sellerName"))

const app = read("components/ghc/app.tsx")
ok("bottom nav cart badge uses quantity sum", app.includes("items.reduce") && app.includes("cartBadgeCount"))

console.log("")
console.log(`Phase 2 commerce cart: ${13 - fail}/13 passed`)
process.exit(fail ? 1 : 0)
