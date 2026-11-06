import fs from 'node:fs'
import assert from 'node:assert/strict'

const screen = fs.readFileSync('features/wallet/wallet-screen.tsx', 'utf8')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const checks = [
  ['GHC search includes transaction IDs and correlation references', /const hay = `\$\{tx\.id\} \$\{tx\.referenceId \|\| ""\}/.test(screen)],
  ['transaction search remains limited to descriptive/reference fields', /\$\{tx\.reason\} \$\{tx\.sourceEvent\} \$\{tx\.kind\} \$\{tx\.status\}/.test(screen)],
  ['date range controls expose selected state', /aria-pressed=\{txDateRange === r\.id\}/.test(screen)],
  ['transaction type filters expose selected state', /aria-pressed=\{txFilter === f\.id\}/.test(screen)],
  ['date range labels are understandable on mobile', /label: "7 days"/.test(screen) && /label: "30 days"/.test(screen) && /label: "All time"/.test(screen)],
  ['search has an explicit accessible label', /aria-label="Search GHC transactions by description or reference"/.test(screen)],
  ['results count is announced politely', /aria-live="polite" aria-atomic="true"/.test(screen) && /transactions"\} shown/.test(screen)],
  ['clear filters resets query, transaction type and date range', /setQuery\(""\); setTxFilter\("all"\); setTxDateRange\("all"\)/.test(screen)],
  ['Pi payment history remains explicitly separate from GHC ledger', /Rails are never mixed/.test(screen) && /separate from GHC ledger transfers/.test(screen)],
  ['Phase 2 checker is registered in prebuild exactly once', (packageJson.scripts.prebuild.match(/check-wallet-phase2-asset-history\.mjs/g) || []).length === 1],
  ['Phase 2 checker is registered in static verification exactly once', (packageJson.scripts['verify:static'].match(/check-wallet-phase2-asset-history\.mjs/g) || []).length === 1],
]
let failed = 0
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  if (!passed) failed++
}
assert.equal(failed, 0, `${failed} wallet Phase 2 checks failed`)
console.log(`Wallet Phase 2 asset/history checks: ${checks.length}/${checks.length} passed`)
