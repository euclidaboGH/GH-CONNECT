import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== SOCIAL OS FOUNDATION ===\n")

const files = [
  "docs/SOCIAL_OS_ROADMAP.md",
  "lib/domains/adapters/social-surface-router.ts",
  "lib/domains/adapters/social-content-kinds.ts",
  "lib/notification-center.ts",
  "components/ghc/notification-bell.tsx",
  "components/ghc/feed-components.tsx",
  "components/ghc/create-hub-sheet.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const road = readFileSync(join(root, "docs/SOCIAL_OS_ROADMAP.md"), "utf8")
assert(road.includes("Phase S0") && road.includes("Phase S8"), "phased roadmap")
assert(road.includes("Match ≠ Connection"), "match vs connect")
assert(road.includes("never dump") || road.includes("never Settings"), "notif policy")
assert(road.includes("not") && road.includes("dating"), "positioning")

const router = readFileSync(join(root, "lib/domains/adapters/social-surface-router.ts"), "utf8")
assert(router.includes("navigateToSocialSurface"), "router API")
assert(router.includes("marketplace") && router.includes("matches"), "surfaces covered")
assert(router.includes("ghc:open-listing") || router.includes("listingId"), "listing nav")

const notif = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(notif.includes("ghc:open-listing"), "notif → marketplace")
assert(notif.includes("matches"), "notif → matches")

const bell = readFileSync(join(root, "components/ghc/notification-bell.tsx"), "utf8")
const impCount = (bell.match(/import \{ communityNotificationLabel, isCommunityNotification \}/g) || []).length
assert(impCount === 1, "single community notif import (was duplicated)")
assert(bell.includes("navigateNotificationDeepLink"), "deep link on tap")

const feed = readFileSync(join(root, "components/ghc/feed-components.tsx"), "utf8")
assert(feed.includes("View") && feed.includes("listingId"), "marketplace CTA on feed")
assert(feed.includes("resolvePostContentKind"), "content kinds")

const hub = readFileSync(join(root, "components/ghc/create-hub-sheet.tsx"), "utf8")
assert(hub.includes('"story"') && hub.includes('"poll"') && hub.includes('"challenge"'), "create hub complete")

assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL SOCIAL OS FOUNDATION TESTS PASSED\n")
