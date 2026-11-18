import assert from "node:assert/strict"
import fs from "node:fs"

const component = fs.readFileSync("components/ghc/communities-screen.tsx", "utf8")
const helper = fs.readFileSync("lib/community/account-scoped-cache.ts", "utf8")
const checks = [
  ["community cache uses an account-scoped namespace", component.includes("communityAccountStorageKey")],
  ["community preferences are keyed to the active identity", component.includes('useAccountFilterState("communities", communityIdentityId')],
  ["identity changes are subscribed", component.includes("IdentityService.subscribe")],
  ["identity changes fence prior-account writes", component.includes("activeCommunityIdentityRef.current !== communityIdentityId")],
  ["identity changes clear selected community and snapshots", component.includes("setSelectedCommunityId(null)") && component.includes("setPlatformSnapshots({})")],
  ["directory requests are fenced by identity", component.includes("activeCommunityIdentityRef.current !== communityIdentityId") && component.includes("[directoryTick, directory, searchQuery, categoryFilter, directoryOffset, communityIdentityId]")],
  ["platform snapshots are fenced by identity", component.includes("activeCommunityIdentityRef.current !== requestIdentity")],
  ["cache namespaces are allowlisted", helper.includes("ALLOWED_KEYS")],
  ["joined membership hints are bounded and deduplicated", helper.includes("MAX_JOINED_IDS") && helper.includes("seen.has(id)")],
  ["board cache size is bounded", helper.includes("MAX_COMMUNITY_CACHE_ENTRIES") && helper.includes("MAX_POSTS_PER_COMMUNITY")],
  ["oversized serialized cache inputs fail closed", helper.includes("raw.length > 512_000") && helper.includes("raw.length > 2_000_000")],
  ["legacy device-wide keys are not read", !component.includes('getItem("ghc.community.joinedIds")') && !component.includes('getItem("ghc.community.boardPosts")')],
]
for (const [name, passed] of checks) {
  assert.ok(passed, name)
  console.log(`PASS ${name}`)
}
console.log(`Phase 7 community cache isolation: ${checks.length}/${checks.length} passed`)
