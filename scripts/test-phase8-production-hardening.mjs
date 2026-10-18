import { existsSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const checks = []
function ok(name, condition) {
  checks.push({ name, pass: Boolean(condition) })
}
function src(rel) {
  return readFileSync(join(root, rel), "utf8")
}

const rewardRoute = src("app/api/economy/rewards/evaluate/route.ts")
const rewardEngine = src("lib/server/economy/reward-engine.ts")
const walletRepo = src("lib/domains/http-repositories.ts")
const walletDb = src("lib/server/economy/db.ts")
const nextConfig = src("next.config.mjs")
const phaseMigrations = [
  "supabase/migrations/202610150001_gh_post_list_feed_stable_cursor.sql",
  "supabase/migrations/202610150002_gh_comment_stable_cursor.sql",
  "supabase/migrations/202610150003_ghc_wallet_snapshot_spendable.sql",
]

ok("reward route requires authentication", rewardRoute.includes("resolveAuthenticatedUser"))
ok("reward route is locked to Daily-Claim-only issuance", rewardRoute.includes("GHC_ISSUANCE_POLICY_LOCKED"))
ok("reward route does not pass client input to an issuer", !rewardRoute.includes("evaluateRewardAuthoritative"))
ok("reward engine denies generic issuance at domain boundary", rewardEngine.includes("DAILY_CLAIM_ONLY_ISSUANCE"))
ok("reward engine has no generic staging or emission bypass", !rewardEngine.includes("rpcActivityStageReward") && !rewardEngine.includes("computeAndCommitActivityEmissionDurable"))
ok("Daily Claim remains the dedicated issuance path", rewardRoute.includes("only through Daily Claim"))
ok("server wallet repository retains authoritative snapshot", walletRepo.includes("authoritativeWallet"))
ok("wallet snapshot has spendable/locked authority", walletDb.includes("rpcWalletSnapshot"))
ok("production build does not ignore TypeScript errors", nextConfig.includes("ignoreBuildErrors: false"))
ok("production build does not ignore ESLint", nextConfig.includes("ignoreDuringBuilds: false"))
for (const file of phaseMigrations) ok(`phase migration present: ${file}`, existsSync(join(root, file)))

// High-risk anti-patterns in server financial/reward code.
const serverFiles = [rewardRoute, rewardEngine, walletDb]
ok("no NEXT_PUBLIC service-role key in core server files", serverFiles.every(s => !s.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")))
ok("no NEXT_PUBLIC Pi API key in core server files", serverFiles.every(s => !s.includes("NEXT_PUBLIC_PI_API_KEY")))
ok("claim path uses server repository", walletRepo.includes("claimPendingReward"))

const failed = checks.filter(c => !c.pass)
for (const c of checks) console.log(`${c.pass ? "  ✓" : "  ✗"} ${c.name}`)
console.log(`\nPhase 8 hardening checks: ${checks.length - failed.length} pass, ${failed.length} fail`)
if (failed.length) process.exit(1)
