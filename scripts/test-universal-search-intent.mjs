/**
 * Prompt #39 — durable connection intent + universal search structural tests
 */
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
function assert(c, m) {
  if (c) {
    passed++
    console.log("  ✓", m)
  } else {
    failed++
    console.error("  ✗", m)
  }
}

console.log("\n=== UNIVERSAL SEARCH + CONNECTION INTENT (#39) ===\n")

const files = [
  "supabase/migrations/20260905_connection_request_intents.sql",
  "lib/domains/adapters/unified-connection-request.ts",
  "lib/domains/adapters/universal-search.ts",
  "lib/domains/adapters/connection-request-intent.ts",
  "app/api/connections/request/route.ts",
  "app/api/connections/accept/route.ts",
  "app/api/connections/decline/route.ts",
  "components/ghc/global-search.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const mig = readFileSync(join(root, "supabase/migrations/20260905_connection_request_intents.sql"), "utf8")
assert(mig.includes("ghc_connection_requests"), "requests table")
assert(mig.includes("ghc_connection_contexts"), "contexts table")
assert(mig.includes("CREATE TABLE IF NOT EXISTS"), "additive IF NOT EXISTS")
assert(mig.includes("intents jsonb"), "intents column")
assert(mig.includes("status = 'pending'"), "pending unique")
assert(mig.includes("SECURITY DEFINER"), "security definer RPCs")
assert(mig.includes("service_role"), "service_role grants")
assert(!mig.includes("DROP TABLE"), "no destructive drop")
assert(mig.includes("ghc_connection_request_upsert"), "upsert RPC")
assert(mig.includes("ghc_connection_request_accept"), "accept RPC")

const unified = readFileSync(join(root, "lib/domains/adapters/unified-connection-request.ts"), "utf8")
assert(unified.includes("sendUnifiedConnectionRequest"), "unified send")
assert(unified.includes("acceptUnifiedConnectionRequest"), "unified accept")
assert(unified.includes("declineUnifiedConnectionRequest"), "unified decline")
assert(unified.includes("persistOutgoingRequestIntent"), "session meta mirror")
assert(unified.includes("/api/connections/request"), "API dual-write")

const search = readFileSync(join(root, "lib/domains/adapters/universal-search.ts"), "utf8")
assert(search.includes("runUniversalSearch"), "runUniversalSearch")
assert(search.includes("searchDiscoveryObjects"), "reuses discovery sources")
assert(search.includes("people") && search.includes("communities"), "multi-object")
assert(search.includes("events") && search.includes("services"), "events+services")
assert(search.includes("blockedUserIds"), "privacy filter")
assert(!search.includes("compatibilityPercent"), "no fake scores")

const grid = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(grid.includes("sendUnifiedConnectionRequest"), "discover uses unified send")

const gs = readFileSync(join(root, "components/ghc/global-search.tsx"), "utf8")
assert(gs.includes("runUniversalSearch"), "global search wired")
assert(gs.includes("events") && gs.includes("activities") && gs.includes("services"), "search tabs")

const domain = readFileSync(join(root, "lib/domains/social-graph-domain.ts"), "utf8")
assert(domain.includes("friendMeta") || domain.includes("reqMeta"), "accept preserves intent meta")
assert(domain.includes("requestContext"), "send accepts context")

// Financial isolation
for (const f of [
  "lib/domains/adapters/unified-connection-request.ts",
  "lib/domains/adapters/universal-search.ts",
  "app/api/connections/request/route.ts",
]) {
  const t = readFileSync(join(root, f), "utf8")
  assert(!t.includes("executeAuthoritativeSpend") && !t.includes("VIP_PRICE"), `${f} no economy`)
  assert(!t.includes("PI_API_KEY"), `${f} no PI key`)
}

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===")
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed) process.exit(1)
console.log("ALL #39 TESTS PASSED\n")
