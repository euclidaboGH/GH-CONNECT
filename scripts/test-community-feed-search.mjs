import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY FEED + SEARCH (#47) ===\n")

const files = [
  "lib/domains/adapters/community-feed.ts",
  "lib/domains/adapters/community-notification.ts",
  "lib/domains/adapters/universal-search.ts",
  "lib/domains/adapters/multi-object-discovery.ts",
  "components/ghc/premium-community-hub.tsx",
  "contexts/ghc-context.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const feed = readFileSync(join(root, "lib/domains/adapters/community-feed.ts"), "utf8")
assert(feed.includes("buildCommunityFeed"), "buildCommunityFeed")
assert(feed.includes("discussion") && feed.includes("announcement") && feed.includes("event"), "feed kinds")
assert(feed.includes("source:"), "preserves source identity")

const notif = readFileSync(join(root, "lib/domains/adapters/community-notification.ts"), "utf8")
assert(notif.includes("emitCommunityNotification"), "emit constructor")
assert(notif.includes("buildCommunityNotificationData"), "canonical data")
assert(notif.includes("shouldSkipDuplicateCommunityNotification"), "dedupe")
assert(notif.includes("referenceId"), "reference identity")
assert(notif.includes("join_request") && notif.includes("invitation"), "event subtypes")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("emitCommunityNotification"), "context emits")
assert(ctx.includes('subtype: "invitation"'), "invite emits")
assert(ctx.includes('subtype: "join_request"'), "join_request emits")
assert(ctx.includes('subtype: "join_accepted"'), "join_accepted emits")
assert(ctx.includes("approveCommunityJoinRequest") && ctx.includes("inviteCommunityMember"), "approval methods present")
assert(ctx.includes("createBoardPost"), "board post retained")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("buildCommunityFeed") && hub.includes("feedItems"), "hub feed")
assert(hub.includes("Start a discussion") || hub.includes("Post discussion"), "discussion composer")
assert(hub.includes("Community timeline"), "timeline surface")
assert(hub.includes("ghc:open-profile"), "author profile open")

const search = readFileSync(join(root, "lib/domains/adapters/universal-search.ts"), "utf8")
assert(search.includes('c.kind === "community"'), "community search branch")
assert(search.includes("tags") || search.includes("purpose"), "name/purpose/tags match")
assert(search.includes("invite-only") || search.includes("private"), "hides private")
assert(search.includes("coverImage"), "community result image")

const disc = readFileSync(join(root, "lib/domains/adapters/multi-object-discovery.ts"), "utf8")
assert(disc.includes("invite-only") || disc.includes("private"), "discovery privacy filter")

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("createBoardPost") && domain.includes("Join this community to post"), "authoritative posting")

for (const f of files) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend") && !x.includes("claimDailyReward"), f.split("/").pop() + " no claim/spend")
}
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150") && econ.includes("VVIP_PRICE_GHC = 300"), "prices unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #47 FEED/SEARCH TESTS PASSED\n")
