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


const candidateTypes = src("lib/ghc-types.ts")
const discoverySearch = src("lib/discovery-search-utils.ts")
const discoveryRanking = src("lib/discovery-ranking.ts")
const packageJson = JSON.parse(src("package.json"))

ok("Candidate profile enrichment fields are explicitly typed", ["city?: string", "profession?: string", "joinedAt?: number | string", "relationshipType?: string | string[]"].every((field) => candidateTypes.includes(field)))
ok("discovery search result collections use explicit contracts", discoverySearch.includes("interface DiscoverySearchCommunity") && discoverySearch.includes("interface DiscoverySearchBusiness") && !/communities:\s*any\[\]/.test(discoverySearch) && !/businesses:\s*any\[\]/.test(discoverySearch))
ok("discovery ranking no longer uses unchecked any casts for candidate profile fields", !/candidate as any/.test(discoveryRanking))
ok("search recency safely accepts numeric and ISO timestamps", discoverySearch.includes("Date.parse(value)") && discoverySearch.includes("age >= 0"))
ok("new-member recommendations reject future or invalid timestamps", discoverySearch.includes("daysSinceJoined >= 0 && daysSinceJoined < 7"))
ok("Phase 8 architecture test is exposed as an npm script", packageJson.scripts?.["test:phase8-architecture-quality"] === "node scripts/test-phase8-production-hardening.mjs")
ok("Phase 8 architecture test is wired into ci:verify", packageJson.scripts?.["ci:verify"]?.includes("npm run test:phase8-architecture-quality"))

const failed = checks.filter(c => !c.pass)
for (const c of checks) console.log(`${c.pass ? "  ✓" : "  ✗"} ${c.name}`)
console.log(`\nPhase 8 architecture-quality checks: ${checks.length - failed.length} pass, ${failed.length} fail`)
if (failed.length) process.exit(1)
