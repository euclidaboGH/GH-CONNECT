#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")
const screen = read("components/ghc/marketplace-screen.tsx")
const mapper = read("lib/marketplace/record-mappers.ts")
const checkout = read("lib/marketplace/checkout-contract.ts")
const listingStore = read("lib/server/marketplace/listing-store.ts")
const listingRoute = read("app/api/marketplace/listings/route.ts")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const release = read("lib/app-release.ts")
const truth = read("docs/PROJECT_TRUTH.md")
const manifest = read("VERIFIED_MANIFEST.txt")
const prebuild = pkg.scripts?.['prebuild:checks'] || ""
const verify = pkg.scripts?.["verify:static"] || ""
const checks = [
  ["payment rail is derived from server-created order currency", /getMarketplaceOrderCurrency\(created\.order\)/.test(screen)],
  ["single-purchase idempotency key is unique per intent and retained across uncertain retry", /idempotencyKeyRef\.current \|\| `buy_\$\{nonce\}`/.test(screen) && /idempotencyKeyRef\.current = null/.test(screen)],
  ["single-item Pi checkout uses authoritative order currency", /if \(authoritativeCurrency === "PI"\)/.test(screen)],
  ["single-item GHC checkout is only reached after authoritative currency validation", /if \(!authoritativeCurrency\)[\s\S]*?socialPayMarketplaceOrder\(orderId, "ghc"\)/.test(screen)],
  ["cart order reservations retain authoritative currency", /currency: MarketplaceCurrency \| null/.test(screen) && /created\.push\(\{ id, item, currency \}\)/.test(screen)],
  ["cart Pi and GHC orders are partitioned by durable order currency", /created\.filter\(\(\{ currency \}\) => currency === "PI"\)/.test(screen) && /created\.filter\(\(\{ currency \}\) => currency === "GHC"\)/.test(screen)],
  ["unsupported/missing order currency stops payment and warns to inspect Orders", /server did not return a supported currency\. Open Orders before retrying/.test(screen)],
  ["missing listing inventory fails closed to zero", /availability: number\(row\.availability, 0\)/.test(mapper)],
  ["remote listing hydration preserves explicit zero stock", /Math\.max\(0, Math\.floor\(Number\(row\.availability\)\)\) : 0/.test(screen)],
  ["seller centre exposes editable stock quantity", screen.includes("Base / shared stock fallback") && /availability=\{sellAvailability\}/.test(screen)],
  ["seller stock accepts explicit zero and bounded whole quantities", /availabilityNum < 0 \|\| availabilityNum > 9999/.test(screen)],
  ["seller edit preserves and submits selected stock", /setSellAvailability\(String\(Math\.max\(0, Math\.floor\(Number\(listing\.availability\)/.test(screen) && /availability: availabilityNum/.test(screen)],
  ["server stock parser preserves zero and rejects coercion", /parseMarketplaceAvailability/.test(checkout) && /typeof value !== "number" \|\| !Number\.isSafeInteger\(value\)/.test(checkout)],
  ["omitted stock on listing edit preserves existing durable quantity", /parseMarketplaceAvailability\(body\.availability, existing\?\.availability \?\? 1\)/.test(listingRoute)],
  ["shipping instructions are persisted in listing metadata", /meta\.shippingInfo = String\(input\.shippingInfo\)/.test(listingStore) && /shippingInfo: shippingInfo \|\| undefined/.test(listingStore)],
  ["shipping instructions are returned through listing API projection", /shippingInfo: l\.shippingInfo \|\| ""/.test(listingStore) && /shippingInfo,/.test(listingRoute)],
  ["remote listing detail hydrates durable delivery instructions", /shippingInfo: row\.shippingInfo \? String\(row\.shippingInfo\) : undefined/.test(screen)],
  ["checkout contract runtime tests are registered in build and static gates", prebuild.includes("check-phase9-marketplace-transformation.mjs") && prebuild.includes("test-phase9-marketplace-contracts.mjs") && verify.includes("check-phase9-marketplace-transformation.mjs") && verify.includes("test-phase9-marketplace-contracts.mjs")],
  ["release package and lockfile versions agree", pkg.version === lock.version && pkg.version === lock.packages?.[""]?.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["release truth and migration inventory version agree", truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
]
let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
  if (!ok) failures++
}
console.log(`\nPhase 9 Marketplace transformation: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
