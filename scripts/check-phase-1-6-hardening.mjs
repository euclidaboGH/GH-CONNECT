#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

const hub = read('components/ghc/premium-community-hub.tsx')
const market = read('components/ghc/marketplace-screen.tsx')
const claim = read('components/ghc/daily-reward-experience.tsx')
const life = read('lib/marketplace/order-lifecycle.ts')

test('Mod decline uses onDeclineRequest or onRejectRequest', /onDeclineRequest \|\| onRejectRequest/.test(hub))
test('Inline order review form (no window.prompt)', /reviewDraftOrderId/.test(market) && /Submit review/.test(market) && !/window\.prompt\("Review/.test(market))
test('Order next-action hints', /orderNextActionHint/.test(life) && /nextHint/.test(market))
test('Human order status labels', /Awaiting payment/.test(life) && /Completed/.test(life))
test('Claim success flash state', /justClaimedFlash/.test(claim))
test('Lifecycle + trust modules still present', existsSync(join(root, 'lib/marketplace/order-lifecycle.ts')) && existsSync(join(root, 'lib/marketplace/trust.ts')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 1–6 hardening static: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)

const children = [
  'scripts/check-phase-a-daily-claim-ux.mjs',
  'scripts/check-phase-b-marketplace-commerce.mjs',
  'scripts/check-phase-c-marketplace-trust.mjs',
  'scripts/check-phase-d-communities-product.mjs',
  'scripts/check-phase-e-ecosystem-polish.mjs',
]
let cf = 0
for (const c of children) {
  const r = spawnSync(process.execPath, [c], { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) { cf++; console.error('CHILD FAIL', c) }
  else console.log('CHILD PASS', c)
}
console.log(`\nPhase 1–6 children: ${children.length - cf}/${children.length} passed`)
process.exit(cf ? 1 : 0)
