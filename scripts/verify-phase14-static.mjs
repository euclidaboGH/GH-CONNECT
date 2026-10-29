#!/usr/bin/env node
/** Local, network-free release checks for suites that actually exist in this source tree. */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const steps = [
  ["check-phase1-platform-foundation.mjs", "Phase 1 platform foundation and architecture baseline"],
  ["check-a2u-earnings-roadmap.mjs", "Pi A2U earnings and four-month cashback roadmap contract"],
  ["check-pi-cashback-ledger.mjs", "Pi cashback attribution and period-ledger contract"],
  ["check-pi-cashback-statement.mjs", "Authenticated Pi cashback statement and Rewards/Wallet integration"],
  ["check-pi-cashback-period-grace.mjs", "Pi cashback late-revenue reconciliation grace and close safety"],
  ["check-pi-cashback-a2u.mjs", "Testnet-only user cashback A2U payout and reconciliation"],
  ["check-marketplace-revenue-reconciliation.mjs", "Marketplace verified payment and revenue-journal recovery"],
  ["check-phase1-12-consolidation.mjs", "Phase 1–12 system-wide consolidation audit"],
  ["check-build-type-regressions.mjs", "Build type-regression guard"],
  ["check-phase1-12-engagement-reliability.mjs", "Notification, feed, daily-claim and vote reliability"],
  ["check-phase1-12-hardening-upgrade.mjs", "Phase 1–12 hardening regression audit"],
  ["check-phase1-12-systematic-upgrade.mjs", "Phase 1–12 systematic upgrade regression audit"],
  ["check-phase1-12-cross-system-hardening.mjs", "Phase 1–12 cross-system bounded request hardening"],
  ["check-phase1-12-request-boundary-expansion.mjs", "Phase 1–12 financial, identity and social request-boundary expansion"],
  ["check-phase1-12-request-boundary-followup.mjs", "Phase 1–12 connection, moderation, matching, tips and beneficiary request hardening"],
  ["check-phase1-12-audit-ux.mjs", "Phase 1–12 audit UX regression audit"],
  ["check-dependency-lock-integrity.mjs", "Dependency lock integrity"],
  ["verify-pi-backend-lock.mjs", "Pi backend lock"],
  ["check-jsx-safety.mjs", "JSX safety"],
  ["check-security-headers.mjs", "Deployment security headers"],
  ["check-api-csrf-contract.mjs", "API mutation origin/CSRF contract"],
  ["scan-production-safety.mjs", "Production safety"],
  ["check-database-contract-source.mjs", "Database contract source"],
  ["check-migration-release-readiness.mjs", "Migration release readiness"],
  ["test-fee-referral-contract.mjs", "Fee and referral contract"],
  ["check-phase2-canonical-identity.mjs", "Phase 2 canonical identity and account-switch integrity"],
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
  ["check-phase6-shell-navigation.mjs", "Phase 6 app shell, deep links, and recovery navigation"],
  ["check-phase7-runtime-hardening.mjs", "Phase 7 runtime integration hardening"],
  ["check-phase7-social-experience.mjs", "Phase 7 social feed, mute privacy, and bounded story creation"],
  ["check-phase8-wallet-history-foundation.mjs", "Phase 8 wallet history reliability foundation"],
  ["check-phase9-wallet-transaction-integration.mjs", "Phase 9 wallet transaction integration"],
  ["check-phase11-wallet-cross-feature-reconciliation.mjs", "Phase 11 wallet cross-feature reconciliation"],
  ["check-phase12-pi-transaction-details.mjs", "Phase 12 Pi transaction details and receipts"],
  ["check-phase13-unified-transaction-records.mjs", "Phase 13 unified transaction record exports"],
  ["check-phase14-reconciliation-efficiency.mjs", "Phase 14 reconciliation efficiency and diagnostics"],
  ["check-phase15-payment-recovery.mjs", "Phase 15 payment recovery and support workflows"],
  ["check-phase16-payment-timeline.mjs", "Phase 16 payment lifecycle observability"],
  ["check-phase3-profile-identity.mjs", "Phase 3 public profile identity hardening"],
  ["check-phase2-wallet-transfer-integrity.mjs", "Phase 2 financial transfer amount integrity"],
  ["check-phase3-database-recovery.mjs", "Phase 3 database recovery contracts"],
  ["check-phase3-restore-catalog-gate.mjs", "Phase 3 restore catalog gate"],
  ["check-phase4-recovery-release-gate.mjs", "Phase 4 recovery release gate"],
  ["check-phase5-design-system.mjs", "Phase 5 design system contracts"],
  ["check-phase10-marketplace-integrity.mjs", "Phase 10 marketplace order integrity"],
  ["check-phase12-final-release-readiness.mjs", "Phase 12 final integration and release readiness"],
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
