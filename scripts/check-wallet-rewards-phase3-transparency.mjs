import fs from 'node:fs'
import assert from 'node:assert/strict'

const screenPath = 'components/ghc/rewards-centre-screen.tsx'
const screen = fs.readFileSync(screenPath, 'utf8')
const checks = [
  ['rewards summary has an accessible heading', /aria-labelledby="rewards-balance-summary-title"/.test(screen) && /id="rewards-balance-summary-title"/.test(screen)],
  ['available balance is sourced from server economy snapshot', /serverEconomy\.balance == null \? "—" : formatGhc\(serverEconomy\.balance\)/.test(screen)],
  ['pending balance is sourced from server economy snapshot', /serverEconomy\.pending == null \? "—" : formatGhc\(serverEconomy\.pending\)/.test(screen)],
  ['locked balance is sourced from server economy snapshot', /serverEconomy\.locked == null \? "—" : formatGhc\(serverEconomy\.locked\)/.test(screen)],
  ['unknown balances are not presented as zero', /serverEconomy\.(balance|pending|locked) == null \? "—"/.test(screen)],
  ['pending and locked funds are explicitly described as not spendable', /Pending and locked rewards are not spendable/.test(screen)],
  ['history action opens existing history tab', /onClick=\{\(\) => setTab\("history"\)\}/.test(screen)],
  ['history action has visible keyboard focus', /focus-visible:ring-emerald-600/.test(screen)],
  ['summary separates claim-ready and under-review reward records without treating them as ledger credits', /Ready to claim/.test(screen) && /Under review \/ maturity/.test(screen) && /credited value is confirmed only by the server ledger/.test(screen)],
]
let failed = 0
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  if (!passed) failed++
}
assert.equal(failed, 0, `${failed} wallet rewards transparency checks failed`)
console.log(`Wallet Rewards Phase 3 checks: ${checks.length}/${checks.length} passed`)
