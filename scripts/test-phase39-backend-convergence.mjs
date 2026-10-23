import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
let passed = 0
let failed = 0
function ok(name, condition) {
  if (condition) { passed++; console.log(`PASS ${name}`) }
  else { failed++; console.error(`FAIL ${name}`) }
}
function read(file) { return fs.readFileSync(path.join(root, file), "utf8") }

const packageJson = JSON.parse(read("package.json"))
const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter((x) => x.endsWith(".sql")).sort()
const claimClient = read("lib/rewards/claim-daily-client.ts")
const claimStatus = read("components/ghc/use-daily-claim-status.ts")
const prompt = read("components/ghc/daily-claim-prompt.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const dailyExperience = read("components/ghc/daily-reward-experience.tsx")
const hero = read("components/ghc/rewards-journey-hero.tsx")
const systemStatus = read("app/api/system/status/route.ts")
const authority = read("lib/server/platform/backend-authority.ts")

ok("phase39 script wired", packageJson.scripts?.["test:phase39-backend-convergence"] === "node scripts/test-phase39-backend-convergence.mjs")
ok("phase39 included in CI", String(packageJson.scripts?.["ci:verify"] || "").includes("test:phase39-backend-convergence"))
ok("migration inventory remains 131", migrations.length === 131)
ok("canonical daily client boundary exists", claimClient.includes('"/api/economy/rewards/daily"') && claimClient.includes("postDailyClaim") && claimClient.includes("getDailyClaimStatus"))
ok("daily status hook uses canonical client", claimStatus.includes("getDailyClaimStatus") && !claimStatus.includes('fetch("/api/economy/rewards/daily"'))
ok("daily reward experience uses canonical claim client", dailyExperience.includes("postDailyClaim") && !dailyExperience.includes("creditDailyToWallet"))
ok("rewards journey uses canonical claim client", hero.includes("postDailyClaim") && !hero.includes('fetch("/api/economy/rewards/daily"'))
ok("no feed layout-shifting daily notice remains", !feed.includes("rewardReadyNotice") && !feed.includes("daily-reward-ready-notice"))
ok("global daily prompt is fixed/out-of-flow", prompt.includes("className=\"fixed") && prompt.includes("bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"))
ok("daily prompt is compact", prompt.includes("max-w-[20rem]") && prompt.includes("h-14 w-14"))
ok("daily prompt uses canonical GHC coin asset", prompt.includes("GhcCoinIcon"))
ok("daily prompt opens from global event", prompt.includes('ghc:open-daily-claim'))
ok("daily issuance authority is explicit", authority.includes("ghc_execute_daily_claim_v12") && authority.includes("POST /api/economy/rewards/daily"))
ok("daily redemption is distinct from issuance", authority.includes("POST /api/economy/rewards/claim"))
ok("system status exposes backend authority map", systemStatus.includes("backendAuthoritySnapshot") && systemStatus.includes("authorities:"))
ok("client cannot dictate daily amount", claimClient.includes("body: JSON.stringify({})"))
ok("server-only ledger remains authoritative", authority.includes("durable ghc_transactions ledger"))
ok("no generic client issuance path in claim UI", !prompt.includes("ghc_execute_earn") && !dailyExperience.includes("ghc_execute_earn") && !hero.includes("ghc_execute_earn"))

console.log(`\nPhase 39 backend convergence: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
