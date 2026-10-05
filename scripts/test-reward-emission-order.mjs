#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
const root = process.cwd()
const rew = fs.readFileSync(path.join(root, 'lib/server/economy/reward-engine.ts'), 'utf8')
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗', m) } }

const fnStart = rew.indexOf('export async function evaluateRewardAuthoritative')
const fnBody = rew.slice(fnStart, fnStart + 12000)
const leg = fnBody.indexOf('verifyActionLegitimacy')
const self = fnBody.indexOf('SELF_TARGET')
const emit = fnBody.indexOf('computeAndCommitActivityEmissionDurable')
const stage = fnBody.indexOf('rpcStagePending')
const daily = fnBody.indexOf('DAILY_CHECKIN')
const memSection = fnBody.includes('Memory path') ? fnBody.slice(fnBody.indexOf('Memory path')) : ''
const memHasRef = memSection.indexOf('hasReference')
const memEmit = memSection.indexOf('computeAndCommitActivityEmissionDurable')

ok(fnStart > 0, 'evaluateRewardAuthoritative present')
ok(leg > 0 && emit > 0 && leg < emit, 'legitimacy before emission grant')
ok(self > 0 && self < emit, 'self-target check before emission')
ok(daily > 0 && daily < leg, 'DAILY_CHECKIN rejected before legitimacy/emission')
ok(fnBody.includes('rpcActivityStageReward') || (stage > 0 && emit < stage), 'atomic stage or emission-then-stage on DB path')
ok(memHasRef >= 0 && memEmit >= 0 && memHasRef < memEmit, 'memory path: hasReference before emission')
ok(fnBody.includes('clientSuggestedAmount') || rew.includes('ignore clientSuggestedAmount'), 'client amount non-authoritative')
ok(fnBody.includes('USE_DAILY_CLAIM_ENDPOINT') || fnBody.includes('ROUTE_TO_DAILY_CLAIM'), 'DAILY_CHECKIN routed away')
ok(fnBody.includes('ANTI_ABUSE'), 'anti-abuse rejection preserved')
ok(fnBody.includes('DAILY_CAP') && fnBody.includes('COOLDOWN') && fnBody.includes('TARGET_CAP'), 'caps/cooldown errors preserved')
ok(fnBody.includes('MEMORY_BLOCKED') || fnBody.includes('allowMemoryServer'), 'production memory guard present')
ok(fnBody.includes('rpcActivityStageReward') || stage > emit, 'no stage before emission on sequential path')

// P1.4B not touched
const wd = fs.readFileSync(path.join(root, 'lib/server/economy/withdrawal.ts'), 'utf8')
ok(wd.includes('ghc_withdrawal_settle'), 'P1.4B settle path intact')
ok(!wd.includes('executeDurableGhcSpend'), 'P1.4B not using ordinary spend for settle')

const mig10 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261010_ghc_withdrawal_settle_atomic.sql'),
  'utf8'
)
ok(mig10.includes('ghc_withdrawal_settle'), 'P1.4B migration intact')

console.log(`\nReward emission order: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL REWARD EMISSION ORDER CHECKS PASSED')
