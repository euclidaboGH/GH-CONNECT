#!/usr/bin/env node
/** Phase 8 Rewards: server-authoritative claims and bounded, account-scoped snapshots. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL("..", import.meta.url)))
const centre = readFileSync(join(root, "components/ghc/rewards-centre-screen.tsx"), "utf8")
const daily = readFileSync(join(root, "components/ghc/daily-reward-experience.tsx"), "utf8")
const client = readFileSync(join(root, "lib/rewards/claim-daily-client.ts"), "utf8")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
const release = readFileSync(join(root, "lib/app-release.ts"), "utf8")
const roadmap = readFileSync(join(root, "docs/PRODUCT-ROADMAP.md"), "utf8")

const checks = [
  ["Rewards balance hydration is authenticated and cache-isolated", centre.includes('credentials: "include"') && centre.includes('cache: "no-store"')],
  ["Rewards snapshot fetch is abortable and bounded to eight seconds", centre.includes("new AbortController()") && centre.includes("window.setTimeout(() => controller.abort(), 8_000)") && centre.includes("signal: controller.signal")],
  ["Snapshot timeout is cleared on completion and cleanup", centre.includes(".finally(() => window.clearTimeout(timeout))") && centre.includes("window.clearTimeout(timeout)\n      controller.abort()")],
  ["Account changes clear prior user's financial snapshot", centre.includes("economyOwnerRef.current !== userId") && centre.includes("setServerEconomy({ balance: null, pending: null, locked: null, curationBalance: null, canFundCuration: null })")],
  ["Null, malformed, infinite and negative amounts are not displayed as confirmed balances", centre.includes("function readNonNegativeAmount(value: unknown)") && centre.includes("value >= 0") && centre.includes("readNonNegativeAmount(data.wallet?.balance)")],
  ["Economy snapshot requires explicit server success", centre.includes("data.ok !== true")],
  ["Optional response user identity is checked before display", centre.includes("data.userId !== userId")],
  ["UI exposes server snapshot freshness and unavailable state", centre.includes("Server snapshot confirmed") && centre.includes("Snapshot unavailable")],
  ["Daily claim amount is parsed only from a finite non-negative server value", client.includes("Number.isFinite(parsedAmount) && parsedAmount >= 0")],
  ["Missing or malformed server amount is never replaced with a client estimate", daily.includes("const amt = server.serverAmount") && !daily.includes("server.serverAmount ?? res.ghc ?? daily.todayGhc")],
  ["A failed daily claim never flashes a claimed-success state", !daily.includes("setJustClaimedFlash(true)") && !daily.includes("justClaimedFlash")],
  ["Rewards journey only displays a server-ready wallet balance", readFileSync(join(root, "components/ghc/rewards-journey-hero.tsx"), "utf8").includes('snapshot?.status !== "ready" || snapshot.source !== "server"') && readFileSync(join(root, "components/ghc/rewards-journey-hero.tsx"), "utf8").includes('walletBal == null ? "—" : formatGhc(walletBal)')],
  ["Daily claims remain server-authoritative and idempotent", client.includes('method: "POST"') && client.includes('"/api/economy/rewards/daily"') && client.includes("data.idempotent")],
  ["No client-side GHC minting or financial mutation was introduced", !/ledger\.insert|mintGhc|transferGhc|settleReward\s*\(/i.test(daily + centre + client)],
  ["Wallet and Pi financial authorities remain separate from Rewards UI", centre.includes("PiCashbackSummary") && centre.includes("Open Wallet") && !/\/api\/wallet\/(?:withdraw|transfer)|\/api\/pi\/(?:payout|withdraw)/i.test(centre)],
  ["Release metadata and lockfile are synchronized", Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["Phase 8 gate is registered exactly once in prebuild and static verification", (pkg.scripts.prebuild.match(/check-phase8-rewards-entry\.mjs/g) || []).length === 1 && (pkg.scripts["verify:static"].match(/check-phase8-rewards-entry\.mjs/g) || []).length === 1],
  ["Roadmap maps the existing Rewards source foundation to product Priority 3 and Membership to Priority 4", roadmap.includes("| 3 | **Rewards** |") && roadmap.includes("0.323.0") && roadmap.includes("| 4 | **Membership** |")],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`Phase 8 Rewards entry contract: ${checks.length}/${checks.length} checks passed.`)
