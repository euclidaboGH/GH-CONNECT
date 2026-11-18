#!/usr/bin/env node
/**
 * Wallet & Rewards Phase 5 — integration / release gate (source contracts).
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? "PASS" : "FAIL"} ${n}`)
}

const pkg = JSON.parse(read("package.json"))
const rewards = read("components/ghc/rewards-centre-screen.tsx")
const settings = read("components/ghc/settings.tsx")
const wallet = read("features/wallet/wallet-screen.tsx")
const dash = read("components/ghc/unified-earnings-dashboard.tsx")
const roadmap = existsSync(join(root, "docs/roadmaps/WALLET-REWARDS-PHASE-5-RELEASE-GATE.md"))
  ? read("docs/roadmaps/WALLET-REWARDS-PHASE-5-RELEASE-GATE.md")
  : ""

test("phase 5 roadmap exists", roadmap.length > 0)
test("phases 1–4 called out in phase 5 roadmap", /Phase 1/.test(roadmap) && /Phase 4/.test(roadmap) && /Deep links/.test(roadmap))
test("rewards does not embed withdraw dashboard", !/UnifiedEarningsDashboard/.test(rewards) && !/PiPayoutAuthorizationCard/.test(rewards))
test("rewards deep-links wallet with pi tools focus", /open-settings-section/.test(rewards) && /focus:\s*"gh-pi-earnings-tools"/.test(rewards))
test("settings persists wallet focus for deep link", /ghc\.wallet\.focus/.test(settings) && /detail\?\.focus/.test(settings))
test("wallet consumes focus and selects PI rail", /ghc\.wallet\.focus/.test(wallet) && /setAssetRail\("pi"\)/.test(wallet) && /setHistoryRail\("pi"\)/.test(wallet))
test("wallet scrolls to gh-pi-earnings-tools", /gh-pi-earnings-tools/.test(wallet) && /scrollIntoView/.test(wallet))
test("settings retains authorization management card", /PiPayoutAuthorizationCard/.test(settings))
test("wallet mounts unified earnings dashboard", /UnifiedEarningsDashboard/.test(wallet))
test("withdraw path uses server quote and authorization APIs", /\/api\/economy\/earnings\/quote/.test(dash) && /\/api\/identity\/wallet-authorization/.test(dash))
test("phase 5 checker registered in verify:static", (pkg.scripts["verify:static"] || "").includes("check-wallet-phase5-release-gate.mjs"))

const childChecks = [
  "scripts/check-wallet-phase1-premium-home.mjs",
  "scripts/check-wallet-phase2-asset-history.mjs",
  "scripts/check-wallet-rewards-phase3-transparency.mjs",
  "scripts/check-wallet-phase4-withdrawal-journey.mjs",
]
for (const rel of childChecks) {
  test(`child contract present: ${rel}`, existsSync(join(root, rel)))
}

// Run child contracts for integration confidence (source-only)
for (const rel of childChecks) {
  const r = spawnSync(process.execPath, [join(root, rel)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  test(`child passes: ${rel}`, r.status === 0)
  if (r.status !== 0) {
    console.log((r.stdout || "").slice(-400))
    console.log((r.stderr || "").slice(-400))
  }
}

const failed = checks.filter((x) => !x).length
console.log(`\nWallet Phase 5 release gate: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
