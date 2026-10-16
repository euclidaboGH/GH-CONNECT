import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== STEP 1 COMMUNITY AUTHORITY ===\n")

assert(existsSync(join(root, "lib/domains/adapters/community-ui-authority.ts")), "authority helper")
assert(existsSync(join(root, "docs/architecture/COMMUNITY_AUTHORITY_STEP1.md")), "doc")

const auth = readFileSync(join(root, "lib/domains/adapters/community-ui-authority.ts"), "utf8")
assert(auth.includes("isCommunityMemberDomain") && auth.includes("isCommunityMemberWithOptionalCache"), "APIs")
assert(auth.includes("communityLocalCacheAllowed") && auth.includes("allowLocalBoardFallback"), "cache gates")
assert(auth.includes("resolveMembershipState"), "uses membership adapter")
assert(auth.includes("isDemoDataAllowed"), "demo policy")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("isCommunityMemberWithOptionalCache"), "screen uses helper")
assert(screen.includes("allowLocalBoardFallback"), "board gated")
assert(screen.includes("Could not post to the board"), "prod board error")
assert(screen.includes("communityLocalCacheAllowed"), "join/create cache gated")
assert(screen.includes("Could not leave this community"), "leave requires domain success")
// Must not toast success leave when !ok
assert(!screen.includes("if (!ok) {\n        setLocalJoined"), "leave !ok bug removed")

const pers = readFileSync(join(root, "lib/domains/community-persistence.ts"), "utf8")
assert(pers.includes("Class D") || pers.includes("UI cache"), "persistence labeled D")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "economy untouched")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL STEP 1 TESTS PASSED\n")
