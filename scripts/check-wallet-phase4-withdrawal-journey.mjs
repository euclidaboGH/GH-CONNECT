#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"

const rewards = fs.readFileSync("components/ghc/rewards-centre-screen.tsx", "utf8")
const dash = fs.readFileSync("components/ghc/unified-earnings-dashboard.tsx", "utf8")
const settings = fs.readFileSync("components/ghc/settings.tsx", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const roadmap = fs.readFileSync("docs/roadmaps/WALLET-REWARDS-PHASE-4-WITHDRAWAL-JOURNEY.md", "utf8")

const checks = [
  ["rewards does not mount PiPayoutAuthorizationCard", !/PiPayoutAuthorizationCard/.test(rewards)],
  ["rewards does not mount UnifiedEarningsDashboard", !/UnifiedEarningsDashboard/.test(rewards)],
  ["rewards links to Wallet for Pi withdraw", /Open Wallet · Withdraw Pi/.test(rewards)],
  ["settings retains authorization card for revoke/manage", /PiPayoutAuthorizationCard/.test(settings)],
  ["wallet dashboard posts wallet-authorization", /\/api\/identity\/wallet-authorization/.test(dash)],
  ["authorize returns boolean for journey chaining", /const onAuthorizeWallet = (?:useCallback\()?async \(\): Promise<boolean>/.test(dash)],
  ["runWithdraw authorizes then continues when granted", /const granted = await onAuthorizeWallet\(\)/.test(dash)],
  ["primary control is a single Withdraw CTA that opens the sheet", /data-testid="wallet-withdraw-cta"/.test(dash) && /ghc:open-pi-withdraw/.test(dash)],
  ["fee quote still server-side", /\/api\/economy\/earnings\/quote/.test(dash)],
  ["roadmap documents phase 4 boundaries", /Single primary control/.test(roadmap) && /Does not weaken/.test(roadmap)],
  ["phase 4 checker registered in verify:static", (pkg.scripts["verify:static"] || "").includes("check-wallet-phase4-withdrawal-journey.mjs")],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
assert.equal(failed, 0, `${failed} phase 4 checks failed`)
console.log(`Wallet Phase 4 withdrawal journey: ${checks.length}/${checks.length} passed`)
