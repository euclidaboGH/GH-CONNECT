#!/usr/bin/env node
import { readFileSync } from "node:fs"
const feed = readFileSync("components/ghc/enhanced-feed-screen.tsx", "utf8")
const composer = readFileSync("components/ghc/composer-prompt-bar.tsx", "utf8")
const unified = readFileSync("components/ghc/unified-compose.tsx", "utf8")
const postCard = readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
const perf = readFileSync("lib/mobile-performance.ts", "utf8")
const pkg = JSON.parse(readFileSync("package.json", "utf8"))
const feedRoute = readFileSync("app/api/social/feed/route.ts", "utf8")
const checks = [
  ["feed rejects RPC business-error envelopes instead of returning a false durable empty state", feedRoute.includes('payload.ok !== true') && feedRoute.includes('error: "FEED_PAYLOAD_INVALID"') && feedRoute.includes('status: 503')],
  ["feed filter selection persists and restores Saved", feed.includes('v === "saved"') && feed.includes('localStorage.setItem("ghc.feedFilter", activeFilter)')],
  ["filter changes reset page window and scroll position", /handleFeedFilterChange[\s\S]*setDisplayedPostsCount\(MOBILE_PAGE_SIZES\.feed\)[\s\S]*scrollTo\(\{ top: 0/.test(feed)],
  ["server cursor pagination consumes canonical API cursor", feed.includes("refreshFeed({ append: true, limit: 20 })") && readFileSync("contexts/ghc-context.tsx", "utf8").includes("feedCursorRef.current = nextCursor") && readFileSync("contexts/ghc-context.tsx", "utf8").includes("before: requestedCursor?.before")],
  ["pagination uses a synchronous lock against duplicate observer/button events", feed.includes("loadMoreLockRef.current || isLoadingMore") && feed.includes("loadMoreLockRef.current = true") && feed.includes("loadMoreLockRef.current = false")],
  ["manual pagination fallback remains visible", feed.includes('onClick={() => void loadMorePosts()}')],
  ["infinite scroll is rooted in the feed scroller", feed.includes("root: containerRef.current")],
  ["older WebViews safely fall back without IntersectionObserver", feed.includes('typeof IntersectionObserver === "undefined"')],
  ["reduced-data preference is exposed in Feed controls", feed.includes('Reduce data in Feed') && feed.includes("setPreferReducedData(enabled)")],
  ["reduced-data mode suppresses noncritical media prefetch", /if \(preferReducedData\(\)\) return[\s\S]*prefetchMediaFacades/.test(feed)],
  ["media prefetch is bounded to a small first viewport window", feed.includes("rankedPosts.slice(0, 6)") && feed.includes("prefetchMediaFacades(list, 3)")],
  ["platform and local reduced-data policies are centralized", perf.includes("export function preferReducedData") && perf.includes("profile.saveData")],
  ["creator discovery uses unique authors already present in ranked feed", feed.includes("const discoveryCreators = useMemo") && feed.includes("seen.has(id)")],
  ["creator exploration opens the existing profile route", feed.includes('new CustomEvent("ghc:open-profile", { detail: { userId: creator.id } })')],
  ["community discovery is derived from visible post community metadata", feed.includes("const discoveryCommunities = useMemo") && feed.includes("post.communityName")],
  ["topic discovery remains derived from ranked visible posts", feed.includes("rankedPosts.slice(0, 40)") && feed.includes("extractHashtags")],
  ["topic, creator and community rails have accessible labels", feed.includes('aria-label="Topics in your feed"') && feed.includes('aria-label="People and communities in your feed"')],
  ["composer opens with an accessible audience-selection promise", composer.includes("Create a post and choose its audience")],
  ["photo, video and story quick actions have explicit accessible names", composer.includes('aria-label="Create a post with a photo"') && composer.includes('aria-label="Create a post with a video"') && composer.includes('aria-label="Create a story"')],
  ["canonical composer offers public/followers/mutuals/private audience choices", unified.includes('type Audience = "public" | "followers" | "mutuals" | "private"') && unified.includes("Choose post audience")],
  ["canonical composer preserves local draft text and audience", unified.includes("audience?: Audience") && unified.includes("setAudience(d.audience)")],
  ["canonical composer has upload and publish lifecycle feedback", unified.includes("uploading") && unified.includes("publishing")],
  ["post cards expose semantic article and keyboard activation", postCard.includes('role="article"') && postCard.includes('event.key === "Enter"')],
  ["post author profile actions are explicitly named", postCard.includes("Open ${displayAuthor}'s profile")],
  ["post media uses durable URL validation", postCard.includes("isDurableMediaUrl")],
  ["post engagement actions remain in the shared action bar", postCard.includes("PostActionBar")],
  ["feed transparency sheet is mounted for ranked-post explanations", feed.includes("{selectedVisibilityReason && visibilityReasonPostId ? (") && feed.includes("<VisibilityReasonTooltip")],
  ["feed explanation offers a working see-fewer action", feed.includes("onSeeLess={() => {") && postCard.includes("onClick={onSeeLess}")],
  ["see-fewer preferences persist per account with a bounded unique string-ID set", feed.includes('`ghc.not-interested-post-ids:${feedPreferenceOwnerId}`') && feed.includes("notInterestedLoadedFor !== feedPreferenceOwnerId") && feed.includes('typeof id === "string"') && feed.includes(".slice(-200)")],
  ["feed explanation traps focus, restores the prior focus target and dismisses with Escape", postCard.includes('role="dialog"') && postCard.includes('aria-modal="true"') && postCard.includes('event.key === "Escape"') && postCard.includes('event.key !== "Tab"') && postCard.includes('previousActiveElement?.focus()')],
  ["new Phase 1 completion contract is registered in prebuild and static verify", pkg.scripts.prebuild.includes("check-phase1-feed-completion-20261107.mjs") && pkg.scripts["verify:static"].includes("check-phase1-feed-completion-20261107.mjs")],
  ["Phase 1 source remains recorded at 0.330.19 while active release advances independently", Boolean(pkg.version) && readFileSync("docs/PRODUCT-ROADMAP.md", "utf8").includes("Source implementation completed in 0.330.19;")],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failures++ }
if (failures) process.exit(1)
console.log(`Phase 1 Feed completion: ${checks.length}/${checks.length} passed`)
