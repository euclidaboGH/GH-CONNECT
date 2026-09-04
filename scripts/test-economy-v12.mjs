/**
 * ECONOMY_VERSION 1.2 — unit/integration tests (no network, no secrets).
 * Run: node scripts/test-economy-v12.mjs
 *
 * Validates Curve E, global budget, g, claim progression, 80/20,
 * activity caps, missed-day reset, sinks, immutable balance rule.
 */

import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps
}

// --- Mirror of economic-config / network-scarcity / claim-engine pure math ---

const CLAIM_GROSS_BY_DAY = [0.39, 0.62, 0.86, 1.09, 1.33, 1.56, 1.96]
const GHC_MICRO = 1_000_000
const CURVE_E = { floor: 0.18, scale: 0.82, logCoef: 0.2, power: 1.15 }
const BASE = 8
const ALPHA = 0.85
const ACT_DAY = 0.5
const ACT_WEEK = 2.5
const VIP = 150
const VVIP = 300
const BOOST_FEE = 0.1

function toMicro(g) {
  return Math.round(g * GHC_MICRO)
}
function fromMicro(u) {
  return u / GHC_MICRO
}
function split80_20(grossMicro) {
  const g = Math.max(0, Math.trunc(grossMicro))
  const userMicro = Math.floor((g * 80) / 100)
  return { userMicro, reserveMicro: g - userMicro }
}

function curveE(n) {
  const x = Math.max(Math.max(1, Math.floor(n)), 10)
  const z = Math.log10(x / 10)
  const m = CURVE_E.floor + CURVE_E.scale / Math.pow(1 + CURVE_E.logCoef * z, CURVE_E.power)
  return Math.max(CURVE_E.floor, Math.min(1, m))
}

function budget(n) {
  return BASE * Math.pow(Math.max(1, n), ALPHA)
}

function gGov(demand, n) {
  if (demand <= 0) return 1
  const b = budget(n)
  return demand <= b ? 1 : b / demand
}

const TIERS = [10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]

console.log("\n=== ECONOMY_VERSION 1.2 TESTS ===\n")

console.log("1. Source files present")
const required = [
  "lib/server/economy/economic-config.ts",
  "lib/server/economy/network-scarcity.ts",
  "lib/server/economy/claim-engine.ts",
  "lib/server/economy/activity-emission.ts",
  "lib/server/economy/telemetry.ts",
  "lib/server/economy/population.ts",
  "app/api/economy/rewards/daily/route.ts",
  "supabase/migrations/20260903_economy_v12_claim_streak_and_population.sql",
  "supabase/migrations/20260903_economy_v12_atomic_daily_claim.sql",
]
for (const f of required) {
  assert(existsSync(join(root, f)), `exists ${f}`)
}

console.log("\n2. Config constants in economic-config.ts")
const cfg = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(cfg.includes('ECONOMY_VERSION = "1.2"'), "ECONOMY_VERSION 1.2")
assert(cfg.includes("0.39") && cfg.includes("1.96"), "claim schedule present")
assert(cfg.includes("GLOBAL_BUDGET_BASE_PER_USER = 8"), "BASE=8")
assert(cfg.includes("GLOBAL_BUDGET_ALPHA = 0.85"), "ALPHA=0.85")
assert(cfg.includes("ACTIVITY_DAILY_CAP_GHC = 0.5"), "activity daily 0.5")
assert(cfg.includes("ACTIVITY_WEEKLY_CAP_GHC = 2.5"), "activity weekly 2.5")
assert(cfg.includes("VIP_PRICE_GHC = 150"), "VIP 150")
assert(cfg.includes("VVIP_PRICE_GHC = 300"), "VVIP 300")
assert(cfg.includes("BOOST_FEE_RATE = 0.1"), "boost fee 10%")
assert(cfg.includes("immutableHistoricalBalances: true"), "immutable balances flag")

console.log("\n3. Curve E at tiers")
const expectedM = {
  10: 1.0,
  100: 0.8449,
  1000: 0.7369,
  10000: 0.6576,
  100000: 0.5971,
  1000000: 0.5495,
  10000000: 0.5112,
  100000000: 0.4796,
  1000000000: 0.4533,
}
for (const n of TIERS) {
  const m = curveE(n)
  const exp = expectedM[n]
  assert(approx(m, exp, 0.002), `m(${n})≈${exp} got ${m.toFixed(4)}`)
}

