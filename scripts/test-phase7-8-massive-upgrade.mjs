import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const card = read("components/ghc/enhanced-post-card.tsx")
const context = read("contexts/ghc-context.tsx")
const search = read("lib/discovery-search-utils.ts")
const discovery = read("lib/discovery-features-engine.ts")
const ranking = read("lib/discovery-ranking.ts")
const types = read("lib/ghc-types.ts")
const pkg = JSON.parse(read("package.json"))

const checks = []
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) })

// Phase 7: real feed pagination, lifecycle and interaction correctness.
check("feed pagination has an explicit terminal state", feed.includes("const [hasMorePosts, setHasMorePosts] = useState(true)"))
check("feed reveals already-hydrated posts before network pagination", feed.includes("displayedPostsCount < rankedPosts.length") && feed.includes("Math.min(rankedPosts.length, prev + MOBILE_PAGE_SIZES.feed)"))
check("feed stops requesting pages after an empty server result", feed.includes("if (fetchedCount === 0) {\n        setHasMorePosts(false)"))
check("feed does not mark pagination exhausted before initial hydration settles", feed.includes("posts.length === 0 && !feedBootstrapped"))
check("feed sentinel remains available while server pages may exist", feed.includes("{hasMorePosts && <div ref={observerTargetRef}"))
check("feed does not claim caught-up until pagination is exhausted", feed.includes("displayedPostsCount >= rankedPosts.length && !hasMorePosts"))
check("refresh reports actual newly fetched count rather than raw page length", context.includes("existingIdsBeforeMerge") && context.includes("appended: newlyFetchedCount"))
check("refreshFeed keeps a stable callback while reading the current post snapshot", context.includes("const postsSnapshotRef = useRef(state.posts)") && context.includes("postsSnapshotRef.current = state.posts") && context.includes("}, [state.posts])") && context.includes("existingIdsBeforeMerge = new Set(postsSnapshotRef.current"))
check("post gallery resets when post or durable-media identity changes", card.includes("const galleryIdentity = realImages.join") && card.includes("[post.id, galleryIdentity]"))
check("post interaction timers are cleaned up on unmount", card.includes("useEffect(() => () =>") && card.includes("clearTimeout(pressTimerRef.current)") && card.includes("clearTimeout(curationLongPressTimerRef.current)"))
check("view qualification tracking resets for recycled post cards", card.includes("visibleSinceRef.current = null") && card.includes("qualifiedSentRef.current = false"))
check("post media-type label uses durable URL validation", card.includes("const realImages = (post.images || []).filter((u) => typeof u === \"string\" && isDurableMediaUrl(u))"))

// Phase 8: typed search contracts, ranking correctness and bounded cache behavior.
check("message search uses typed Conversation[] input", search.includes("searchMessages(query: string, conversations: Conversation[])") && !search.includes("conversations: any[]"))
check("message search uses canonical message text and timestamp fields", search.includes("typeof message.text === \"string\"") && search.includes("message.createdAt"))
check("message search ignores blank queries and malformed message arrays", search.includes("if (!normalizedQuery) return []") && search.includes("if (!Array.isArray(conversation.messages)) continue"))
check("message search retains compatibility for legacy message fields", search.includes("content?: string; timestamp?: number; senderName?: string"))
check("group message search does not mislabel every non-participant as You", search.includes("conversation.conversationType === \"group\""))
check("search ranking does not return unrelated profiles for recency or verification bonuses", search.includes("if (score === 0) return { item: candidate, score, matchType }"))
check("search cache is bounded and returns independent result arrays", search.includes("private readonly maxEntries = 100") && search.includes("people: [...cached.results.people]"))
check("search cache normalizes query keys and rejects invalid TTLs", search.includes("const key = normalizeSearchText(query)") && search.includes("ttl <= 0"))
check("search history validates stored data before returning it", search.includes("if (!Array.isArray(parsed)) return []") && search.includes("typeof value.timestamp === \"number\""))
check("discovery filters include profession and education", discovery.includes("professions.includes(normalize(candidate.profession))") && discovery.includes("education.includes(normalize(candidate.education))"))
check("discovery filtering does not treat missing distance as zero", discovery.includes("typeof candidate.distance === \"number\"") && discovery.includes("candidate.distance >= 0"))
check("discovery engine no longer uses untyped any escape hatches", !/as any|:\s*any\[\]|:\s*any\b/.test(discovery + search + ranking))
check("future last-active timestamps do not receive a recency bonus", ranking.includes("ageMs >= 0 && ageMs < 7 * 86400000"))
check("discovery ranking normalizes interest, location and profession comparisons", ranking.includes("function normalizeText") && ranking.includes("normalizeText(candidate.profession)"))
check("candidate model declares optional discovery engagement data", types.includes("engagement?: number"))
check("massive Phase 7/8 regression test is included in CI", pkg.scripts?.["test:phase7-8-massive-upgrade"] === "node scripts/test-phase7-8-massive-upgrade.mjs" && pkg.scripts?.["ci:verify"]?.includes("npm run test:phase7-8-massive-upgrade"))

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`)
const failures = checks.filter((item) => !item.ok)
console.log(`\nPhase 7–8 massive upgrade checks: ${checks.length - failures.length}/${checks.length} passed`)
if (failures.length) process.exit(1)
