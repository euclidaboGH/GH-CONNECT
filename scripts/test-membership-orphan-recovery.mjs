#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}

const mig = join(root, "supabase/migrations/202610181300_membership_orphaned_purchase_recovery.sql")
ok(existsSync(mig), "orphan membership recovery migration present")
const sql = existsSync(mig) ? readFileSync(mig, "utf8") : ""
ok(sql.includes("ghc_membership_complete_orphaned_purchase"), "complete orphaned RPC")
ok(sql.includes("ghc_membership_list_orphan_purchase_candidates"), "list candidates RPC")
ok(sql.includes("NO_MATCHING_DEBIT"), "requires existing debit")
ok(sql.includes("AMOUNT_MISMATCH"), "amount guard")
ok(!/ghc_execute_spend\s*\(/i.test(sql), "complete path does not call ghc_execute_spend()")
ok(sql.includes("service_role"), "service_role grants")

const base = join(root, "supabase/migrations/202610180010_atomic_membership_purchase.sql")
const baseSql = existsSync(base) ? readFileSync(base, "utf8") : ""
ok(baseSql.includes("MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED"), "purchase refuses second grant on orphan debit")

const store = join(root, "lib/server/membership/entitlement-store.ts")
const ts = existsSync(store) ? readFileSync(store, "utf8") : ""
ok(ts.includes("completeOrphanedMembershipPurchase"), "server complete helper")
ok(ts.includes("listOrphanMembershipPurchaseCandidates"), "server list helper")

if (failed) {
  console.log(`\nMEMBERSHIP ORPHAN RECOVERY: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMEMBERSHIP ORPHAN RECOVERY: all checks passed")
