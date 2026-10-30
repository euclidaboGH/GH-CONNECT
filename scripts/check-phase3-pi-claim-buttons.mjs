#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const card = read('components/ghc/registration-bonus-card.tsx')
const route = read('app/api/economy/earnings/registration-bonus/route.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const checks = [
  ['wallet mounts full claim card', /<RegistrationBonusCard\s*\/>/.test(wallet)],
  ['rewards mounts compact claim card', /RegistrationBonusCard\s+compact/.test(rewards)],
  ['full-width claim CTA', /w-full/.test(card) && /Claim remaining|Claim \$\{amount\} π now|Claim \$\{amount\} π/.test(card)],
  ['legacy auto-reconcile', /autoReconcileStarted/.test(card) && /legacyClaimed/.test(card)],
  ['posts empty body server-derived', /body: JSON\.stringify\(\{\}\)/.test(card)],
  ['dispatches wallet-refresh', /ghc:wallet-refresh/.test(card)],
  ['dispatches earnings-refresh', /ghc:earnings-refresh/.test(card)],
  ['dispatches success toast', /ghc:toast/.test(card)],
  ['API ignores client amount', /Body ignored/.test(route)],
  ['API POST rate-limited', /reg-bonus-claim/.test(route)],
  ['migration-pending UI', /20261030010001_registration_bonus_v2_reconciliation/.test(card)],
  ['phase 3 doc present', existsSync(join(root, 'docs/PHASE3_PI_CLAIM_BUTTONS.md'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 3 PI claim buttons: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
