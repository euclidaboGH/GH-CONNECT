import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== COMMUNITY MODERATION + DIGEST (#49) ===\n")

const files = [
  "lib/domains/community-domain.ts",
  "lib/domains/adapters/community-search-actions.ts",
  "lib/domains/adapters/community-activity-digest.ts",
  "docs/proposals/20260906_community_notification_dedupe_PROPOSAL_ONLY.sql",
  "components/ghc/premium-community-hub.tsx",
  "components/ghc/global-search.tsx",
  "contexts/ghc-context.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("pinBoardPost") && domain.includes("unpinBoardPost"), "pin/unpin domain")
assert(domain.includes("hideBoardPost") && domain.includes("unhideBoardPost"), "hide/unhide domain")
assert(domain.includes('assertAction(i.communityId, "moderate")'), "moderate permission")
assert(domain.includes(".filter((p) => !(p as any).hidden)"), "listBoardPosts hides hidden")

const searchAct = readFileSync(join(root, "lib/domains/adapters/community-search-actions.ts"), "utf8")
assert(searchAct.includes("resolveCommunitySearchAction"), "search action resolver")
assert(searchAct.includes("accept_invite") && searchAct.includes("pending"), "membership states")
assert(searchAct.includes("invite-only"), "invite-only → request")

const digest = readFileSync(join(root, "lib/domains/adapters/community-activity-digest.ts"), "utf8")
assert(digest.includes("buildCommunityActivityDigest"), "digest builder")
assert(digest.includes("Non-financial") || digest.includes("no rewards"), "non-financial")
assert(!digest.includes("GHC") || digest.includes("No GHC"), "no ghc issuance")

const proposal = readFileSync(join(root, "docs/proposals/20260906_community_notification_dedupe_PROPOSAL_ONLY.sql"), "utf8")
assert(proposal.includes("PROPOSAL ONLY") && proposal.includes("NOT APPLIED"), "proposal not applied")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("pinBoardPost") && ctx.includes("hideBoardPost"), "context mod methods")

const hub = readFileSync(join(root, "components/ghc/premium-community-hub.tsx"), "utf8")
assert(hub.includes("onPinPost") && hub.includes("onHidePost"), "hub mod props")
assert(hub.includes("Activity digest"), "digest UI")
assert(hub.includes("!p.hidden"), "UI filters hidden")
assert(hub.includes("window.confirm"), "confirm hide")

const search = readFileSync(join(root, "components/ghc/global-search.tsx"), "utf8")
assert(search.includes("resolveCommunitySearchAction"), "search uses resolver")
assert(search.includes("intent:") || search.includes("join"), "join intent on open")

const notif = readFileSync(join(root, "lib/domains/adapters/community-notification.ts"), "utf8")
assert(notif.includes("shouldSkipDuplicateCommunityNotification"), "in-process dedupe retained")

for (const f of ["lib/domains/community-domain.ts", "lib/domains/adapters/community-activity-digest.ts", "components/ghc/premium-community-hub.tsx"]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend") && !x.includes("claimDailyReward"), f.split("/").pop() + " isolation")
}
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #49 TESTS PASSED\n")
