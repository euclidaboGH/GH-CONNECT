import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== #59 HOME PULSE + #60 OS AUDIT ===\n")

const files = [
  "lib/domains/adapters/home-community-pulse.ts",
  "components/ghc/home-command-centre.tsx",
  "docs/HUMAN_CONNECTION_OS_AUDIT_60.md",
  "docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const pulse = readFileSync(join(root, "lib/domains/adapters/home-community-pulse.ts"), "utf8")
assert(pulse.includes("buildHomeCommunityPulse"), "pulse builder")
assert(pulse.includes("maxItems") && pulse.includes("Never fabricates"), "calm + honest")
assert(pulse.includes("buildCommunityParticipationHub"), "reuses participation hub")

const home = readFileSync(join(root, "components/ghc/home-command-centre.tsx"), "utf8")
assert(home.includes("buildHomeCommunityPulse"), "home wires pulse")
assert(home.includes("Happening in your communities"), "event strip")
assert(home.includes('goTab("communities")'), "communities navigation")
assert(home.includes("DailyRewardHomeExperience"), "daily reward retained")
assert(home.includes("My communities"), "my communities retained")

const audit = readFileSync(join(root, "docs/HUMAN_CONNECTION_OS_AUDIT_60.md"), "utf8")
assert(audit.includes("Discover → Connect → Communicate → Belong → Participate → Transact"), "pillar chain")
assert(audit.includes("Isolated") && audit.includes("Transact"), "transact isolated")
assert(audit.includes("NOT APPLIED"), "migrations not applied")
assert(audit.includes("operator-gated") || audit.includes("Operator"), "operator gates")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP ok")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #59–#60 TESTS PASSED\n")