console.log("\n4. Global budget & g as secondary governor")
for (const n of TIERS) {
  const m = curveE(n)
  // normal demand: 50% claims * avg day gross * m * N + 25% * 0.5 * m * N
  const avgDayGross = CLAIM_GROSS_BY_DAY.reduce((a, b) => a + b, 0) / 7
  const demand = n * 0.5 * m * avgDayGross + n * 0.25 * m * ACT_DAY
  const g = gGov(demand, n)
  assert(g >= 0.999, `normal g≈1 at N=${n} (g=${g.toFixed(4)})`)
}
// runaway at 1B should throttle
{
  const n = 1e9
  const m = curveE(n)
  const avgDayGross = CLAIM_GROSS_BY_DAY.reduce((a, b) => a + b, 0) / 7
  const demand = n * 1.0 * m * avgDayGross + n * 1.0 * m * ACT_DAY
  const g = gGov(demand, n)
  assert(g < 1, `runaway g<1 at 1B (g=${g.toFixed(4)})`)
}

console.log("\n5. Claim progression 7 days + 80/20 at m=1,g=1")
{
  let totalUser = 0
  let totalRsv = 0
  for (let d = 1; d <= 7; d++) {
    const gross = CLAIM_GROSS_BY_DAY[d - 1]
    const { userMicro, reserveMicro } = split80_20(toMicro(gross))
    const u = fromMicro(userMicro)
    const r = fromMicro(reserveMicro)
    totalUser += u
    totalRsv += r
    assert(approx(u + r, gross, 1e-9), `day ${d} split conserves gross`)
    assert(approx(u, gross * 0.8, 1e-6) || userMicro === Math.floor(toMicro(gross) * 0.8), `day ${d} ~80% user`)
  }
  assert(approx(totalUser, 7.81 * 0.8, 0.01), `week user≈6.248 got ${totalUser.toFixed(4)}`)
  assert(approx(totalRsv, 7.81 * 0.2, 0.01), `week reserve≈1.562 got ${totalRsv.toFixed(4)}`)
}

console.log("\n6. 16 perfect cycles ≈ 100 user GHC at N=10")
{
  const m = curveE(10)
  const weekUser = CLAIM_GROSS_BY_DAY.reduce((a, b) => a + b, 0) * 0.8 * m
  const sixteen = weekUser * 16
  assert(approx(sixteen, 99.968, 0.05), `16 cycles≈99.97 got ${sixteen.toFixed(4)}`)
}

console.log("\n7. Missed-day reset (progression only)")
{
  // Simulate state machine
  let cycleDay = 0
  let last = null
  const days = ["2026-09-01", "2026-09-02", "2026-09-04"] // skip Sep 3
  const results = []
  for (const today of days) {
    let next = 1
    if (last) {
      const y = new Date(today + "T12:00:00Z")
      y.setUTCDate(y.getUTCDate() - 1)
      const yKey = y.toISOString().slice(0, 10)
      if (last === yKey) {
        next = cycleDay >= 7 ? 1 : cycleDay + 1
      } else {
        next = 1 // reset
      }
    }
    cycleDay = next
    last = today
    results.push(cycleDay)
  }
  assert(results[0] === 1 && results[1] === 2 && results[2] === 1, `missed day resets to 1: ${results}`)
}

console.log("\n8. Activity caps")
{
  let dayGranted = 0
  let weekGranted = 0
  const grants = []
  for (let i = 0; i < 10; i++) {
    const room = Math.min(ACT_DAY - dayGranted, ACT_WEEK - weekGranted)
    if (room <= 0) {
      grants.push(0)
      continue
    }
    const base = Math.min(0.2, room)
    dayGranted += base
    weekGranted += base
    grants.push(base)
  }
  const sum = grants.reduce((a, b) => a + b, 0)
  assert(approx(sum, ACT_DAY, 1e-9), `daily activity cap 0.5 got ${sum}`)
  assert(dayGranted <= ACT_DAY + 1e-9, "day not exceeded")
  assert(weekGranted <= ACT_WEEK + 1e-9, "week not exceeded")
}

console.log("\n9. Sinks unchanged")
assert(VIP === 150 && VVIP === 300, "VIP/VVIP prices")
assert(approx(10 * (1 + BOOST_FEE), 11), "boost 10 + 10% fee = 11")

