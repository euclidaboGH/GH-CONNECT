#!/usr/bin/env node
/** Local, network-free release checks for suites that actually exist in this source tree. */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const steps = [
  ["check-dependency-lock-integrity.mjs", "Dependency lock integrity"],
  ["verify-pi-backend-lock.mjs", "Pi backend lock"],
  ["check-jsx-safety.mjs", "JSX safety"],
  ["scan-production-safety.mjs", "Production safety"],
  ["check-database-contract-source.mjs", "Database contract source"],
  ["check-migration-release-readiness.mjs", "Migration release readiness"],
  ["test-fee-referral-contract.mjs", "Fee and referral contract"],
  ["check-phase2-reward-contract.mjs", "Phase 2 reward/payment contract"],
  ["check-phase25-premium-ui.mjs", "Phase 25 premium UI contract"],
  ["check-community-idempotency-contract.mjs", "Community idempotency/security contract"],
  ["check-payment-retry-ux.mjs", "Payment retry UX contract"],
  ["check-notification-center-contract.mjs", "Notification center contract"],
  ["check-daily-reward-ux.mjs", "Daily reward UX contract"],
  ["check-wallet-utility-reliability.mjs", "Wallet and utility reliability contract"],
  ["check-deliberate-post-voting.mjs", "Deliberate post voting and reaction safety"],
  ["check-phase31-floating-header-settlement.mjs", "Floating claim, compact header, and matured settlement contract"],
  ["check-curation-intelligence-readiness.mjs", "Curation intelligence readiness diagnostics"],
  ["check-phase6-integration-reliability.mjs", "Phase 6 cross-feature integration reliability"],
  ["check-phase7-runtime-hardening.mjs", "Phase 7 runtime integration hardening"],
  ["check-phase8-wallet-history-foundation.mjs", "Phase 8 wallet history reliability foundation"],
  ["check-phase9-wallet-transaction-integration.mjs", "Phase 9 wallet transaction integration"],
  ["check-phase11-wallet-cross-feature-reconciliation.mjs", "Phase 11 wallet cross-feature reconciliation"],
  ["check-phase12-pi-transaction-details.mjs", "Phase 12 Pi transaction details and receipts"],
  ["check-phase13-unified-transaction-records.mjs", "Phase 13 unified transaction record exports"],
  ["check-phase14-reconciliation-efficiency.mjs", "Phase 14 reconciliation efficiency and diagnostics"],
  ["check-phase15-payment-recovery.mjs", "Phase 15 payment recovery and support workflows"],
  ["check-phase16-payment-timeline.mjs", "Phase 16 payment lifecycle observability"],
]

console.log("\n=== GreenHaven static verification (network/DB independent) ===\n")
let failed = 0
for (const [file, label] of steps) {
  const path = join(root, "scripts", file)
  process.stdout.write(`→ ${label} ... `)
  if (!existsSync(path)) {
    console.log("FAIL (required check missing)")
    failed++
    continue
  }
  const r = spawnSync(process.execPath, [path], { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 8 * 1024 * 1024 })
  if (r.status === 0) console.log("PASS")
  else {
    console.log("FAIL")
    if (r.stdout) process.stdout.write(r.stdout.slice(-5000) + "\n")
    if (r.stderr) process.stderr.write(r.stderr.slice(-5000) + "\n")
    failed++
  }
}
console.log(`\n=== Static verification ${failed ? "FAILED" : "PASSED"} (${steps.length - failed}/${steps.length}) ===\n`)
process.exit(failed ? 1 : 0)
