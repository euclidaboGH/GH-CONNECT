#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
const root = process.cwd()
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗', m) } }

const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261010_ghc_withdrawal_settle_atomic.sql'),
  'utf8'
)
const prev = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261009_ghc_balance_lock_and_spendable.sql'),
  'utf8'
)
const wd = fs.readFileSync(path.join(root, 'lib/server/economy/withdrawal.ts'), 'utf8')

ok(mig.includes('CREATE OR REPLACE FUNCTION public.ghc_withdrawal_settle'), 'settle RPC defined')
ok(mig.includes("ghc_balance:'"), 'settle uses ghc_balance lock')
ok(mig.includes('pg_advisory_xact_lock'), 'transaction-scoped advisory lock')
ok(mig.includes('id <> v_row.id') || mig.includes("id <> v_row.id"), 'excludes only this withdrawal from locks')
ok(mig.includes("withdrawal_settle:'") || mig.includes('withdrawal_settle:'), 'settle reference convention')
ok(mig.includes("status = 'completed'"), 'completes in same function')
ok(mig.includes('SECURITY DEFINER'), 'SECURITY DEFINER')
ok(mig.includes('REVOKE ALL') && mig.includes('service_role'), 'PUBLIC revoke + service_role grant')
ok(mig.includes('idempotent'), 'idempotent paths present')
ok(!mig.includes('CREATE OR REPLACE FUNCTION public.ghc_execute_spend'), 'does not rewrite ghc_execute_spend')
ok(prev.includes('ghc_spendable_balance'), 'ordinary spendable still in prior migration')
ok(wd.includes('ghc_withdrawal_settle'), 'app calls settle RPC')
ok(!wd.includes('executeDurableGhcSpend'), 'app no longer settles via ordinary spend')
ok(wd.includes('SETTLEMENT_REF_REQUIRED'), 'settlement ref required')
ok(wd.indexOf('ghc_withdrawal_settle') > wd.indexOf('status !== "completed"') || wd.includes('input.status !== "completed"'), 'non-complete path preserved')

console.log(`\nWithdrawal settle static: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL WITHDRAWAL SETTLE STATIC CHECKS PASSED')
