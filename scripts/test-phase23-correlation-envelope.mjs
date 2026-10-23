import fs from "node:fs"
const read = (p) => fs.readFileSync(p, "utf8")
const checks = [
  ["canonical correlation builder", read("lib/server/economy/correlation.ts").includes("buildCorrelationEnvelope")],
  ["service-role ledger enrichment", read("lib/server/economy/correlation.ts").includes("ghc_attach_transaction_correlation")],
  ["financial fields untouched by migration", !/SET\s+(amount|status|source_event|reference_id)\s*=/i.test(read("supabase/migrations/20261023010001_ghc_transaction_correlation_envelope.sql"))],
  ["correlation RPC service-role only", read("supabase/migrations/20261023010001_ghc_transaction_correlation_envelope.sql").includes("GRANT EXECUTE")],
  ["wallet attribution reads envelope", read("lib/domains/ghc-activity-attribution.ts").includes("rawMeta.correlation")],
  ["creator tips correlate both ledger sides", (read("app/api/social/tips/route.ts").match(/attachLedgerCorrelation/g)||[]).length >= 2],
  ["transfers correlate both ledger sides", (read("app/api/economy/transfers/route.ts").match(/attachLedgerCorrelation/g)||[]).length >= 2],
  ["marketplace order carries order/listing", /kind: "marketplace"[\s\S]{0,180}orderId: order.id[\s\S]{0,120}listingId: order.listingId/.test(read("app/api/marketplace/orders/[orderId]/pay/route.ts"))],
  ["fallback marketplace spend correlated", read("app/api/economy/ledger/spend/route.ts").includes("buildCorrelationEnvelope({ kind: \"marketplace\"")],
  ["social notifications carry correlation", read("lib/server/social/notifications.ts").includes("correlation: buildCorrelationEnvelope")],
  ["economy notifications carry correlation", read("lib/server/economy/notifications.ts").includes("correlation: buildCorrelationEnvelope")],
  ["notification resolver reads envelope", read("lib/notification-center.ts").includes("rawData.correlation")],
  ["creator tip attribution label", read("lib/domains/ghc-activity-attribution.ts").includes("Creator tip received")],
]
let pass=0
for (const [name, ok] of checks) { console.log(`${ok?"PASS":"FAIL"} ${name}`); if(ok) pass++ }
console.log(`\nPhase 23 correlation contract: ${pass}/${checks.length} PASS`)
if(pass!==checks.length) process.exit(1)
