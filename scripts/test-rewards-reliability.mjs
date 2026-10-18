/**
 * Regression checks for durable daily-reward availability and claim correctness.
 * Static/source-only: no live database or external network is used.
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`) }
  else { failed++; console.error(`  ✗ ${message}`) }
}
function read(path) {
  const full = join(root, path)
  return existsSync(full) ? readFileSync(full, "utf8") : ""
}

console.log("\n=== REWARDS RELIABILITY REGRESSION ===\n")
const route = read("app/api/economy/rewards/daily/route.ts")
const hook = read("components/ghc/use-daily-claim-status.ts")
const daily = read("components/ghc/daily-reward-experience.tsx")
const hero = read("components/ghc/rewards-journey-hero.tsx")
const packageJson = JSON.parse(read("package.json") || "{}")

console.log("1. Server-authoritative availability")
assert(route.includes("export async function GET(request: Request)"), "daily route exposes authenticated GET status")
assert(route.includes("resolveAuthenticatedUser(request.headers)"), "daily status requires authenticated identity")
assert(route.includes("loadClaimStreakState(auth.userId)"), "daily status reads durable per-user streak state")
assert(route.includes("claimable: !claimedToday"), "claimability derives from server reward-day key")
assert(route.includes("alreadyClaimed: true") && route.includes("idempotent: true"), "duplicate claim responds idempotently without crediting twice")
assert(route.includes('computed.error === "SERVER_UNAVAILABLE" ? 503 : 400'), "backend outage is not misreported as a client input error")
assert(route.includes('"Cache-Control": "no-store, max-age=0"'), "status response is not cached")
assert(hook.includes('fetch("/api/economy/rewards/daily"') && hook.includes('method: "GET"'), "client reconciles against daily status endpoint")

console.log("\n2. Reward-day rollover and recovery")
assert(hook.includes("lagosDayKey()"), "reward day uses Africa/Lagos day key")
assert(hook.includes("setInterval(checkDay, 30_000)"), "long-open tabs detect reward-day rollover")
assert(hook.includes('window.addEventListener("focus", onResume)'), "focus restores status after suspended tab")
assert(hook.includes('window.addEventListener("online", onResume)'), "network return refreshes status")
assert(hook.includes('document.addEventListener("visibilitychange", onResume)'), "visibility return refreshes status")
assert(daily.includes("const currentDay = lagosDayKey()") && daily.includes("setRefreshKey((key) => key + 1)"), "home reward sheet re-evaluates at day rollover")
assert(hero.includes("useDailyClaimStatus(userId)"), "Rewards Centre hero uses server status")

console.log("\n3. Claim failure and economy safety")
assert(!daily.includes("/api/economy/rewards/evaluate") && !daily.includes("/api/economy/rewards/claim"), "daily claim cannot fall back to generic reward evaluation/claim")
assert(daily.includes("server.alreadyClaimed") && daily.includes("markDailyClaimedForUi(userId)"), "only confirmed idempotent claims synchronize local claimed state")
assert(daily.includes("Claim failed — your reward is still available to retry"), "failed daily request leaves the claim available")
assert(hero.includes('res.status === 409 || data.code === "ALREADY_CLAIMED_TODAY" || data.alreadyClaimed === true || data.idempotent === true'), "hero recognizes confirmed already-claimed response")
assert(hero.includes("Claim failed — your reward remains available to retry"), "failed claim tells user reward can be retried")
assert(daily.includes("syncWalletAfterServerClaim"), "wallet refresh remains server-ledger based")
assert(daily.includes("ghc:daily-reward-claimed"), "successful claim keeps shared refresh event")

console.log("\n4. Test integration")
assert(packageJson.scripts?.["test:rewards-reliability"] === "node scripts/test-rewards-reliability.mjs", "dedicated reward reliability test command exists")
assert(packageJson.scripts?.["verify:static"]?.includes("test-rewards-reliability.mjs") || read("scripts/verify-phase14-static.mjs").includes("test-rewards-reliability.mjs"), "static verification runner includes reward reliability")

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`)
if (failed) process.exit(1)
console.log("REWARDS RELIABILITY REGRESSION PASSED\n")
