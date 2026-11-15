#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const screen = read("components/ghc/marketplace-screen.tsx")
const mapper = read("lib/marketplace/record-mappers.ts")
const release = read("lib/app-release.ts")
const truth = read("docs/PROJECT_TRUTH.md")
const manifest = read("VERIFIED_MANIFEST.txt")
const prebuild = pkg.scripts?.['prebuild:checks'] || ""
const checks = [
  ["shared listing mapper owns API record normalization", mapper.includes("mapMarketplaceListingRecord") && mapper.includes("sellerId: text(row.sellerId ?? row.seller_id)")],
  ["saved listing metadata normalization is isolated", mapper.includes("mapSavedMarketplaceListingRecord") && mapper.includes("const metadata = record(row.metadata)")],
  ["durable order mapping preserves server lifecycle and payment fields", mapper.includes("mapMarketplaceOrderRecord") && mapper.includes("paymentStatus:") && mapper.includes("deliveryStatus:") && mapper.includes("serverOrderId: id")],
  ["marketplace screen delegates saved listing mapping", screen.includes("mapSavedMarketplaceListingRecord(row)") && !screen.includes("remote.saved.map((row): MarketplaceListing")],
  ["marketplace screen delegates seller and public listing mapping", (screen.match(/mapMarketplaceListingRecord\(row\)/g) || []).length >= 2],
  ["marketplace screen delegates durable order mapping", screen.includes("mapMarketplaceOrderRecord(order)") && !screen.includes("data.orders.map((o: Record<string, unknown>)")],
  ["invalid records are discarded at the domain boundary", mapper.includes("if (!id) return null") && screen.includes("filter((row): row is MarketplaceListing => Boolean(row))")],
  ["mapping preserves explicit zero values", mapper.includes("Number.isFinite(parsed) ? parsed : fallback")],
  ["timestamp normalization accepts numeric epochs and ISO strings", mapper.includes("function timestamp(value: unknown, fallback: number)") && mapper.includes("Date.parse(value)")],
  ["saved listing mapping preserves its real updated timestamp", mapper.includes("updatedAt: row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at")],
  ["runtime tests cover listing, saved listing and order contracts", read("scripts/test-pass42-marketplace-record-mappers.mjs").includes("mapSavedMarketplaceListingRecord")],
  ["package, lockfile and app release versions agree", lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["project truth and verified manifest match active version", truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
  ["Pass 43, Pass 42 and earlier marketplace gates retain release order", prebuild.indexOf("check-pass43-domain-session-bridges") < prebuild.indexOf("check-pass42-marketplace-domain-boundary") && prebuild.indexOf("check-pass42-marketplace-domain-boundary") < prebuild.indexOf("check-pass41-marketplace-resilience")],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failures++ }
console.log(`Pass 42 marketplace domain boundary: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
