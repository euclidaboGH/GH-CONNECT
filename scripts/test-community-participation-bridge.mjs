import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY #52–#54 BRIDGE / EVENTS / RESOURCES ===\n")

const files = [
  "lib/domains/adapters/shared-community-bridge.ts",
  "lib/domains/adapters/community-participation-hub.ts",
  "lib/domains/adapters/profile-connection-context.ts",
  "lib/domains/adapters/community-people-you-may-know.ts",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/community-features-ui.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const bridge = readFileSync(join(root, "lib/domains/adapters/shared-community-bridge.ts"), "utf8")
assert(bridge.includes("relationshipThroughCommunities"), "through-community line")
assert(bridge.includes("You know this person through"), "relationship copy")
assert(bridge.includes("scoreCommunityMemberSuggestion"), "member ranking")
assert(bridge.includes("intersectCommunityRefs"), "intersect refs")

const hubA = readFileSync(join(root, "lib/domains/adapters/community-participation-hub.ts"), "utf8")
assert(hubA.includes("buildCommunityParticipationHub"), "participation hub")
assert(hubA.includes("upcomingEvents") && hubA.includes("pastEvents"), "event buckets")
assert(hubA.includes("resources") && hubA.includes("normalizeResourceItem"), "resources")
assert(hubA.includes("nextEvent") && hubA.includes("formatEventWhen"), "next event")
assert(hubA.includes("Does not invent") || hubA.includes("not invent"), "no fabrication honesty")

const profile = readFileSync(join(root, "lib/domains/adapters/profile-connection-context.ts"), "utf8")
assert(profile.includes("relationshipThroughCommunities"), "profile uses bridge")
assert(profile.includes("sharedRefs") || profile.includes("throughLine"), "through line in summary")

const pymk = readFileSync(join(root, "lib/domains/adapters/community-people-you-may-know.ts"), "utf8")
assert(pymk.includes("scoreCommunityMemberSuggestion"), "pymk ranking")

const ui = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(ui.includes("buildCommunityParticipationHub"), "hub wires participation")
assert(ui.includes("Next up") && ui.includes("Knowledge hub"), "board strip")
assert(ui.includes("Events and activities are how this community meets"), "events positioning")

const cards = readFileSync(join(root, "components/ghc/community-features-ui.tsx"), "utf8")
assert(cards.includes("rounded-2xl border border-border bg-card"), "modern event card")
assert(cards.includes("Attend"), "RSVP CTA")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP ok")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #52–#54 TESTS PASSED\n")
