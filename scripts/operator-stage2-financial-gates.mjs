#!/usr/bin/env node
/**
 * Stage 2 — Database & financial integrity gates (source-level).
 * Does NOT apply migrations. Does NOT connect to production.
 *
 * Usage:
 *   node scripts/operator-stage2-financial-gates.mjs
 *   node scripts/operator-stage2-financial-gates.mjs --json
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const migDir = join(root, "supabase", "migrations")
const json = process.argv.includes("--json")

/** Critical files for Stage 2 financial integrity review (ordered for disposable PG). */
const CRITICAL = [
  {
    file: "20260821_ghc_economy_ledger.sql",
    symbols: ["ghc_transactions", "ghc_available_balance", "ghc_execute_transfer"],
    why: "Core ledger foundation (transactions + balance + transfer)",
  },
  {
    file: "202609030002_economy_v12_atomic_daily_claim.sql",
    symbols: ["ghc_execute_daily_claim_v12"],
    why: "Atomic Daily Claim path",
  },
  {
    file: "202609040001_ghc_ledger_spend_rpc.sql",
    symbols: ["ghc_execute_spend"],
    why: "Authoritative spend RPC",
  },
  {
    file: "202609040002_membership_entitlements_and_activity_caps.sql",
    symbols: ["ghc_membership"],
    why: "Membership entitlements table/RPCs",
  },
  {
    file: "20261009_ghc_balance_lock_and_spendable.sql",
    symbols: ["spendable", "ghc_balance"],
    why: "Spendable balance / locks",
  },
  {
    file: "202610180008_daily_claim_48h_lock.sql",
    symbols: ["48", "pending", "claim"],
    why: "48h pending lock on Daily Claim",
  },
  {
    file: "202610180009_ghc_daily_claim_only_issuance.sql",
    symbols: ["issuance", "daily"],
    why: "Issuance guard (Daily Claim only until referral path)",
  },
  {
    file: "202610180010_atomic_membership_purchase.sql",
    symbols: ["ghc_purchase_membership", "ghc_execute_spend"],
    why: "Atomic GHC membership purchase",
  },
  {
    file: "202610180011_atomic_marketplace_inventory_reservation.sql",
    symbols: [
      "gh_marketplace_release_expired_reservations",
      "payment_claimed_at",
      "reservation_expires_at",
    ],
    why: "Marketplace reservation + payment claim",
  },
  {
    file: "202609120002_marketplace_orders_durable.sql",
    symbols: ["gh_marketplace_orders", "order"],
    why: "Durable marketplace orders",
  },
  {
    file: "202610181200_marketplace_stale_payment_claim_recovery.sql",
    symbols: [
      "gh_marketplace_list_stale_payment_claims",
      "gh_marketplace_force_release_stale_payment_claim",
      "CLAIM_TOO_RECENT",
    ],
    why: "Ops recovery for stuck payment claims (no auto-pay)",
  },
  {
    file: "202610181300_membership_orphaned_purchase_recovery.sql",
    symbols: [
      "ghc_membership_complete_orphaned_purchase",
      "ghc_membership_list_orphan_purchase_candidates",
      "NO_MATCHING_DEBIT",
    ],
    why: "Ops complete entitlement after orphaned membership debit",
  },
  {
    file: "202610181400_transfer_pair_orphan_recovery.sql",
    symbols: [
      "ghc_list_orphan_transfer_outs",
      "ghc_complete_orphan_transfer_in",
      "NO_TRANSFER_OUT",
    ],
    why: "Ops complete missing transfer_in for existing transfer_out",
  },
  {
    file: "202610181500_referral_programme.sql",
    symbols: ["ghc_referral_ensure_code", "ghc_settle_referral_reward", "REFERRAL_REWARD_V1"],
    why: "Referral programme schema + settlement RPC",
  },
  {
    file: "202610181501_issuance_guard_referral_and_curation_redistribute.sql",
    symbols: ["REFERRAL_REWARD_V1", "CURATION_REDISTRIBUTE_V1", "GHC_ISSUANCE_BLOCKED"],
    why: "Issuance guard allows referral + curation redistribute only",
  },
  {
    file: "202610181502_curation_redistribute_balance_funded.sql",
    symbols: ["ghc_curation_redistribute", "INSUFFICIENT_SPENDABLE"],
    why: "Balance-funded curation redistribution",
  },
]

const presentFiles = existsSync(migDir)
  ? readdirSync(migDir).filter((f) => f.endsWith(".sql"))
  : []

const results = []
let failed = 0

for (const item of CRITICAL) {
  const path = join(migDir, item.file)
  const exists = existsSync(path)
  let content = ""
  const missingSymbols = []
  if (exists) {
    content = readFileSync(path, "utf8")
    for (const sym of item.symbols) {
      if (!content.toLowerCase().includes(sym.toLowerCase())) missingSymbols.push(sym)
    }
  }
  const ok = exists && missingSymbols.length === 0
  if (!ok) failed++
  results.push({
    file: item.file,
    why: item.why,
    exists,
    missingSymbols,
    ok,
  })
}

// Payment-claim recovery path must exist in app code (stuck claims)
const releaseSrc = join(root, "lib/server/marketplace/listing-store.ts")
let recoveryOk = false
let recoveryNote = "listing-store missing"
if (existsSync(releaseSrc)) {
  const t = readFileSync(releaseSrc, "utf8")
  recoveryOk = t.includes("gh_marketplace_release_expired_reservations")
  recoveryNote = recoveryOk
    ? "release_expired_reservations invoked from listing-store"
    : "release_expired not wired in listing-store"
}
if (!recoveryOk) failed++

const report = {
  stage: "2",
  title: "Database & financial integrity (source gates)",
  migrationFilesOnDisk: presentFiles.length,
  criticalChecked: CRITICAL.length,
  results,
  recoveryPath: { ok: recoveryOk, note: recoveryNote },
  liveApply: false,
  message:
    "PASS here only means source symbols exist. Disposable PostgreSQL + Testnet reconcile still required.",
}

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log("=== Stage 2 financial gates (source-only) ===\n")
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL"
    console.log(`${mark}  ${r.file}`)
    console.log(`      ${r.why}`)
    if (!r.exists) console.log("      missing file")
    if (r.missingSymbols.length) console.log(`      missing symbols: ${r.missingSymbols.join(", ")}`)
  }
  console.log(`\n${recoveryOk ? "PASS" : "FAIL"}  payment/reservation recovery wiring: ${recoveryNote}`)
  console.log(`\nMigrations on disk: ${presentFiles.length}`)
  console.log(`Critical checks: ${CRITICAL.length - failed + (recoveryOk ? 0 : 0)}/${CRITICAL.length + 1} logical groups`)
  if (failed) {
    console.log(`\nSTAGE 2 SOURCE GATES: ${failed} issue(s) — fix source before disposable PG`)
    process.exit(1)
  }
  console.log("\nSTAGE 2 SOURCE GATES: all critical files/symbols present")
  console.log("Next: disposable PostgreSQL apply + scripts/operator-sql-stage2-smoke.sql")
}
