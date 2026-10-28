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
  ["daily claim remains a floating action instead of auto-opening over the header", !/autoPromptedKeyRef/.test(prompt) && !/ghc:daily-claim-prompted/.test(prompt) && /const showFab = Boolean\(userId\) && !claimedToday && !open && !done && !isLocked/.test(prompt)],
  ["daily claim uses official round GHC coin art with lightning accents", /<GhcCoinIcon size=\{34\}/.test(prompt) && /gh-daily-lightning-fab-bolt-1/.test(prompt) && /gh-daily-lightning-fab-bolt-2/.test(prompt)],
  ["claim opens a compact non-modal popover without full-screen backdrop", /gh-daily-claim-popover pointer-events-auto fixed/.test(prompt) && /aria-modal="false"/.test(prompt) && !/bg-black\/50/.test(prompt) && /pointerdown/.test(prompt)],
  ["daily claim copy explains check-in, server verification and 48-hour hold", /Check in every day/.test(prompt) && /48-hour maturity schedule/.test(prompt) && !/Tap below to verify/.test(prompt)],
  ["coin lightning effects respect reduced-motion preference", /gh-daily-coin-aura/.test(readFileSync(join(root, "app/globals.css"), "utf8")) && /prefers-reduced-motion: reduce/.test(readFileSync(join(root, "app/globals.css"), "utf8"))],
  ["floating lightning action stays available while status is unknown", /loadingStatus/.test(prompt) && /fixed z-\[150\]/.test(prompt)],
  ["unknown status still gives an actionable server-verified claim path", /canAttemptClaim/.test(prompt) && /Claim daily GHC/.test(prompt)],
  ["failed claim retains retryable error state", /setError\(res\.error \|\|/.test(prompt) && /role="alert"/.test(prompt)],
  ["duplicate taps are guarded while claim is in flight", /if \(claiming \|\| !canAttemptClaim\) return/.test(prompt) && /setClaiming\(true\)/.test(prompt)],
  ["popover close control is disabled while a claim is in flight", /disabled=\{claiming\}/.test(prompt) && /aria-label="Close"/.test(prompt)],
  ["daily claim uses canonical server endpoint and no client amount", /fetch\("\/api\/economy\/rewards\/daily"/.test(client) && /body: JSON\.stringify\(\{\}\)/.test(client)],
  ["server rejects unauthenticated claim requests", /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /AUTH_REQUIRED/.test(route)],
  ["server rate-limits repeated daily claim attempts", /checkRateLimit\(`daily_claim:\$\{auth\.userId\}`/.test(route)],
  ["server requires atomic durable claim RPC and fails closed", /rpcExecuteDailyClaimV12/.test(route) && /GHC_DAILY_CLAIM_MIGRATION_REQUIRED/.test(route)],
  ["daily claim remains pending and is not optimistic spendable credit", /pending: true/.test(route) && /pending entitlements, not spendable wallet credits/.test(route) && /syncWalletAfterServerClaim/.test(prompt)],
  ["shared status coordinator refreshes on focus, online and claim events", /addEventListener\("focus"/.test(statusStore) && /addEventListener\("online"/.test(statusStore) && /ghc:daily-reward-claimed/.test(statusStore)],
  ["feed claim failure preserves retry and refreshes server status", /Claim failed — your reward is still available to retry/.test(feed) && /refreshServerStatus\(\)/.test(feed)],
  ["claim completion forces a fresh status read after an in-flight GET", /const active = entry\.inFlight/.test(statusStore) && /active\.finally\(\(\) => \{ void refreshEntry/.test(statusStore)],
  ["matured reward claim action clears stale claiming status on every outcome", /setStatusMsg\(null\)/.test(rewardsCentre) && /setClaimingId\(null\)/.test(rewardsCentre)],
  ["outside screen tap dismisses the notice", /document\.addEventListener\("pointerdown", onPointerDown\)/.test(prompt) && /sheetRef\.current\?\.contains/.test(prompt)],
  ["notice copy no longer asks user to tap below", !/Tap below to verify/.test(prompt) && /Check in every day to collect your GHC reward and keep your streak going/.test(prompt)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Daily reward UX contract: ${checks.length}/${checks.length} checks passed.`)
