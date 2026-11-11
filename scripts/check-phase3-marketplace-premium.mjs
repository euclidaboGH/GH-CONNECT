#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const pkg = JSON.parse(read("package.json"))
const screen = read("components/ghc/marketplace-screen.tsx")
const lifecycle = read("lib/marketplace/order-lifecycle.ts")
const route = read("app/api/marketplace/listings/[listingId]/report/route.ts")
const migration = read("supabase/migrations/20261106150001_marketplace_listing_report_intake.sql")
const discovery = read("lib/marketplace/discovery-presentation.ts")
const operatorReports = read("app/api/admin/marketplace/listing-reports/route.ts")
const prebuild = pkg.scripts?.['prebuild:checks'] || ""
const verify = pkg.scripts?.["verify:static"] || ""

const checks = [
  ["marketplace browse supports product/service/opportunity filtering", /kindFilter/.test(screen) && /kind:\s*kindFilter === "all" \? undefined : kindFilter/.test(screen)],
  ["marketplace browse supports delivery-mode filtering", /deliveryFilter/.test(screen) && /parseDeliveryMode\(listing\.shippingInfo\) === deliveryFilter/.test(screen)],
  ["combined filters have a one-action clear path", /<FilterSummary/.test(screen) && /onClearAll=\{\(\) => \{ setCategory\(null\); setKindFilter\("all"\); setDeliveryFilter\("all"\); setQuery\(""\); setMinPrice\(""\); setMaxPrice\(""\); setPriceCurrency\("all"\); setBrowseFrom\(""\); setBrowseTo\(""\) \}\}/.test(screen)],
  ["listing cards surface condition and low-stock facts", /listing\.condition\.replace\(\/_\/g, " "\)/.test(screen) && /listing\.availability <= 3/.test(screen)],
  ["listing cards respect reduced motion and keyboard focus", /motion-reduce:transform-none/.test(screen) && /focus-visible:ring-2/.test(screen)],
  ["seller centre exposes active, paused and sold-out inventory metrics", /pausedListings/.test(screen) && /soldOutListings/.test(screen) && /grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8/.test(screen)],
  ["seller listings can be filtered by active, paused, sold-out and draft status", /mineStatusFilter/.test(screen) && /aria-pressed=\{mineStatusFilter === id\}/.test(screen) && /filteredMineListings/.test(screen)],
  ["browse empty states account for all selected facets", /hasBrowseFilters/.test(screen) && /listing type or delivery method/.test(screen)],
  ["browse result count is announced accessibly", /role="status" aria-live="polite"/.test(screen)],
  ["zero-stock products cannot be purchased or added to cart", /listing\.availability > 0\)/.test(screen) && /listing\.kind === "product" && listing\.availability <= 0/.test(screen)],
  ["price sorting partitions by currency before numeric comparison", /const groups = new Map<string, T\[\]>\(\)/.test(lifecycle) && /String\(item\.currency \|\| "GHC"\)/.test(lifecycle)],
  ["price sorting never compares GHC and PI as one numeric scale", /inside[\s\S]*?each currency group/.test(lifecycle)],
  ["listing reports use authenticated server intake, not local browser queue", /api\/marketplace\/listings\/\$\{encodeURIComponent\(listing\.id\)\}\/report/.test(screen) && !/queueListingReport\(/.test(screen)],
  ["report UI only confirms server-durable submissions", /result\?\.durable !== true/.test(screen) && /Your report was recorded for marketplace safety review/.test(screen)],
  ["report route authenticates actor and uses fail-closed durable rate limiting", /resolveAuthenticatedUser/.test(route) && /checkDurableRateLimit[\s\S]*onUnavailable: "deny"/.test(route)],
  ["report route bounds input and validates allowed reasons", /readBoundedJson\(request, 8 \* 1024\)/.test(route) && /REASONS\.has\(reason\)/.test(route)],
  ["report route derives reporter identity from the session, not request body", /p_reporter_id: auth\.userId/.test(route) && !/parsed\.value\.reporterId/.test(route)],
  ["report migration binds reports to existing listings", /REFERENCES public\.gh_marketplace_listings\(id\) ON DELETE RESTRICT/.test(migration)],
  ["report migration prevents duplicate reports by one actor per listing", /UNIQUE \(listing_id, reporter_id\)/.test(migration) && /ON CONFLICT \(listing_id, reporter_id\) DO NOTHING/.test(migration)],
  ["report migration blocks client table access and grants service-role RPC only", /ENABLE ROW LEVEL SECURITY/.test(migration) && /USING \(false\) WITH CHECK \(false\)/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_marketplace_listing_report_create[\s\S]*TO service_role/.test(migration)],
  ["operator queue is key-protected, rate-limited and supports durable review transitions", /timingSafeEqual/.test(operatorReports) && /checkDurableRateLimit[\s\S]*onUnavailable: \"deny\"/.test(operatorReports) && /gh_marketplace_listing_report_transition/.test(operatorReports)],
  ["report transition RPC prevents reopening terminal reports", /FOR UPDATE/.test(migration) && /REPORT_ALREADY_CLOSED/.test(migration) && /status IN \('resolved', 'dismissed'\)/.test(migration)],
  ["reporting does not alter wallet, payment, inventory or payout authority", !/ghc_ledger|ghc_user_accounts|pi_payment|payout_execute|gh_marketplace_order_transition/i.test(migration)],
  ["duplicate community recommendation sorting has been consolidated", !/\.sort\(\(a, b\) => b\.score - a\.score\)\s*\.sort\(/.test(discovery)],
  ["Phase 3 marketplace checks are registered in prebuild and static verification", prebuild.includes("check-phase3-marketplace-premium.mjs") && prebuild.includes("test-phase3-marketplace-sort.mjs") && verify.includes("check-phase3-marketplace-premium.mjs") && verify.includes("test-phase3-marketplace-sort.mjs")],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (ok) passed++
}
console.log(`\nPhase 3 Marketplace premium upgrade: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
