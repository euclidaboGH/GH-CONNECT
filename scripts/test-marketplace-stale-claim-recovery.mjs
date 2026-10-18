#!/usr/bin/env node
/**
 * Source gate: stale payment-claim recovery SQL + server helpers exist.
 * Does not execute against PostgreSQL.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let failed = 0
function ok(cond, msg) {
  if (cond) console.log(`PASS ${msg}`)
  else {
    console.log(`FAIL ${msg}`)
    failed++
  }
}

const mig = join(root, "supabase/migrations/202610181200_marketplace_stale_payment_claim_recovery.sql")
ok(existsSync(mig), "stale claim recovery migration present")
const sql = existsSync(mig) ? readFileSync(mig, "utf8") : ""
ok(sql.includes("gh_marketplace_list_stale_payment_claims"), "list stale claims RPC")
ok(sql.includes("gh_marketplace_force_release_stale_payment_claim"), "force release RPC")
ok(sql.includes("CLAIM_TOO_RECENT"), "min-age guard")
ok(sql.includes("ORDER_ALREADY_SETTLED"), "settled-order guard")
ok(sql.includes("GRANT EXECUTE") && sql.includes("service_role"), "service_role only grant")
ok(!sql.toLowerCase().includes("insert into public.ghc_transactions"), "no ledger mint in recovery SQL")

const store = join(root, "lib/server/marketplace/order-store.ts")
const ts = existsSync(store) ? readFileSync(store, "utf8") : ""
ok(ts.includes("listStalePaymentClaims"), "listStalePaymentClaims helper")
ok(ts.includes("forceReleaseStalePaymentClaim"), "forceReleaseStalePaymentClaim helper")
ok(ts.includes("gh_marketplace_force_release_stale_payment_claim"), "RPC name wired")

// release_expired still skips active claims
const base = join(root, "supabase/migrations/202610180011_atomic_marketplace_inventory_reservation.sql")
const baseSql = existsSync(base) ? readFileSync(base, "utf8") : ""
ok(baseSql.includes("payment_claimed_at IS NULL"), "expiry worker skips active claims")

if (failed) {
  console.log(`\nSTALE CLAIM RECOVERY: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nSTALE CLAIM RECOVERY: all checks passed")
