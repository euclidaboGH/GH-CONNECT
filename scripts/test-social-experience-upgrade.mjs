import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== SOCIAL EXPERIENCE UPGRADE (Messages/Feed/Profile/Discover/Create) ===\n")

const files = [
  "lib/domains/adapters/social-content-kinds.ts",
  "lib/domains/contracts/feed.ts",
  "components/ghc/create-hub-sheet.tsx",
  "components/ghc/app.tsx",
  "components/ghc/feed-components.tsx",
  "components/ghc/discovery-grid-screen.tsx",
  "components/ghc/message-screen.tsx",
  "components/ghc/enhanced-feed-screen.tsx",
  "components/ghc/unified-compose.tsx",
  "components/ghc/poll-composer.tsx",
  "components/ghc/challenge-composer.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const kinds = readFileSync(join(root, "lib/domains/adapters/social-content-kinds.ts"), "utf8")
assert(kinds.includes("poll") && kinds.includes("challenge") && kinds.includes("story"), "content kinds")
assert(kinds.includes("resolvePostContentKind"), "resolver")

const hub = readFileSync(join(root, "components/ghc/create-hub-sheet.tsx"), "utf8")
assert(hub.includes('id: "story"') && hub.includes("Story"), "create hub story")
assert(hub.includes("post") && hub.includes("poll") && hub.includes("challenge"), "create hub core")

const app = readFileSync(join(root, "components/ghc/app.tsx"), "utf8")
assert(app.includes('action === "story"') && app.includes('mode: "story"'), "story opens compose")

const feed = readFileSync(join(root, "components/ghc/feed-components.tsx"), "utf8")
assert(feed.includes("resolvePostContentKind") && feed.includes("contentKindBadgeClass"), "post badges")
assert(feed.includes("bg-card") && feed.includes("border-border"), "design tokens")

const disc = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(disc.includes("Discover with intent"), "discover positioning")
assert(disc.includes("not a dating-only"), "broad positioning")

const msg = readFileSync(join(root, "components/ghc/message-screen.tsx"), "utf8")
assert(msg.includes("Inbox filters") || msg.includes("role=\"tablist\""), "inbox a11y filters")
assert(msg.includes("Private messages stay separate"), "DM vs community clarity")

const efeed = readFileSync(join(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8")
assert(efeed.includes("Add story") || efeed.includes('mode: "story"'), "feed empty story CTA")
assert(efeed.includes("ProfileStorySection"), "stories on feed")

const compose = readFileSync(join(root, "components/ghc/unified-compose.tsx"), "utf8")
assert(compose.includes('ComposeMode = "post" | "story"'), "unified post+story")
assert(compose.includes("publishStory") || compose.includes("storyMedia"), "story pipeline")

const poll = readFileSync(join(root, "components/ghc/poll-composer.tsx"), "utf8")
assert(poll.includes("Poll"), "poll composer")

const chal = readFileSync(join(root, "components/ghc/challenge-composer.tsx"), "utf8")
assert(chal.includes("server-validated") || chal.includes("Server validation"), "challenge anti-spam copy")

// financial isolation
assert(!kinds.includes("executeAuthoritativeSpend"), "kinds no spend")
assert(readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8").includes("VIP_PRICE_GHC = 150"), "VIP ok")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL SOCIAL EXPERIENCE UPGRADE TESTS PASSED\n")
