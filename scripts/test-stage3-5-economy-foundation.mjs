#!/usr/bin/env node
/**
 * Massive foundation gate: referral, issuance guard amendment, curation redistribute, fee policy.
 * Source-level only — does not settle live rewards.
 */
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

const m1 = "supabase/migrations/20261022010084_referral_programme.sql"
const m2 = "supabase/migrations/20261022010085_issuance_guard_referral_and_curation_redistribute.sql"
const m3 = "supabase/migrations/20261022010086_curation_redistribute_balance_funded.sql"
ok(existsSync(join(root, m1)), "referral programme migration")
ok(existsSync(join(root, m2)), "issuance guard amendment")
ok(existsSync(join(root, m3)), "curation redistribute migration")

const sql1 = readFileSync(join(root, m1), "utf8")
ok(sql1.includes("ghc_referral_ensure_code"), "ensure code RPC")
ok(sql1.includes("ghc_referral_attribute"), "attribute RPC")
ok(sql1.includes("SELF_REFERRAL"), "self-referral blocked")
ok(sql1.includes("ghc_referral_queue_reward"), "queue reward RPC")
ok(sql1.includes("0.05"), "5% rate in queue")
ok(sql1.includes("ghc_settle_referral_reward"), "settle RPC")
ok(sql1.includes("REFERRAL_REWARD_V1"), "referral source_event")
ok(sql1.includes("UNIQUE (referred_user_id)"), "one reward per referred user")

const sql2 = readFileSync(join(root, m2), "utf8")
ok(sql2.includes("REFERRAL_REWARD_V1"), "guard allows referral")
ok(sql2.includes("CURATION_REDISTRIBUTE_V1"), "guard allows curation redistribute")
ok(sql2.includes("GHC_ISSUANCE_BLOCKED"), "guard still blocks unknown mint")

const sql3 = readFileSync(join(root, m3), "utf8")
ok(sql3.includes("ghc_curation_redistribute"), "redistribute RPC")
ok(sql3.includes("INSUFFICIENT_SPENDABLE"), "spendable check")
ok(sql3.includes("transfer_out") && sql3.includes("transfer_in"), "debit+credit pair")
ok(!/kind,\s*'earned'/i.test(sql3), "curation path does not mint earned")

ok(existsSync(join(root, "lib/server/referral/referral-service.ts")), "referral service")
ok(existsSync(join(root, "lib/server/curation/redistribute.ts")), "curation redistribute helper")
ok(existsSync(join(root, "lib/server/fees/pilot-fee-policy.ts")), "pilot fee policy")
ok(existsSync(join(root, "app/api/referral/code/route.ts")), "referral code API")
ok(existsSync(join(root, "app/api/referral/attribute/route.ts")), "referral attribute API")

const refSvc = readFileSync(join(root, "lib/server/referral/referral-service.ts"), "utf8")
ok(refSvc.includes("GHC_REFERRAL_SETTLEMENT_ENABLED"), "settlement feature flag")
ok(refSvc.includes('=== "1"'), "settlement requires explicit 1")

const fee = readFileSync(join(root, "lib/server/fees/pilot-fee-policy.ts"), "utf8")
ok(fee.includes("quoteMarketplaceListingFee"), "listing fee quote")
ok(fee.includes("quoteCommunityCreateFee"), "community fee quote")
ok(fee.includes("ratesApproved: false"), "display-only when env unset")

const act = readFileSync(join(root, "app/api/membership/activate/route.ts"), "utf8")
ok(act.includes("queueReferralReward"), "membership activate queues referral")

const env = existsSync(join(root, ".env.example")) ? readFileSync(join(root, ".env.example"), "utf8") : ""
ok(env.includes("GHC_REFERRAL_SETTLEMENT_ENABLED=0"), "referral settlement default off")
ok(env.includes("GHC_CURATION_REDISTRIBUTE_ENABLED=0"), "curation redistribute default off")
ok(env.includes("NEXT_PUBLIC_MESSAGING_DURABLE=false") || env.includes("MESSAGING_DURABLE=false"), "messaging durable stays off by default")

if (failed) {
  console.log(`\nSTAGE 3-5 FOUNDATION: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nSTAGE 3-5 FOUNDATION: all checks passed")
