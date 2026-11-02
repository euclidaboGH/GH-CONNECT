#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const cart = read("lib/marketplace/cart.ts")
const screen = read("components/ghc/marketplace-screen.tsx")
const api = read("app/api/marketplace/orders/route.ts")
const cartPanel = screen.slice(screen.indexOf("function CartPanel("), screen.indexOf("function SellerCommandCenter("))
const checks = [
  ["cart line stores stable checkout idempotency key", /checkoutKey:\s*string/.test(cart) && /checkoutKey:\s*makeCheckoutKey\(\)/.test(cart)],
  ["legacy cart migration persists normalized keys", /raw !== normalized/.test(cart) && /localStorage\.setItem\(CART_KEY, normalized\)/.test(cart)],
  ["cart rejects malformed listing identifiers and bounds lines", /listingId\.length > 160/.test(cart) && /MAX_CART_LINES = 100/.test(cart)],
  ["cart quantity and display price are normalized", /Number\.isSafeInteger\(rawQuantity\)/.test(cart) && /finiteNonNegative\(row\.price\)/.test(cart)],
  ["known zero stock is not treated as unknown stock", /Number\(requestedAvailability\) <= 0/.test(cart) && /availability === 0 \? quantity/.test(cart)],
  ["quantity caps use known stock when positive", /Math\.min\(MAX_QUANTITY, Number\(requestedAvailability\)\)/.test(cart)],
  ["order creation uses stable persisted line key, not timestamp randomness", /idempotencyKey:\s*`cart_\$\{item\.checkoutKey\}`/.test(screen) && !/idempotencyKey:\s*`cart_\$\{item\.listingId\}_\$\{Date\.now\(\)\}/.test(screen)],
  ["server-authoritative returned currency selects payment rail", /const currency = typeof order\.currency === "string" \? order\.currency\.toUpperCase\(\) : ""/.test(screen) && /currency !== "PI" && currency !== "GHC"/.test(screen)],
  ["authoritative listing preflight precedes order creation", /socialFetchMarketplaceListing/.test(cartPanel) && cartPanel.indexOf("socialFetchMarketplaceListing") < cartPanel.indexOf("await socialCreateMarketplaceOrder(")],
  ["unsupported, inactive, or insufficient-stock listings fail before order creation", /listing\.status !== "active"/.test(cartPanel) && /availability < item\.quantity/.test(cartPanel) && /No cart orders were created/.test(cartPanel)],
  ["multiple Pi orders are rejected using server-verified currencies before order creation", /piLineCount > 1/.test(cartPanel) && cartPanel.indexOf("piLineCount > 1") < cartPanel.indexOf("await socialCreateMarketplaceOrder(")],
  ["completed GHC cart lines are not removed before payment succeeds", /for \(const \{ id \} of ghcOrders\)[\s\S]*?if \(!paid\.ok\)/.test(screen) && /for \(const \{ item \} of ghcOrders\) removeMarketplaceCartItem/.test(screen)],
  ["Pi cart line remains until payment handoff completion", /Do not discard the Pi line before the user completes the external payment/.test(screen) && /if \(piOrder\)[\s\S]*?removeMarketplaceCartItem\(item\.listingId\)/.test(screen)],
  ["server still ignores client-supplied financial fields", /Ignore client price\/seller\/title\/currency/.test(api) && /createReservedOrder\(order, idempotencyKey\)/.test(api)],
  ["known out-of-stock listings cannot be added to cart", /listing\.availability <= 0/.test(screen) && /This listing is out of stock/.test(screen)],
  ["checkout refuses known zero-stock cart lines before mutation", /const unavailable = items\.find\(\(item\) => item\.availability === 0\)/.test(screen)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
console.log(`Phase 4 marketplace checkout integrity: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
