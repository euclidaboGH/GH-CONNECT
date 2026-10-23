import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const exists = (p) => fs.existsSync(path.join(root, p))
const checks = []
function ok(name, condition, detail = "") { checks.push({ name, pass: Boolean(condition), detail }) }

ok("feed batch migration exists", exists("supabase/migrations/20261023040003_gh_feed_engagement_batch_v2.sql"))
const mig = read("supabase/migrations/20261023040003_gh_feed_engagement_batch_v2.sql")
ok("feed batch RPC is SECURITY DEFINER", /gh_post_feed_engagement_batch[\s\S]*?SECURITY DEFINER/.test(mig))
ok("feed batch RPC service-role only", /REVOKE ALL ON FUNCTION public\.gh_post_feed_engagement_batch[\s\S]*?PUBLIC, anon, authenticated/.test(mig) && /GRANT EXECUTE ON FUNCTION public\.gh_post_feed_engagement_batch[\s\S]*?TO service_role/.test(mig))
ok("feed batch caps input", /LIMIT 50/.test(mig))
ok("feed batch returns comments and reactions", /reactionCounts[\s\S]*?viewerReactions/.test(mig) && /comments/.test(mig))

const feed = read("app/api/social/feed/route.ts")
ok("feed prefers batch hydration", /gh_post_feed_engagement_batch/.test(feed))
ok("feed has no legacy engagement fallback", !/hydrateFeedEngagementLegacy/.test(feed))
ok("feed pagination remains stable", /beforeId/.test(feed) && /nextCursor/.test(feed))

const mobile = read("lib/mobile-performance.ts")
ok("mobile performance profile", /getDevicePerformanceProfile/.test(mobile) && /lowPower/.test(mobile))
ok("non-critical scheduling helper", /scheduleNonCriticalWork/.test(mobile))

const perf = read("lib/performance.ts")
ok("single-flight cleanup", /finally[\s\S]*?requestCache\.delete/.test(perf))

const media = read("components/ghc/media-with-retry.tsx")
ok("media uses optimized image sizing", /optimizedImageUrl/.test(media))
ok("media async decoding", /decoding="async"/.test(media))

const network = read("lib/network-resilience.ts")
ok("connection monitor is demand-driven", /listeners\.length === 0/.test(network) && /60000/.test(network) && /visibilitychange/.test(network))

const notifications = read("components/ghc/notification-bell.tsx")
ok("notification polling is visibility-aware", /visibilitychange/.test(notifications) && /open \? 12000 : 30000/.test(notifications))

const files = fs.readdirSync(path.join(root, "supabase/migrations")).filter((n) => /^\d{14}_.+\.sql$/.test(n))
ok("migration inventory is 131", files.length === 131, `count=${files.length}`)

const packageJson = JSON.parse(read("package.json"))
ok("phase37 test script wired", packageJson.scripts?.["test:phase37-performance-mobile-v2"] === "node scripts/test-phase37-performance-mobile-v2.mjs")
ok("phase37 test included in CI", String(packageJson.scripts?.["ci:verify"] || "").includes("test:phase37-performance-mobile-v2"))

const failed = checks.filter((x) => !x.pass)
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`)
console.log(`\nPHASE 37 PERFORMANCE/MOBILE CHECKS: ${checks.length - failed.length}/${checks.length}`)
if (failed.length) process.exit(1)
