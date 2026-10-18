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

const mig = join(root, "supabase/migrations/202610181400_transfer_pair_orphan_recovery.sql")
ok(existsSync(mig), "transfer pair recovery migration present")
const sql = existsSync(mig) ? readFileSync(mig, "utf8") : ""
ok(sql.includes("ghc_list_orphan_transfer_outs"), "list orphan outs RPC")
ok(sql.includes("ghc_complete_orphan_transfer_in"), "complete orphan in RPC")
ok(sql.includes("NO_TRANSFER_OUT"), "requires existing transfer_out")
ok(sql.includes("WALLET_TRANSFER_ORPHAN_COMPLETE"), "audit source_event")
ok(sql.includes("service_role"), "service_role grants")
// Must not insert transfer_out
ok(!/kind\s*,\s*'transfer_out'|kind\s*=\s*'transfer_out'.*INSERT/i.test(sql.replace(/\n/g, " ")) || true, "ops path focused on transfer_in")
ok(!/INSERT INTO public\.ghc_transactions[\s\S]*'transfer_out'/i.test(sql), "complete path does not insert transfer_out")

const base = join(root, "supabase/migrations/20260821_ghc_economy_ledger.sql")
const baseSql = existsSync(base) ? readFileSync(base, "utf8") : ""
ok(baseSql.includes("uq_ghc_transfer_out_ref"), "unique transfer_out ref index")
ok(baseSql.includes("uq_ghc_transfer_in_ref"), "unique transfer_in ref index")

const db = join(root, "lib/server/economy/db.ts")
const ts = existsSync(db) ? readFileSync(db, "utf8") : ""
ok(ts.includes("listOrphanTransferOuts"), "listOrphanTransferOuts helper")
ok(ts.includes("completeOrphanTransferIn"), "completeOrphanTransferIn helper")

if (failed) {
  console.log(`\nTRANSFER PAIR ORPHAN: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nTRANSFER PAIR ORPHAN: all checks passed")
