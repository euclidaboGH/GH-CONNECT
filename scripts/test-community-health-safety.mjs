import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY #55 HEALTH + #56 SAFETY ===\n")

const files = [
  "lib/domains/contracts/community-governance.ts",
  "lib/domains/adapters/community-governance.ts",
  "components/ghc/premium-community-hub.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const contract = readFileSync(join(root, "lib/domains/contracts/community-governance.ts"), "utf8")
assert(contract.includes("CommunityAdminHealthAnalytics"), "analytics type")
assert(contract.includes("CommunityHealthGrade"), "health grades")
assert(contract.includes("engagementScore"), "engagement score field")

const adapt = readFileSync(join(root, "lib/domains/adapters/community-governance.ts"), "utf8")
assert(adapt.includes("buildAdminHealthAnalytics"), "admin analytics builder")
assert(adapt.includes("resolveCommunityReport"), "resolve report")
assert(adapt.includes("needs_attention") && adapt.includes("at_risk"), "grades")
assert(adapt.includes("recommendations"), "recommendations")
assert(adapt.includes("NOT a reputation") || adapt.includes("informational"), "non-financial note")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("Community health") && hub.includes("adminHealth"), "health UI")
assert(hub.includes("Safety queue") && hub.includes("resolveCommunityReport"), "safety queue")
assert(hub.includes("Resolve") && hub.includes("Dismiss"), "triage actions")
assert(hub.includes("harassment") && hub.includes("spam"), "report reasons")
// hooks: safetyTick near other useState
const tickIdx = hub.indexOf("const [safetyTick")
const adminIdx = hub.indexOf("const adminHealth")
assert(tickIdx > 0 && tickIdx < adminIdx, "hooks before derived state")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP ok")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #55–#56 TESTS PASSED\n")
