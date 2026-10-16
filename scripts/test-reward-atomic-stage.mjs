#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
const root = process.cwd()
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗', m) } }

const rew = fs.readFileSync(path.join(root, 'lib/server/economy/reward-engine.ts'), 'utf8')
const db = fs.readFileSync(path.join(root, 'lib/server/economy/db.ts'), 'utf8')
const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261012_ghc_activity_stage_lock_align.sql'),
  'utf8'
)

const fnStart = rew.indexOf('export async function evaluateRewardAuthoritative')
const fn = rew.slice(fnStart)
const dbPath = fn.slice(0, fn.indexOf('Memory path'))

ok(fnStart > 0, 'evaluateRewardAuthoritative present')
ok(dbPath.includes('rpcActivityStageReward'), 'DB path uses atomic stage RPC')
ok(!dbPath.includes('rpcStagePending'), 'DB path does not sequential stage_pending')
ok(!dbPath.includes('computeAndCommitActivityEmissionDurable'), 'DB path does not pre-commit emission alone')
ok(fn.indexOf('verifyActionLegitimacy') < fn.indexOf('rpcActivityStageReward'), 'legitimacy before atomic stage')

ok(db.includes('export async function rpcActivityStageReward'), 'rpcActivityStageReward client exists')
ok(db.includes('ghc_activity_stage_reward'), 'calls correct RPC name')

ok(mig.includes('CREATE OR REPLACE FUNCTION public.ghc_activity_stage_reward'), 'migration defines RPC')
ok(mig.includes('ghc_activity_emission_windows'), 'updates emission windows')
ok(mig.includes("kind = 'pending'"), 'inserts pending')
ok(mig.includes('emissionConsumed'), 'reports emissionConsumed')
ok(mig.includes('COOLDOWN') && mig.includes('DAILY_CAP') && mig.includes('TARGET_CAP'), 'limit errors before grant')
ok(mig.includes('ACTIVITY_CAP_REACHED'), 'activity cap handled')
ok(mig.includes('SECURITY DEFINER') && mig.includes('service_role'), 'security posture')
ok(mig.includes('idempotent'), 'idempotent paths')
ok(mig.includes("pg_advisory_xact_lock(hashtext('ghc_stage:'"), 'stage lock')
ok(mig.includes("pg_advisory_xact_lock(hashtext('ghc_act:'") || mig.includes("pg_advisory_xact_lock(hashtext('ghc_activity:'"), 'activity lock (ghc_act or ghc_activity)')

const cooldownIdx = mig.indexOf("'COOLDOWN'")
const insertWin = mig.indexOf('INSERT INTO public.ghc_activity_emission_windows')
ok(cooldownIdx > 0 && insertWin > cooldownIdx, 'cooldown check before emission insert')
const dailyIdx = mig.indexOf("'DAILY_CAP'")
ok(dailyIdx > 0 && dailyIdx < insertWin, 'daily cap before emission insert')

const wd = fs.readFileSync(path.join(root, 'lib/server/economy/withdrawal.ts'), 'utf8')
ok(wd.includes('ghc_withdrawal_settle') && !wd.includes('executeDurableGhcSpend'), 'P1.4B intact')

console.log(`\nAtomic reward stage: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL ATOMIC REWARD STAGE CHECKS PASSED')
