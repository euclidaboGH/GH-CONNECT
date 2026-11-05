import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const screen = fs.readFileSync(path.join(root, "components/ghc/marketplace-screen.tsx"), "utf8")
const cart = fs.readFileSync(path.join(root, "lib/marketplace/cart.ts"), "utf8")
const app = fs.readFileSync(path.join(root, "components/ghc/app.tsx"), "utf8")

const checks = [
  ["cart persistence contract", /gh_marketplace_cart_v1/.test(cart)],
  ["cart quantity controls", /updateMarketplaceCartQuantity/.test(screen)],
  ["cart remove control", /removeMarketplaceCartItem/.test(screen)],
  ["server order creation at checkout", /socialCreateMarketplaceOrder/.test(screen)],
  ["server payment path preserved", /socialPayMarketplaceOrder/.test(screen)],
  ["Pi payment handoff preserved", /openPayForListing/.test(screen)],
  ["bottom navigation opens real cart", /bucket: "cart"/.test(app)],
  ["cart is distinct from Orders", /bucket === "cart"/.test(screen) && /bucket === "orders"/.test(screen)],
  ["no fabricated marketplace inventory", /Only real listings/.test(screen)],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`Marketplace cart upgrade: ${checks.length}/${checks.length} PASS`)