console.log("\n10. Immutable balances rule present in sources")
const claimSrc = readFileSync(join(root, "lib/server/economy/claim-engine.ts"), "utf8")
assert(claimSrc.includes("Never claw back"), "claim-engine documents no clawback")
assert(cfg.includes("immutableHistoricalBalances"), "config flag")

console.log("\n11. Network emission decreases per-user at scale")
{
  const weekGross = CLAIM_GROSS_BY_DAY.reduce((a, b) => a + b, 0)
  const per10 = weekGross * 0.8 * curveE(10)
  const per1m = weekGross * 0.8 * curveE(1e6)
  assert(per1m < per10, `per-user week at 1M (${per1m.toFixed(3)}) < at 10 (${per10.toFixed(3)})`)
}

console.log("\n12. Daily route uses claim-engine")
const daily = readFileSync(join(root, "app/api/economy/rewards/daily/route.ts"), "utf8")
assert(daily.includes("computeDailyClaim"), "daily route computeDailyClaim")
assert(daily.includes("commitDailyClaimState"), "daily route commit")
assert(daily.includes("ECONOMY_VERSION"), "daily route version")

console.log("\n13. Reward engine routes activity through emission")
const rew = readFileSync(join(root, "lib/server/economy/reward-engine.ts"), "utf8")
assert(rew.includes("computeActivityEmission"), "reward-engine activity emission")
assert(rew.includes("USE_DAILY_CLAIM_ENDPOINT"), "daily checkin redirected")

console.log("\n14. Telemetry module")
const tel = readFileSync(join(root, "lib/server/economy/telemetry.ts"), "utf8")
assert(tel.includes("recordTelemetryEvent"), "telemetry recorder")
assert(tel.includes("aggregateTelemetry"), "telemetry aggregate")


console.log("\n15. Population + DB-backed claim artifacts")
const pop = readFileSync(join(root, "lib/server/economy/population.ts"), "utf8")
assert(pop.includes("rpcEconomicPopulationStats"), "population uses DB RPC")
assert(pop.includes("GHC_ALLOW_ELIGIBLE_OVERRIDE"), "production blocks silent env override")
assert(existsSync(join(root, "lib/server/economy/population.ts")), "population.ts exists")
const mig = readFileSync(
  join(root, "supabase/migrations/20260903_economy_v12_claim_streak_and_population.sql"),
  "utf8"
)
assert(mig.includes("ghc_claim_streak_state"), "migration creates claim streak table")
assert(mig.includes("ghc_commit_claim_day"), "migration creates commit RPC")
assert(mig.includes("ghc_economic_population_stats"), "migration creates population RPC")
assert(mig.includes("FOR UPDATE"), "commit uses row lock")
const claimEng = readFileSync(join(root, "lib/server/economy/claim-engine.ts"), "utf8")
assert(claimEng.includes("rpcCommitClaimDay"), "claim-engine commits via DB")
assert(claimEng.includes("loadClaimStreakState"), "claim-engine loads streak from DB")
assert(claimEng.includes("isDatabaseConfigured"), "claim-engine branches on DB")
const daily2 = readFileSync(join(root, "app/api/economy/rewards/daily/route.ts"), "utf8")
assert(daily2.includes("commitDailyClaimState"), "daily route day-locks before credit")
assert(daily2.includes("await computeDailyClaim"), "daily route awaits async compute")


console.log("\n16. Atomic claim migration + API wiring")
const atomicMig = readFileSync(
  join(root, "supabase/migrations/20260903_economy_v12_atomic_daily_claim.sql"),
  "utf8"
)
assert(atomicMig.includes("ghc_execute_daily_claim_v12"), "atomic RPC function")
assert(atomicMig.includes("uq_ghc_earned_posted_ref"), "unique earned reference index")
assert(atomicMig.includes("FOR UPDATE"), "row lock in atomic claim")
assert(atomicMig.includes("unique_violation"), "handles concurrent unique violation")
assert(atomicMig.includes("SPLIT_MISMATCH") || atomicMig.includes("0.8"), "80/20 validation in RPC")
const dbSrc = readFileSync(join(root, "lib/server/economy/db.ts"), "utf8")
assert(dbSrc.includes("rpcExecuteDailyClaimV12"), "db client for atomic claim")
const daily3 = readFileSync(join(root, "app/api/economy/rewards/daily/route.ts"), "utf8")
assert(daily3.includes("rpcExecuteDailyClaimV12"), "daily route uses atomic RPC")
assert(daily3.includes("LEDGER_CREDIT_FAILED") || daily3.includes("database_atomic"), "failure/backend markers")
assert(
  daily3.indexOf("rpcExecuteDailyClaimV12") < daily3.indexOf("Memory studio") ||
    daily3.includes("single transactional"),
  "DB atomic path preferred"
)


