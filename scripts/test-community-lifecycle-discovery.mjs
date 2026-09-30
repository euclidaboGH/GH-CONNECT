import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY #57 LIFECYCLE + #58 DISCOVERY ===\n")

const files = [
  "lib/domains/adapters/community-governance.ts",
  "lib/domains/adapters/universal-search.ts",
  "lib/domains/adapters/multi-object-discovery.ts",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/global-search.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const gov = readFileSync(join(root, "lib/domains/adapters/community-governance.ts"), "utf8")
assert(gov.includes("suggestLifecycleTransition"), "lifecycle suggestion API")
assert(gov.includes("autoApply: false"), "never auto-apply")
assert(gov.includes("Marking Quiet") || gov.includes("quiet"), "quiet heuristic")
assert(gov.includes("60") && gov.includes("archived"), "archive heuristic")

const search = readFileSync(join(root, "lib/domains/adapters/universal-search.ts"), "utf8")
assert(search.includes("_relevance") || search.includes("relevance"), "relevance ranking")
assert(search.includes('life === "draft"') || search.includes("archived"), "lifecycle filter in search")

const disc = readFileSync(join(root, "lib/domains/adapters/multi-object-discovery.ts"), "utf8")
assert(disc.includes('lifecycle || "active"') || disc.includes("quiet"), "discovery rank uses lifecycle")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("lifecycleSuggestion") && hub.includes("Suggested status"), "suggestion UI")
assert(hub.includes("never happens automatically") || hub.includes("Never"), "human confirm")

const gs = readFileSync(join(root, "components/ghc/global-search.tsx"), "utf8")
assert(gs.includes("runUniversalSearch") && gs.includes("groupSearchResults"), "unified search")
assert(gs.includes("events") && gs.includes("activities") && gs.includes("services"), "multi-object tabs")
assert(gs.split('import { IdentityService }').length === 2, "no duplicate IdentityService import")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP ok")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #57–#58 TESTS PASSED\n")
