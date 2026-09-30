import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY ONBOARDING (#51) ===\n")

const files = [
  "lib/domains/adapters/community-member-onboarding.ts",
  "components/ghc/community-join-reason-picker.tsx",
  "components/ghc/community-member-welcome.tsx",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/communities-screen.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const adapt = readFileSync(join(root, "lib/domains/adapters/community-member-onboarding.ts"), "utf8")
assert(adapt.includes("buildMemberWelcomeModel"), "welcome model")
assert(adapt.includes("ONBOARDING_CHECKLIST"), "checklist")
assert(adapt.includes("markWelcomeComplete") && adapt.includes("isWelcomeComplete"), "welcome dismiss")
assert(adapt.includes("markChecklistStep"), "checklist steps")
assert(adapt.includes("meet_people") && adapt.includes("first_post"), "key steps")

const picker = readFileSync(join(root, "components/ghc/community-join-reason-picker.tsx"), "utf8")
assert(picker.includes('Step 1 of 2') && picker.includes('Step 2 of 2'), "multi-step")
assert(picker.includes("rulesAck") || picker.includes("rules"), "rules step")
assert(picker.includes("Agree & join"), "confirm CTA")
assert(picker.includes("aria-modal"), "a11y dialog")
assert(picker.includes("Skip") && picker.includes("Continue"), "skip/continue")

const welcome = readFileSync(join(root, "components/ghc/community-member-welcome.tsx"), "utf8")
assert(welcome.includes("Getting started") && welcome.includes("Dismiss"), "welcome UI")
assert(welcome.includes("onOpenMembers") && welcome.includes("onOpenBoard"), "deep links")
assert(welcome.includes("Rules snapshot"), "rules snapshot")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("CommunityMemberWelcome"), "hub mounts welcome")
assert(hub.includes("buildMemberWelcomeModel"), "hub builds model")
assert(hub.includes("markWelcomeComplete"), "dismiss wired")
assert(!hub.includes("import {\nimport {"), "no broken import")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("rules={normalizeRules(joinPickerRow"), "picker gets rules")
assert(screen.includes("saveLocalJoinReasons"), "reasons persisted")

// financial isolation
for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend"), f.split("/").pop() + " no spend")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #51 ONBOARDING TESTS PASSED\n")
