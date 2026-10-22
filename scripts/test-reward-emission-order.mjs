#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
const root = process.cwd()
const rew = fs.readFileSync(path.join(root, 'lib/server/economy/reward-engine.ts'), 'utf8')
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗', m) } }

const fnStart = rew.indexOf('export async function evaluateRewardAuthoritative')
const fnBody = rew.slice(fnStart)

ok(fnStart > 0, 'evaluateRewardAuthoritative present')
ok(fnBody.includes('GHC_ISSUANCE_POLICY_LOCKED'), 'generic reward issuance is denied')
ok(fnBody.includes('DAILY_CLAIM_ONLY_ISSUANCE'), 'domain layer enforces Daily-Claim-only policy')
ok(!fnBody.includes('computeAndCommitActivityEmissionDurable'), 'disabled path cannot commit activity emission')
ok(!fnBody.includes('rpcActivityStageReward') && !fnBody.includes('rpcStagePending'), 'disabled path cannot stage generic rewards')
const rewardRoute = fs.readFileSync(path.join(root, 'app/api/economy/rewards/evaluate/route.ts'), 'utf8')
ok(rewardRoute.includes('GHC_ISSUANCE_POLICY_LOCKED'), 'API boundary denies generic issuance')
ok(!rewardRoute.includes('CLIENT_AMOUNT_FORBIDDEN') && !rewardRoute.includes('evaluateRewardAuthoritative'), 'no client input reaches a reward issuer')
const ledgerPolicy = fs.readFileSync(path.join(root, 'supabase/migrations/20261022010077_ghc_daily_claim_only_issuance.sql'), 'utf8')
ok(ledgerPolicy.includes('GHC_ISSUANCE_POLICY_VIOLATION'), 'database trigger blocks alternate positive credits')
ok(ledgerPolicy.includes("v_event = 'DAILY_CLAIM_V12'"), 'database allowlist preserves Daily Claim')
ok(ledgerPolicy.includes("v_event = 'WALLET_TRANSFER'"), 'database allowlist preserves transfers as redistribution')

// P1.4B not touched
const wd = fs.readFileSync(path.join(root, 'lib/server/economy/withdrawal.ts'), 'utf8')
ok(wd.includes('ghc_withdrawal_settle'), 'P1.4B settle path intact')
ok(!wd.includes('executeDurableGhcSpend'), 'P1.4B not using ordinary spend for settle')

const mig10 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261022010058_ghc_withdrawal_settle_atomic.sql'),
  'utf8'
)
ok(mig10.includes('ghc_withdrawal_settle'), 'P1.4B migration intact')

console.log(`\nReward emission order: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL REWARD EMISSION ORDER CHECKS PASSED')
