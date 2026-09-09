/**
 * Regression: Daily GHC claim → durable ledger → wallet sync pipeline.
 * No network / no live Supabase — static + pure logic + source guards.
 *
 * Run: node scripts/test-daily-claim-wallet-pipeline.mjs
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

function read(rel) {
  const p = join(root, rel)
  return existsSync(p) ? readFileSync(p, "utf8") : ""
}

console.log("\n=== DAILY CLAIM → WALLET PIPELINE REGRESSION ===\n")

// --- 1. Source chain present ---
console.log("1. Production flow sources")
const dailyRoute = read("app/api/economy/rewards/daily/route.ts")
const db = read("lib/server/economy/db.ts")
const http = read("lib/server/economy/http.ts")
const claimEngine = read("lib/server/economy/claim-engine.ts")
const store = read("lib/server/economy/store.ts")
const walletRoute = read("app/api/economy/wallet/[userId]/route.ts")
const sync = read("lib/domains/adapters/wallet-sync-after-claim.ts")
const dailyUi = read("components/ghc/daily-reward-experience.tsx")
const rpcSql = read("supabase/migrations/20260903_economy_v12_atomic_daily_claim.sql")

assert(dailyRoute.includes("rpcExecuteDailyClaimV12"), "daily route calls atomic RPC")
assert(db.includes("ghc_execute_daily_claim_v12"), "db.ts invokes ghc_execute_daily_claim_v12")
assert(rpcSql.includes("CREATE OR REPLACE FUNCTION public.ghc_execute_daily_claim_v12"), "SQL RPC present")
assert(walletRoute.includes("rpcListTransactions") || walletRoute.includes("isDatabaseConfigured"), "wallet route uses DB when configured")
assert(sync.includes("syncWalletAfterServerClaim"), "wallet sync helper exists")
assert(dailyUi.includes("syncWalletAfterServerClaim"), "daily UI hydrates wallet after claim")
assert(dailyUi.includes("ghc:daily-reward-claimed"), "preserves ghc:daily-reward-claimed event")

// --- 2. Memory forbidden on production/Vercel ---
console.log("\n2. Memory not authoritative in production")
assert(http.includes("GHC_ALLOW_MEMORY_IN_PRODUCTION is intentionally ignored") || http.includes("intentionally ignored"), "emergency memory flag ignored")
assert(http.includes('process.env.VERCEL === "1"') || http.includes("VERCEL_ENV"), "Vercel blocks memory")
assert(store.includes("process-memory store is disabled"), "getProcessGhcStore hard-stops when disallowed")
assert(claimEngine.includes("STREAK_BACKEND_UNAVAILABLE"), "streak fails closed when DB misbehaves")
assert(dailyRoute.includes("In-memory claims are disabled"), "daily route error rejects memory on deploy")

// Simulate allowMemoryServer rules (mirror of http.ts)
function simulateAllowMemory({ db, vercel, vercelEnv, nodeEnv, ghcEnv, memFlag }) {
  if (db) return false
  if (vercel || vercelEnv) return false
  if (nodeEnv === "production" || ghcEnv === "production") return false
  if (nodeEnv === "test") return true
  if (nodeEnv === "development") return true
  if (memFlag) return true
  return false
}
assert(
  !simulateAllowMemory({
    db: false,
    vercel: true,
    vercelEnv: "production",
    nodeEnv: "production",
    ghcEnv: undefined,
    memFlag: true,
  }),
  "Vercel production: memory false even with GHC_SERVER_MEMORY=1"
)
assert(
  !simulateAllowMemory({
    db: false,
    vercel: true,
    vercelEnv: "preview",
    nodeEnv: "production",
    ghcEnv: undefined,
    memFlag: true,
  }),
  "Vercel preview: memory false"
)
assert(
  simulateAllowMemory({
    db: false,
    vercel: false,
    vercelEnv: undefined,
    nodeEnv: "development",
    ghcEnv: undefined,
    memFlag: false,
  }),
  "local development: memory allowed without DB"
)
assert(
  !simulateAllowMemory({
    db: true,
    vercel: false,
    vercelEnv: undefined,
    nodeEnv: "development",
    ghcEnv: undefined,
    memFlag: true,
  }),
  "DB configured: memory never used"
)

// --- 3. Idempotency / 80-20 in SQL ---
console.log("\n3. RPC idempotency and 80/20 reserve")
assert(rpcSql.includes("alreadyClaimed"), "RPC returns alreadyClaimed")
assert(rpcSql.includes("idempotent"), "RPC returns idempotent")
assert(rpcSql.includes("last_claim_day_key") || rpcSql.includes("p_claim_day_key"), "day-key guard")
assert(rpcSql.includes("FOR UPDATE"), "streak row locked for concurrency")
assert(rpcSql.includes("USER_SHARE_MISMATCH") || rpcSql.includes("0.8"), "80% user share enforced")
assert(rpcSql.includes("p_reserve_amount") && rpcSql.includes(":reserve"), "20% reserve accounting present")

// Pure 80/20 micro split (same as claim-engine)
const GHC_MICRO = 1_000_000
function split80_20(grossMicro) {
  const g = Math.max(0, Math.trunc(grossMicro))
  const userMicro = Math.floor((g * 80) / 100)
  return { userMicro, reserveMicro: g - userMicro }
}
const sample = split80_20(Math.round(1.0 * GHC_MICRO))
assert(sample.userMicro + sample.reserveMicro === 1_000_000, "split preserves gross micros")
assert(sample.userMicro === 800_000, "user gets 80%")
assert(sample.reserveMicro === 200_000, "reserve gets 20%")

// --- 4. Client does not invent balance ---
console.log("\n4. Client sync does not invent balance")
assert(!sync.includes("balance +=") && !sync.includes("balance+="), "sync does not increment balance")
assert(sync.includes("hydrate") || sync.includes("/api/economy/wallet"), "sync fetches server wallet")
assert(sync.includes("WALLET_BALANCE_UPDATED"), "emits WALLET_BALANCE_UPDATED after hydrate")
assert(sync.includes("do not optimistically") || sync.includes("Never invent") || sync.includes("do not invent") || sync.includes("last known"), "documents no fabricate policy")

// --- 5. Wallet UI listens for claim sync ---
console.log("\n5. Wallet UI rebinds after claim")
const walletScreen = read("features/wallet/wallet-screen.tsx")
const walletRead = read("contexts/domains/wallet-read-provider.tsx")
assert(walletScreen.includes("ghc:daily-reward-claimed") || walletScreen.includes("ghc:wallet-synced"), "wallet screen listens for claim/sync")
assert(walletRead.includes("ghc:daily-reward-claimed") || walletRead.includes("ghc:wallet-synced"), "wallet read provider listens for claim/sync")

// --- 6. Other economy routes still DB-preferring ---
console.log("\n6. Other economy features still server-path first")
const transfer = read("app/api/economy/transfers/route.ts")
const spend = read("app/api/economy/ledger/spend/route.ts")
assert(transfer.includes("rpcExecuteTransfer") || transfer.includes("isDatabaseConfigured"), "transfers prefer DB")
assert(spend.includes("isDatabaseConfigured") || spend.includes("rpc"), "spend uses DB path")

// --- 7. Failed DB / missing config ---
console.log("\n7. Missing DB configuration fails closed")
assert(http.includes("DURABLE_ECONOMY_CONFIG_ERROR") || http.includes("In-memory balances are not available"), "clear config error constant")
assert(dailyRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "daily 503 mentions Supabase key")

console.log("\n=== RESULTS ===")
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed) {
  console.error("PIPELINE REGRESSION FAILED")
  process.exit(1)
}
console.log("ALL DAILY CLAIM → WALLET PIPELINE CHECKS PASSED")
console.log("\nNOTE: Live multi-instance Supabase verification is NOT performed by this script.")
console.log("Deploy with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and claim twice across instances to confirm.\n")
