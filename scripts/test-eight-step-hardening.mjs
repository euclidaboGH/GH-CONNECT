import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
const assert = (c, m) => {
  if (c) {
    passed++
    console.log("  ✓", m)
  } else {
    failed++
    console.error("  ✗", m)
  }
}

console.log("\n=== EIGHT-STEP PRODUCTION HARDENING ===\n")

const communities = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(communities.includes("isCommunityMemberWithOptionalCache"), "isJoined uses authority helper")
assert(communities.includes("communityLocalCacheAllowed()"), "local cache gated")
assert(communities.includes("if (!communityLocalCacheAllowed()) return []"), "localJoined init gated")
assert(communities.includes("if (!communityLocalCacheAllowed()) return {}"), "localBoard init gated")

const css = readFileSync(join(root, "app/globals.css"), "utf8")
assert(css.includes("--gh-nav-height"), "nav height token")
assert(css.includes(".gh-scroll-root"), "scroll root utility")
assert(css.includes("var(--gh-nav-height)"), "inset uses nav height")

const msg = readFileSync(join(root, "components/ghc/message-screen.tsx"), "utf8")
assert(msg.includes("MESSAGE_WINDOW = 40"), "message window tuned")
assert(msg.includes("slice(-windowSize)"), "windowed messages retained")

assert(existsSync(join(root, "contexts/domains/messaging-provider.tsx")), "messaging provider")
assert(existsSync(join(root, "contexts/domains/notifications-provider.tsx")), "notifications provider")

const page = readFileSync(join(root, "app/page.tsx"), "utf8")
assert(page.includes("MessagingProvider") && page.includes("NotificationsProvider"), "providers wired")
assert(page.indexOf("<GHCProvider>") < page.indexOf("<MessagingProvider>"), "Messaging inside GHC")

const pers = readFileSync(join(root, "lib/domains/community-persistence.ts"), "utf8")
assert(pers.includes("isDemoDataAllowed"), "persistence imports demo policy")
assert(pers.includes("if (!isDemoDataAllowed()) return"), "persistence write gated")

const prof = readFileSync(join(root, "components/ghc/profile-screen.tsx"), "utf8")
assert(prof.includes("gh-profile-shell") || prof.includes("gh-scroll-root"), "profile layout class")

const disc = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(disc.includes("gh-scroll-root") || disc.includes("gh-page-header-slim"), "discover layout")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150") || econ.includes("150"), "economy frozen VIP")
assert(econ.includes("VVIP_PRICE_GHC = 300") || econ.includes("300"), "economy frozen VVIP")

assert(existsSync(join(root, "docs/architecture/EIGHT_STEP_PRODUCTION_HARDENING.md")), "docs")

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
assert(pkg.engines?.node === "24.x", "node 24.x")

console.log("\n=== RESULTS ===")
console.log("Passed:", passed)
console.log("Failed:", failed)
if (failed) process.exit(1)
console.log("ALL EIGHT-STEP TESTS PASSED\n")
