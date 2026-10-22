import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : ""
let passed = 0
let failed = 0
function check(ok, name) {
  if (ok) { passed++; console.log(`✓ ${name}`) }
  else { failed++; console.error(`✗ ${name}`) }
}

const migration = read("supabase/migrations/20261022010076_daily_claim_48h_lock.sql")
const walletMigration = read("supabase/migrations/20261022010065_ghc_wallet_snapshot_spendable.sql")
const balanceMigration = read("supabase/migrations/20261022010057_ghc_balance_lock_and_spendable.sql")
const claimRoute = read("app/api/economy/rewards/claim/route.ts")
const walletRoute = read("app/api/economy/wallet/[userId]/route.ts")
const db = read("lib/server/economy/db.ts")
const store = read("lib/server/economy/store.ts")
const pipeline = read("scripts/test-daily-claim-wallet-pipeline.mjs")

console.log("=== DAILY CLAIM REDEMPTION → WALLET INTEGRITY ===\n")

console.log("1. Atomic redemption contract")
check(/SELECT \* INTO v_pending[\s\S]*?FOR UPDATE/.test(migration), "redemption locks the pending row before state transition")
check(/SET status = 'expired'[\s\S]*?INSERT INTO public\.ghc_transactions/.test(migration), "pending entitlement expires and posted credit is inserted in one RPC transaction")
check(/v_pending\.created_at \+ interval '48 hours'/.test(migration), "eligibility derives from immutable original claim creation time")
check(/'NOT_YET_REDEEMABLE'[\s\S]*?'redeemableAt'/.test(migration), "early redemption returns explicit eligibility timestamp")
check(/status = 'expired' AND source_event = 'DAILY_CLAIM_V12'/.test(migration), "retry by original Daily Claim hold ID resolves after redemption")
check(/kind = 'earned' AND status = 'posted'[\s\S]*?reference_id = v_ref/.test(migration), "retry by claim reference resolves existing posted credit")
check(/REVOKE ALL ON FUNCTION public\.ghc_claim_pending\(text, text\) FROM PUBLIC/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.ghc_claim_pending\(text, text\) TO service_role/.test(migration), "redemption RPC is not publicly executable")

console.log("\n2. Wallet authority and spendable balance")
check(/status='posted' AND kind <> 'transfer_request'/.test(walletMigration), "ledger balance excludes pending entitlements")
check(/status='pending' AND amount > 0/.test(walletMigration), "pending amount is reported separately")
check(/v_available := public\.ghc_spendable_balance\(p_user_id\)/.test(walletMigration), "wallet available balance uses shared spendable-balance function")
check(/ghc_spendable_balance\(p_user_id\)/.test(balanceMigration), "spendable balance excludes reserved withdrawal amount")
check(/v_avail := public\.ghc_spendable_balance\(p_user_id\)/.test(balanceMigration), "spend authorization uses spendable balance")
check(/const full = await rpcWalletSnapshot\(userId\)/.test(walletRoute), "wallet endpoint prefers full durable snapshot")
check(/balance: snapshot\.balance/.test(walletRoute), "wallet response exposes authoritative available balance")
check(/rpcWalletSnapshot\(auth\.userId\)/.test(claimRoute), "successful DB redemption refreshes authoritative wallet snapshot")

console.log("\n3. API and client safety")
check(/NOT_YET_REDEEMABLE.*\? 409/.test(claimRoute), "early redemption is an HTTP 409 conflict")
check(/alreadyClaimed: result\.alreadyClaimed/.test(claimRoute), "redemption response preserves idempotent status")
check(/transactionId: result\.transactionId/.test(claimRoute), "redemption response exposes canonical posted transaction ID")
check(/amount: result\.amount/.test(claimRoute), "redemption response uses server-returned amount")
check(/rpcWalletSnapshot/.test(db) && /lifetimeEarned/.test(db), "wallet snapshot maps durable lifetime totals")
check(/availableBalance\(input\.userId\)/.test(store), "local development spend checks available balance")
check(/updateTransaction\(userId, transactionId, patch\)/.test(store), "memory store can expire the original entitlement")
check(/store\.appendPosted\(credit\)[\s\S]*?status: "expired"/.test(store), "memory redemption posts one credit and expires the pending entitlement")
check(/claimedFrom: pending\.id[\s\S]*?claimKind: "DAILY_CLAIM_V12"/.test(store), "memory redemption retains original claim identity for safe retries")
check(!/const clear: GhcLedgerRow/.test(store), "memory redemption does not append a negative clear row that offsets the credit")
check(/sync does not increment balance|sync does not increment/i.test(pipeline), "existing client pipeline test protects against optimistic balance fabrication")

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
console.log("Static redemption-wallet checks passed. Live PostgreSQL and multi-instance behavior still require Testnet execution.")
