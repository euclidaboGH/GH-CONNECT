import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => {
  if (c) { passed++; console.log("  ✓", m) }
  else { failed++; console.error("  ✗", m) }
}

console.log("\n=== COMMUNITIES / BELONGING (#43) ===\n")

const files = [
  "lib/domains/contracts/communities.ts",
  "lib/domains/adapters/community-membership-adapter.ts",
  "lib/domains/community-domain.ts",
  "lib/domains/adapters/discovery-sources.ts",
  "components/ghc/communities-screen.tsx",
  "components/ghc/community-join-reason-picker.tsx",
  "components/ghc/premium-community-hub.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const contract = readFileSync(join(root, "lib/domains/contracts/communities.ts"), "utf8")
assert(contract.includes("CommunityMembershipState") && contract.includes("CommunityOverviewModel"), "membership + overview types")
assert(contract.includes("COMMUNITY_JOIN_REASON_OPTIONS") && contract.includes("learn"), "join reasons")
assert(contract.includes("primaryMembershipAction") && contract.includes("membershipStateLabel"), "state helpers")
assert(contract.includes("communityDiscoverEmptyState"), "honest empty discover state")

const adapter = readFileSync(join(root, "lib/domains/adapters/community-membership-adapter.ts"), "utf8")
assert(adapter.includes("resolveMembershipState") && adapter.includes("toCommunityOverview"), "adapter mapping")
assert(adapter.includes("filterMemberIdsForViewer") && adapter.includes("blocked"), "block filter")
assert(adapter.includes("isDemoDataAllowed") && adapter.includes("demo-"), "demo isolation")
assert(adapter.includes("userFacingJoinError"), "join errors")
assert(!adapter.includes("PI_API_KEY") && !adapter.includes("executeAuthoritativeSpend"), "financial isolation adapter")

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("joinCommunity") && domain.includes("requestJoin"), "authoritative join/request")
assert(domain.includes("createCommunity"), "create community")

const disc = readFileSync(join(root, "lib/domains/adapters/discovery-sources.ts"), "utf8")
assert(disc.includes("loadCommunityCandidates") && disc.includes("isDemoDataAllowed"), "discovery communities + demo filter")
assert(disc.includes("CommunityCandidate") || disc.includes("kind: \"community\""), "community candidates")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("CommunityJoinReasonPicker"), "join reason picker wired")
assert(screen.includes("beginJoin") && screen.includes("ensureInStateAndJoin"), "join flow")
assert(screen.includes("joinCommunity") && screen.includes("userFacingJoinError"), "authoritative join + errors")
// Must not toast success before ok
assert(!screen.includes("addToast(`Joined") || screen.includes("if (ok)"), "success only after ok")
assert(screen.includes("isDemoDataAllowed"), "screen respects demo policy for seeds")

const picker = readFileSync(join(root, "components/ghc/community-join-reason-picker.tsx"), "utf8")
assert(picker.includes('role="dialog"') && picker.includes("Escape"), "a11y dialog")
assert(picker.includes("Skip") && picker.includes("Continue"), "skip/continue")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("Board") || hub.includes("board"), "hub board surface")
assert(hub.includes("Join") || hub.includes("isJoined"), "hub membership CTA")

const notif = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(notif.includes("ghc:open-community") || notif.includes("groupId"), "community notification deep link")

// No second graph authority claim
assert(!adapter.includes("createCommunityStore") && !contract.includes("createCommunityStore"), "no duplicate store")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #43 COMMUNITY TESTS PASSED\n")
