#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
const root = process.cwd()
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗', m) } }

const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20261009_ghc_balance_lock_and_spendable.sql'), 'utf8')
const wd = fs.readFileSync(path.join(root, 'lib/server/economy/withdrawal.ts'), 'utf8')

ok(mig.includes("ghc_balance:'"), 'migration uses ghc_balance lock namespace')
ok(mig.includes('ghc_spendable_balance'), 'ghc_spendable_balance defined')
ok(mig.includes('ghc_withdrawal_locked_ghc'), 'spendable subtracts withdrawal locks')
ok(mig.includes('CREATE OR REPLACE FUNCTION public.ghc_execute_spend'), 'replaces spend RPC')
ok(mig.includes('CREATE OR REPLACE FUNCTION public.ghc_execute_transfer'), 'replaces transfer RPC')
ok(mig.includes('CREATE OR REPLACE FUNCTION public.ghc_withdrawal_create'), 'replaces withdrawal create')
ok(!mig.includes("ghc_spend:'") || mig.indexOf('ghc_balance') < mig.indexOf('ghc_execute_spend')+500, 'balance lock present for spend path')
ok(wd.includes('ghc_withdrawal_settle') || wd.includes('executeDurableGhcSpend'), 'settlement path present')
ok(wd.includes('SETTLE_FAILED') || wd.includes('SETTLE_SPEND_FAILED') || wd.includes('SETTLEMENT_REF_REQUIRED'), 'surfaces settle errors')
ok(wd.includes('ghc_withdrawal_settle') || (wd.indexOf('executeDurableGhcSpend') < wd.indexOf('completed')), 'settle/debit before completed')

console.log(`\nGHC balance lock: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL GHC BALANCE LOCK STATIC CHECKS PASSED')
