import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY HUB (#45) ===\n")

const files = [
  "components/ghc/premium-community-hub.tsx",
  "lib/domains/community-domain.ts",
  "contexts/ghc-context.tsx",
  "components/ghc/communities-screen.tsx",
  "components/ghc/community-people-you-may-know.tsx",
  "components/ghc/profile-preview-page.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("CommunityPeopleYouMayKnow"), "Members tab mounts PYMK")
assert(hub.includes("Pending join requests") || hub.includes("pendingJoinRequests"), "pending requests UI")
assert(hub.includes("Invite member") || hub.includes("onInviteMember"), "invite member UI")
assert(hub.includes("buildPeopleYouMayKnowInCommunity"), "uses people adapter")
assert(hub.includes("Accept") && hub.includes("Decline"), "approve/decline buttons")

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("declineJoinRequest"), "decline join domain")
assert(domain.includes("No pending join request"), "stale request check")
assert(domain.includes("Cannot approve blocked user"), "blocked approve prevention")
assert(domain.includes("approveJoinRequest"), "approve join domain")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("approveCommunityJoinRequest") && ctx.includes("declineCommunityJoinRequest"), "context approve/decline")
assert(ctx.includes("inviteCommunityMember"), "context invite")
assert(ctx.includes("acceptInvitation"), "invitation accept still present")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("onApproveRequest") && screen.includes("onDeclineRequest"), "screen wires approve/decline")
assert(screen.includes("onInviteMember") && screen.includes("pendingJoinRequests"), "screen invite + pending")
assert(screen.includes("inviteCommunityMember"), "uses context invite")

const people = readFileSync(join(root, "components/ghc/community-people-you-may-know.tsx"), "utf8")
assert(people.includes("submitConnectionFromPicker") && people.includes("ConnectionIntentPicker"), "unified connect flow")

const profile = readFileSync(join(root, "components/ghc/profile-preview-page.tsx"), "utf8")
assert(profile.includes("sharedCommunities") && profile.includes("Both in"), "profile shared communities")
assert(profile.includes("ghc:open-community"), "navigate to community")

const notif = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(notif.includes("ghc:open-community"), "notification community deep link")

for (const f of ["components/ghc/premium-community-hub.tsx", "lib/domains/community-domain.ts"]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("PI_API_KEY") && !x.includes("executeAuthoritativeSpend"), f + " financial isolation")
}
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #45 HUB TESTS PASSED\n")
