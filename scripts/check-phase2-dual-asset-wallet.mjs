#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const balance = read('features/wallet/wallet-balance.tsx')
const actions = read('features/wallet/wallet-actions.tsx')
const screen = read('features/wallet/wallet-screen.tsx')
const checks = [
  ['combined balance aria label', /Unified PI and GHC wallet balances/.test(balance)],
  ['selectable PI and GHC rows', /role="option"/.test(balance) && /onSelectRail/.test(balance)],
  ['PI withdrawable distinction', /withdrawable · fees and eligibility apply/.test(balance)],
  ['never summed copy', /PI and GHC are never added together/.test(balance)],
  ['actions accept assetRail', /assetRail\?: "ghc" \| "pi"/.test(actions) || /assetRail = "ghc"/.test(actions)],
  ['PI action label Withdraw', /isPi \? "Withdraw" : "Send"/.test(actions)],
  ['screen passes assetRail to actions', /assetRail=\{assetRail\}/.test(screen)],
  ['PI tools expanded when PI selected', /assetRail === "pi"/.test(screen) && /UnifiedEarningsDashboard/.test(screen)],
  ['PI tools collapsed when GHC selected', /PI earnings & cashback/.test(screen)],
  ['advanced recovery accordion', /Advanced · payment recovery/.test(screen)],
  ['phase 2 doc present', existsSync(join(root, 'docs/PHASE2_DUAL_ASSET_WALLET.md'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 2 dual-asset wallet: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
