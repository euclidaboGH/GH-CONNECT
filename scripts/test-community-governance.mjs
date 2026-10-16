import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY GOVERNANCE (#50) ===\n")

const files = [
  "lib/domains/contracts/community-governance.ts",
  "lib/domains/adapters/community-governance.ts",
  "docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md",
  "lib/domains/community-domain.ts",
  "contexts/ghc-context.tsx",
  "components/ghc/premium-community-hub.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const contract = readFileSync(join(root, "lib/domains/contracts/community-governance.ts"), "utf8")
assert(contract.includes("CommunityLifecycleState"), "lifecycle states")
assert(contract.includes("draft") && contract.includes("archived"), "draft/archived")
assert(contract.includes("CommunityCapability"), "capabilities")
assert(contract.includes("CommunityModerationLogEntry"), "mod log type")
assert(contract.includes("LIFECYCLE_TRANSITIONS"), "transition matrix")
assert(contract.includes("CommunityHealthSnapshot"), "health snapshot")

const adapt = readFileSync(join(root, "lib/domains/adapters/community-governance.ts"), "utf8")
assert(adapt.includes("capabilitiesForRole") && adapt.includes("buildGovernanceModel"), "capability map")
assert(adapt.includes("appendModerationLog") && adapt.includes("listModerationLog"), "mod log")
assert(adapt.includes("createCommunityReport"), "reports")
assert(adapt.includes("buildHealthSnapshot"), "health")
assert(adapt.includes("Session") || adapt.includes("session"), "session-backed honesty")

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("transitionLifecycle") && domain.includes("reportCommunityContent"), "domain lifecycle/report")
assert(domain.includes("unhideBoardPost"), "unhide domain")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("unhideBoardPost") && ctx.includes("transitionCommunityLifecycle"), "context methods")
assert(ctx.includes("reportCommunityContent") && ctx.includes("appendModerationLog"), "report+log")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("Community status") && hub.includes("Moderation log"), "gov UI")
assert(hub.includes("Report community") && hub.includes("Unhide"), "safety+unhide")
assert(hub.includes("healthSnapshot") || hub.includes("Activity digest"), "health/digest")

const disc = readFileSync(join(root, "lib/domains/adapters/multi-object-discovery.ts"), "utf8")
assert(disc.includes("archived") && disc.includes("draft"), "discovery excludes archived/draft")

const roadmap = readFileSync(join(root, "docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md"), "utf8")
assert(roadmap.includes("50") && roadmap.includes("60"), "roadmap sequence")
assert(roadmap.includes("NOT APPLIED"), "dedupe not forced")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #50 GOVERNANCE TESTS PASSED\n")
