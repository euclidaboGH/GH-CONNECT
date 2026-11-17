#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const engine = read("lib/feed-ranking-engine.ts")
const primitives = read("lib/feed/phase5-feed-primitives.ts")
const screen = read("components/ghc/enhanced-feed-screen.tsx")
const context = read("contexts/ghc-context.tsx")
const feedRoute = read("app/api/social/feed/route.ts")
const muteRoute = read("app/api/social/mutes/route.ts")
const blockRoute = read("app/api/social/blocks/route.ts")
const packageJson = JSON.parse(read("package.json"))
const checks = [
  ["hashtags support Unicode letters and numbers", /#\(\[\\p\{L\}\\p\{N\}\]\[\\p\{L\}\\p\{N\}\\p\{M\}_\]\{1,31\}\)/.test(primitives)],
  ["topic extraction normalizes and deduplicates tags", /new Set\(matches\.map\(\(tag\) => tag\.slice\(1\)\.normalize\("NFKC"\)/.test(primitives)],
  ["For You interest matching uses whole-token boundaries", /function containsWholeInterest[\s\S]*?\[\^\\\\p\{L\}\\\\p\{N\}\]/.test(primitives)],
  ["For You caps distinct matched-interest boosts", /matchPostInterests[\s\S]*?\.slice\(0, Math\.max/.test(primitives) && /matchPostInterests\(post\.content/.test(engine)],
  ["intention bias avoids substring false positives", /hasAnyWholeTerm[\s\S]*?containsWholeInterest/.test(engine)],
  ["ranking reasons report matched interests rather than opaque scores", /Matches your interests:/.test(engine)],
  ["engagement volume alone is not mislabeled as rising velocity", !/Rising engagement in your network/.test(engine)],
  ["Following remains chronological and applies block/mute suppression", /rankFollowingFeed[\s\S]*?!isSuppressedAuthor\(post, suppressedAuthorIds\)[\s\S]*?const score = post\.createdAt/.test(engine)],
  ["Latest remains chronological with deterministic shared tie ordering", /rankLatestFeed[\s\S]*?const score = post\.createdAt[\s\S]*?\.sort\(compareRankedPosts\)/.test(engine) && /compareFeedOrderDesc\(a\.post, b\.post\)/.test(engine) && /String\(b\.id\)\.localeCompare\(String\(a\.id\)\)/.test(primitives)],
  ["server feed still fails closed when visibility filtering is unavailable", feedRoute.includes('error: "POST_VISIBILITY_UNAVAILABLE"')],
  ["server feed still fails closed when mute privacy state is unavailable", feedRoute.includes('error: "FEED_PRIVACY_FILTER_UNAVAILABLE"')],
  ["server mute action uses the canonical durable RPC", muteRoute.includes('socialRpc("gh_mute_set"') && muteRoute.includes('durable: true')],
  ["server block action uses the canonical durable RPC", blockRoute.includes('socialRpc("gh_block_set"') && blockRoute.includes('durable: true')],
  ["manual refresh no longer dispatches a duplicate refresh before its own request", !screen.includes('emitSectionRefresh("feed", { reason: "manual"')],
  ["all replacement refreshes synchronize Load more with the returned cursor", /const refreshFeedAndSync = useCallback[\s\S]*?setHasMorePosts\(Boolean\(result\.ok && result\.nextCursor\)\)/.test(screen)],
  ["manual refresh responses are fenced to the initiating account", /const handleRefresh = async \(\) => \{\s*const ownerAtStart = feedPreferenceOwnerId[\s\S]*?ownerAtStart !== feedPreferenceOwnerId \|\| activeOwner !== ownerAtStart/.test(screen)],
  ["a final partial server page is revealed even when there is no next cursor", /if \(fetchedCount > 0\) setDisplayedPostsCount[\s\S]*?setHasMorePosts\(Boolean\(page\.nextCursor\)\)/.test(screen)],
  ["load-more responses are fenced to the active account and request generation", /ownerAtStart !== feedPreferenceOwnerId \|\| activeOwner !== ownerAtStart \|\| requestGeneration !== loadMoreGenerationRef\.current/.test(screen)],
  ["account changes invalidate older load-more UI requests", /loadMoreGenerationRef\.current \+= 1[\s\S]*?setHasMorePosts\(true\)/.test(screen)],
  ["append cursor must move strictly older, not merely differ", /isStrictlyOlderFeedCursor\(candidateCursor, requestedCursor\)/.test(context) && /candidate\.before < requested\.before[\s\S]*?candidate\.beforeId < requested\.beforeId/.test(primitives)],
  ["hide preferences are not written to a cross-account global storage key", !context.includes('const key = "ghc.hidden-post-ids"')],
  ["preference UI distinguishes durable cross-device sync from device-only fallback", screen.includes("Synced across devices") && screen.includes("Saved on this device only")],
  ["legacy preference cache remains account-scoped during server migration", screen.includes('ghc.feed-topic-preferences:${feedPreferenceOwnerId}') && screen.includes('ghc.not-interested-post-ids:${feedPreferenceOwnerId}')],
  ["users can inspect and reset all feed preferences", /hidden posts, topic mutes and ranking preferences are saved to your account/i.test(screen) && /setHiddenPostIds\(\[\]\); setNotInterestedIds\(\[\]\); setMutedTopics\(\[\]\); setSelectedTopic\(null\)/.test(screen)],
  ["new Phase 5 contract is registered in pretypecheck, prebuild and static gates", ["pretypecheck", "prebuild:checks", "verify:static"].every((key) => packageJson.scripts[key]?.includes("check-phase5-feed-quality.mjs") && packageJson.scripts[key]?.includes("test-phase5-feed-quality.mjs"))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
console.log(`Phase 5 feed-quality contract: ${checks.length - failed}/${checks.length}`)
assert.equal(failed, 0, "Phase 5 feed-quality contract failed")
