import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY PARTICIPATION (#46) ===\n")

const files = [
  "components/ghc/profile-my-communities.tsx",
  "lib/domains/adapters/community-notification.ts",
  "lib/domains/adapters/my-communities-home.ts",
  "components/ghc/profile-screen.tsx",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/communities-screen.tsx",
  "lib/notification-center.ts",
  "components/ghc/notification-bell.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const profileSec = readFileSync(join(root, "components/ghc/profile-my-communities.tsx"), "utf8")
assert(profileSec.includes("listMyCommunitiesForHome"), "profile uses authoritative home adapter")
assert(profileSec.includes("You haven't joined") || profileSec.includes("haven&apos;t joined"), "empty state")
assert(!/localStorage\.getItem|localStorage\.setItem/.test(profileSec), "no localStorage membership authority")

const profile = readFileSync(join(root, "components/ghc/profile-screen.tsx"), "utf8")
assert(profile.includes("ProfileMyCommunities"), "profile mounts My Communities")
assert(profile.includes("messaging?.conversations") || profile.includes("messaging.conversations"), "conversations from messaging slice")

const shared = readFileSync(join(root, "components/ghc/profile-preview-page.tsx"), "utf8")
assert(shared.includes("sharedCommunities") && shared.includes("Both in"), "shared communities on other profiles")

const notifAdapt = readFileSync(join(root, "lib/domains/adapters/community-notification.ts"), "utf8")
assert(notifAdapt.includes("invitation") && notifAdapt.includes("join_request"), "subtypes defined")
assert(notifAdapt.includes("announcement"), "announcement subtype")

const center = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(center.includes('| "community"') || center.includes('"community"'), "community bucket")
assert(center.includes("isCommunityNotification"), "community routing")
assert(center.includes('label: "Community"'), "bucket label")

const bell = readFileSync(join(root, "components/ghc/notification-bell.tsx"), "utf8")
assert(bell.includes("community:") || bell.includes("No community alerts"), "empty community copy")
assert(bell.includes("communityNotificationLabel"), "subtype label in list")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("Upcoming") && hub.includes("Past"), "events upcoming/past")
assert(hub.includes("Resources") || hub.includes("PinnedResourceCard"), "resources surface")
assert(hub.includes("Activities"), "activities surface")
assert(hub.includes("Unmute community") || hub.includes("Mute community"), "mute/unmute UI")
assert(hub.includes("CommunityPeopleYouMayKnow"), "members pymk retained")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("muteConversation") && screen.includes("onMute"), "mute wired to conversation mute")
assert(screen.includes("you remain a member") || screen.includes("Community muted"), "mute ≠ leave messaging")

const home = readFileSync(join(root, "lib/domains/adapters/my-communities-home.ts"), "utf8")
assert(!/localStorage\.getItem|localStorage\.setItem/.test(home), "home adapter no localStorage")

for (const f of ["components/ghc/profile-my-communities.tsx", "lib/domains/adapters/community-notification.ts", "components/ghc/premium-community-hub.tsx"]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("PI_API_KEY") && !x.includes("executeAuthoritativeSpend") && !x.includes("claimDaily"), f + " financial isolation")
}
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")
assert(econ.includes("VVIP_PRICE_GHC = 300"), "VVIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #46 PARTICIPATION TESTS PASSED\n")
