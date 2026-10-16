import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== STEP 3 GOVERNANCE DURABILITY ===\n")

const files = [
  "lib/domains/adapters/community-governance-store.ts",
  "lib/domains/adapters/community-governance.ts",
  "app/api/governance/moderation-log/route.ts",
  "app/api/governance/reports/route.ts",
  "supabase/migrations/20260907_community_governance_log_proposal.sql",
  "docs/architecture/GOVERNANCE_DURABILITY_STEP3.md",
]
for (const f of files) assert(existsSync(join(root, f)), f)

const store = readFileSync(join(root, "lib/domains/adapters/community-governance-store.ts"), "utf8")
assert(store.includes("getGovernanceDurability") && store.includes("tryServerMirror"), "store APIs")
assert(store.includes("Never reports durable") || store.includes("never claim durable") || store.includes("Never reports durable:true"), "honest durability comments")

const gov = readFileSync(join(root, "lib/domains/adapters/community-governance.ts"), "utf8")
assert(gov.includes("sessionAppendLog") && !gov.includes("const logStore = new Map"), "uses store not inline Maps")
assert(gov.includes("appendModerationLogWithMeta") && gov.includes("durable: false"), "meta write honest")
assert(gov.includes("tryServerMirror"), "server mirror attempted")

const logRoute = readFileSync(join(root, "app/api/governance/moderation-log/route.ts"), "utf8")
assert(logRoute.includes("durable: false") && logRoute.includes("GHC_GOVERNANCE_SERVER"), "API honest")

const mig = readFileSync(join(root, "supabase/migrations/20260907_community_governance_log_proposal.sql"), "utf8")
assert(mig.includes("PROPOSAL ONLY") && mig.includes("NOT APPLIED"), "migration proposal marked")
assert(mig.includes("ghc_community_moderation_log") && mig.includes("ghc_community_reports"), "tables")
assert(mig.includes("ENABLE ROW LEVEL SECURITY"), "RLS")
assert(!/DROP TABLE|TRUNCATE/i.test(mig), "non-destructive")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("governanceDurabilityLabel"), "hub surfaces durability")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "economy frozen")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL STEP 3 TESTS PASSED\n")
