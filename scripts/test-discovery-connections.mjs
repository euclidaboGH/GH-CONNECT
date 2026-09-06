/**
 * Prompt #37/#38 — Discovery multi-object + connections tests
 */
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
function assert(c, m) {
  if (c) { passed++; console.log("  ✓", m) }
  else { failed++; console.error("  ✗", m) }
}

console.log("\n=== DISCOVERY + CONNECTIONS (#37/#38) ===\n")

const files = [
  "lib/domains/adapters/discovery-adapter.ts",
  "lib/domains/adapters/connection-graph-adapter.ts",
  "lib/domains/adapters/profile-connection-context.ts",
  "lib/domains/adapters/multi-object-discovery.ts",
  "lib/domains/adapters/connection-request-intent.ts",
  "lib/domains/adapters/discovery-sources.ts",
  "lib/domains/contracts/discovery.ts",
  "components/ghc/connection-card.tsx",
  "components/ghc/discovery-object-card.tsx",
  "components/ghc/discovery-grid-screen.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const disc = readFileSync(join(root, "lib/domains/contracts/discovery.ts"), "utf8")
assert(disc.includes("PersonCandidate") && disc.includes("CommunityCandidate"), "discriminated person/community")
assert(disc.includes("EventCandidate") && disc.includes("ActivityCandidate") && disc.includes("ServiceCandidate"), "event/activity/service types")
assert(disc.includes("isPersonCandidate"), "type guards")

const multi = readFileSync(join(root, "lib/domains/adapters/multi-object-discovery.ts"), "utf8")
assert(multi.includes("searchDiscoveryObjects"), "searchDiscoveryObjects")
assert(multi.includes("DISCOVERY_SOURCE_STATUS"), "source status map")
assert(multi.includes("loadCommunities"), "communities real source")
assert(multi.includes("marketplace") || multi.includes("listings"), "services source")
assert(!multi.includes("fakeCommunity") && !multi.includes("DEMO_EVENT"), "no invented records")

const src = readFileSync(join(root, "lib/domains/adapters/discovery-sources.ts"), "utf8")
assert(src.includes("loadCommunityCandidates") && src.includes("loadEventCandidates"), "source loaders")
assert(src.includes("loadServiceCandidates"), "service loader")

const intent = readFileSync(join(root, "lib/domains/adapters/connection-request-intent.ts"), "utf8")
assert(intent.includes("persistOutgoingRequestIntent"), "persist intent")
assert(intent.includes("CONNECTION_INTENT_SERVER_MIGRATION"), "migration note")
assert(intent.includes("friend_request"), "edge type")

const graph = readFileSync(join(root, "lib/domains/social-graph-domain.ts"), "utf8")
assert(graph.includes("requestContext") && graph.includes("friendMeta"), "accept preserves meta")

const card = readFileSync(join(root, "components/ghc/discovery-object-card.tsx"), "utf8")
assert(card.includes("isCommunityCandidate") || card.includes("Community"), "community card")
assert(card.includes("Event") || card.includes("isEvent"), "event card")
assert(card.includes("Service") || card.includes("isService"), "service card")

const grid = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(grid.includes("searchDiscoveryObjects") || grid.includes("loadTypedDiscovery"), "grid multi-object")
assert(grid.includes("DiscoveryObjectCard"), "object card wired")
assert(grid.includes("persistOutgoingRequestIntent"), "intent on connect")
assert(grid.includes("communities") && grid.includes("events"), "category chips")

const prof = readFileSync(join(root, "components/ghc/profile-preview-page.tsx"), "utf8")
assert(prof.includes("buildProfileConnectionContext"), "profile context wired")
assert(prof.includes("How you may connect"), "how-you-know UI")

const notif = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(notif.includes("friend-request") || notif.includes("friend_request"), "friend request routing")
assert(notif.includes("ghc:open-connection-request") || notif.includes("open-profile"), "deep link events")

const search = readFileSync(join(root, "lib/domains/contracts/search.ts"), "utf8")
assert(search.includes('"event"') && search.includes('"activity"') && search.includes('"service"'), "search kinds")
assert(search.includes("searchKindFromDiscoveryKind"), "search/discovery map")

// Financial isolation
for (const f of [
  "lib/domains/adapters/multi-object-discovery.ts",
  "lib/domains/adapters/connection-request-intent.ts",
  "components/ghc/discovery-object-card.tsx",
]) {
  const t = readFileSync(join(root, f), "utf8")
  assert(!t.includes("executeAuthoritativeSpend") && !t.includes("PI_API_KEY"), `${f} financial isolation`)
}

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")
assert(econ.includes("VVIP_PRICE_GHC = 300"), "VVIP unchanged")

console.log("\n=== RESULTS ===")
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed) process.exit(1)
console.log("ALL DISCOVERY + CONNECTION TESTS PASSED\n")
