import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY PARTICIPATION DEPTH (#48) ===\n")

const files = [
  "lib/domains/community-domain.ts",
  "lib/domains/adapters/community-board-participation.ts",
  "lib/domains/adapters/community-notification.ts",
  "contexts/ghc-context.tsx",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/communities-screen.tsx",
  "components/ghc/global-search.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("replyToBoardPost"), "domain reply")
assert(domain.includes("reactToBoardPost"), "domain react")
assert(domain.includes('assertAction(i.communityId, "comment")'), "comment permission")
assert(domain.includes("Unsupported reaction"), "only like reaction")
assert(domain.includes("createAnnouncement") && domain.includes('"announce"'), "announce authority")

const adapt = readFileSync(join(root, "lib/domains/adapters/community-board-participation.ts"), "utf8")
assert(adapt.includes("applyReplyToPosts") && adapt.includes("applyReactionToPosts"), "apply helpers")
assert(adapt.includes("sortRepliesChronological"), "chrono replies")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("replyToBoardPost") && ctx.includes("reactToBoardPost"), "context reply/react")
assert(ctx.includes("createCommunityAnnouncement"), "context announce")
assert(ctx.includes('subtype: "announcement"'), "announcement notification")
assert(ctx.includes("emitCommunityNotification"), "canonical emit")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("onReplyToPost") && hub.includes("onReactToPost"), "hub reply/react props")
assert(hub.includes("Publish announcement") || hub.includes("onCreateAnnouncement"), "announce UI")
assert(hub.includes("Replies") && hub.includes("Write a reply"), "reply UX")
assert(hub.includes("aria-label={`Like discussion"), "a11y like")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("replyToBoardPost") && screen.includes("createCommunityAnnouncement"), "screen wires")
assert(screen.includes("announcements={(selected"), "announcements passed")

const search = readFileSync(join(root, "components/ghc/global-search.tsx"), "utf8")
assert(search.includes("universal.groups.communities"), "search uses discovery communities")
assert(search.includes("ghc:open-community"), "search opens community")
assert(search.includes("Open"), "Open action")
assert(search.includes("tabBtn(\"communities\""), "communities filter chip")

const notif = readFileSync(join(root, "lib/domains/adapters/community-notification.ts"), "utf8")
assert(notif.includes("shouldSkipDuplicateCommunityNotification"), "dedupe retained")

for (const f of ["lib/domains/community-domain.ts", "contexts/ghc-context.tsx", "components/ghc/premium-community-hub.tsx"]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend") && !x.includes("claimDaily"), f.split("/").pop() + " financial isolation")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #48 DEPTH TESTS PASSED\n")
