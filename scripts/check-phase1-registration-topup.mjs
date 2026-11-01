#!/usr/bin/env node
/** Phase 1 registration top-up contract — source-level only. */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const checks = [
  ['migration exists', existsSync(join(root, 'supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['status RPC defined', /gh_earnings_registration_bonus_status/.test(read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['claim RPC defined', /gh_earnings_registration_bonus_claim/.test(read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['legacy top-up atomic 29500000', /29500000/.test(read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['full bonus atomic 30000000', /30000000/.test(read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['policy 3 PI constant', /REGISTRATION_BONUS_PI = 3/.test(read('lib/server/earnings/registration-bonus.ts'))],
  ['policy top-up 2.95 PI', /REGISTRATION_BONUS_TOPUP_PI = 2\.95/.test(read('lib/server/earnings/registration-bonus.ts'))],
  ['claim fails closed without enable+sandbox', /isRegistrationBonusEnabled/.test(read('lib/server/earnings/registration-bonus.ts'))],
  ['API route ignores client amount', /Body ignored/.test(read('app/api/economy/earnings/registration-bonus/route.ts'))],
  ['wallet keeps registration claim in Rewards only', !/RegistrationBonusCard/.test(read('features/wallet/wallet-screen.tsx')) && /registration bonus[\s\S]{0,120}Rewards/i.test(read('features/wallet/wallet-screen.tsx'))],
  ['legacy auto-reconcile on load', /legacyClaimed/.test(read('components/ghc/registration-bonus-card.tsx')) && /autoReconcileStarted/.test(read('components/ghc/registration-bonus-card.tsx'))],
  ['migration-pending UI when ledger unavailable', /20261030010001_registration_bonus_v2_reconciliation/.test(read('components/ghc/registration-bonus-card.tsx'))],
  ['Testnet backfill script present', existsSync(join(root, 'scripts/ops/phase2-registration-bonus-backfill-testnet.sql'))],
  ['Phase 1 operator doc present', existsSync(join(root, 'docs/PHASE1_REGISTRATION_TOPUP.md'))],
  ['claim RPC service_role only', /GRANT EXECUTE ON FUNCTION public\.gh_earnings_registration_bonus_claim\(text\) TO service_role/.test(read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 1 registration top-up: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