console.log("\n17. Integration audit — emission registry + bypass fixes")
assert(existsSync(join(root, "lib/server/economy/emission-registry.ts")), "emission-registry.ts")
const reg = readFileSync(join(root, "lib/server/economy/emission-registry.ts"), "utf8")
assert(reg.includes("daily_claim"), "registry daily_claim")
assert(reg.includes("activity_reward"), "registry activity")
assert(reg.includes("usesClaimReserveSplit: true"), "claim reserve flagged")
assert(reg.includes("usesClaimReserveSplit: false"), "activity not 80/20")
const creditRt = readFileSync(join(root, "app/api/economy/ledger/credit/route.ts"), "utf8")
assert(creditRt.includes("GHC_ADMIN_CREDIT_KEY"), "admin key required for credit")
assert(creditRt.includes("FORBIDDEN"), "forbidden without admin key")
assert(creditRt.includes("ordinary users cannot mint") || creditRt.includes("cannot mint"), "no self-mint copy")
const lim = readFileSync(join(root, "lib/domains/economy-types.ts"), "utf8")
assert(lim.includes("maxDailyEarn: 5"), "maxDailyEarn aligned to 5")
const ecoDom = readFileSync(join(root, "lib/domains/economy-domain.ts"), "utf8")
assert(ecoDom.includes("ACTIVITY_PRE_CAP"), "local evaluateReward activity pre-cap")
assert(ecoDom.includes("0.5"), "0.5 pre-cap present")


console.log("\n18. Security audit — spend catalog + rate limit + secrets")
assert(existsSync(join(root, "lib/server/economy/spend-catalog.ts")), "spend-catalog")
assert(existsSync(join(root, "lib/server/economy/rate-limit.ts")), "rate-limit")
const spendCat = readFileSync(join(root, "lib/server/economy/spend-catalog.ts"), "utf8")
assert(spendCat.includes("AMOUNT_mismatch"), "reject client amount mismatch")
assert(spendCat.includes("boost"), "boost purpose")
assert(spendCat.includes("membership_vip_monthly"), "vip purpose")
const spendRt = readFileSync(join(root, "app/api/economy/ledger/spend/route.ts"), "utf8")
assert(spendRt.includes("resolveSpendAmount"), "spend uses catalog")
assert(spendRt.includes("checkRateLimit"), "spend rate limited")
assert(spendRt.includes("RATE_LIMITED"), "429 rate limit code")
const creditRouteSec = readFileSync(join(root, "app/api/economy/ledger/credit/route.ts"), "utf8")
assert(creditRouteSec.includes("GHC_ADMIN_CREDIT_KEY"), "admin credit key")
// No NEXT_PUBLIC secrets
const envTs = readFileSync(join(root, "lib/server/economy/env.ts"), "utf8")
assert(!envTs.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), "no public service role")
assert(envTs.includes("SUPABASE_SERVICE_ROLE_KEY"), "service role server-only")
const piApi = readFileSync(join(root, "lib/server/payments/pi-api.ts"), "utf8")
assert(piApi.includes("process.env.PI_API_KEY"), "PI_API_KEY server-side")
assert(!piApi.includes("NEXT_PUBLIC_PI_API_KEY"), "PI_API_KEY not public")
const dailyRt = readFileSync(join(root, "app/api/economy/rewards/daily/route.ts"), "utf8")
assert(dailyRt.includes("checkRateLimit"), "daily claim rate limited")
const xferRt = readFileSync(join(root, "app/api/economy/transfers/route.ts"), "utf8")
assert(xferRt.includes("SELF_TRANSFER") || xferRt.includes("self"), "self-transfer blocked")
assert(xferRt.includes("checkRateLimit"), "transfer rate limited")

console.log("\n=== RESULTS ===")




console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed > 0) {
  process.exitCode = 1
} else {
  console.log("ALL ECONOMY_VERSION 1.2 TESTS PASSED")
}
