#!/usr/bin/env node
/** Regression contract for server-authoritative daily GHC claim UX and recovery. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const prompt = readFileSync(join(root, "components/ghc/daily-claim-prompt.tsx"), "utf8")
const statusStore = readFileSync(join(root, "lib/rewards/daily-claim-status-store.ts"), "utf8")
const client = readFileSync(join(root, "lib/rewards/claim-daily-client.ts"), "utf8")
const route = readFileSync(join(root, "app/api/economy/rewards/daily/route.ts"), "utf8")
const feed = readFileSync(join(root, "components/ghc/daily-reward-experience.tsx"), "utf8")
const rewardsCentre = readFileSync(join(root, "components/ghc/rewards-centre-screen.tsx"), "utf8")
const checks = [
  ["claimable server status automatically opens the daily popup", /setOpen\(true\)/.test(prompt) && /status\?\.claimable/.test(prompt) && /autoPromptedKeyRef/.test(prompt)],
  ["auto-popup is throttled per user/day within the tab session", /ghc:daily-claim-prompted/.test(prompt) && /sessionStorage/.test(prompt)],
  ["lightning action remains available while status is unknown", /status === null \|\| status\.claimable/.test(prompt) && /const showFab = canAttemptClaim/.test(prompt)],
  ["unknown status still gives an actionable server-verified claim path", /Check & Claim Daily GHC/.test(prompt) && /disabled=\{claiming \|\| !canAttemptClaim\}/.test(prompt)],
  ["failed claim retains retryable error state", /setError\(res\.error \|\|/.test(prompt) && /role="alert"/.test(prompt)],
  ["duplicate taps are guarded while claim is in flight", /if \(claiming \|\| !canAttemptClaim\) return/.test(prompt) && /setClaiming\(true\)/.test(prompt)],
  ["dialog cannot be closed while a claim is in flight", /disabled=\{claiming\} className="rounded-full p-2 hover:bg-muted/.test(prompt)],
  ["daily claim uses canonical server endpoint and no client amount", /fetch\("\/api\/economy\/rewards\/daily"/.test(client) && /body: JSON\.stringify\(\{\}\)/.test(client)],
  ["server rejects unauthenticated claim requests", /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /AUTH_REQUIRED/.test(route)],
  ["server rate-limits repeated daily claim attempts", /checkRateLimit\(`daily_claim:\$\{auth\.userId\}`/.test(route)],
  ["server requires atomic durable claim RPC and fails closed", /rpcExecuteDailyClaimV12/.test(route) && /GHC_DAILY_CLAIM_MIGRATION_REQUIRED/.test(route)],
  ["daily claim remains pending and is not optimistic spendable credit", /pending: true/.test(route) && /pending entitlements, not spendable wallet credits/.test(route) && /syncWalletAfterServerClaim/.test(prompt)],
  ["shared status coordinator refreshes on focus, online and claim events", /addEventListener\("focus"/.test(statusStore) && /addEventListener\("online"/.test(statusStore) && /ghc:daily-reward-claimed/.test(statusStore)],
  ["feed claim failure preserves retry and refreshes server status", /Claim failed — your reward is still available to retry/.test(feed) && /refreshServerStatus\(\)/.test(feed)],
  ["claim completion forces a fresh status read after an in-flight GET", /const active = entry\.inFlight/.test(statusStore) && /active\.finally\(\(\) => \{ void refreshEntry/.test(statusStore)],
  ["matured reward claim action clears stale claiming status on every outcome", /setStatusMsg\(null\)/.test(rewardsCentre) && /setClaimingId\(null\)/.test(rewardsCentre)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Daily reward UX contract: ${checks.length}/${checks.length} checks passed.`)
