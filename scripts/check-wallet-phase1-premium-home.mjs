import fs from 'node:fs'

const files = {
  header: 'features/wallet/wallet-header.tsx',
  balance: 'features/wallet/wallet-balance.tsx',
  actions: 'features/wallet/wallet-actions.tsx',
}
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing wallet Phase 1 file (${name}): ${file}`)
}
const header = fs.readFileSync(files.header, 'utf8')
const balance = fs.readFileSync(files.balance, 'utf8')
const actions = fs.readFileSync(files.actions, 'utf8')
const checks = [
  ['wallet header uses user-centred title', /Your wallet/.test(header)],
  ['wallet explains Pi and GHC ledger separation', /Pi and GHC balances stay separate/.test(header)],
  ['asset choices use a semantic group', /role="group" aria-label="Choose wallet asset"/.test(balance)],
  ['asset choices expose pressed state', /aria-pressed=\{piSelected\}/.test(balance) && /aria-pressed=\{!piSelected\}/.test(balance)],
  ['asset choices have visible keyboard focus', /focus-visible:ring-violet-600/.test(balance) && /focus-visible:ring-emerald-600/.test(balance)],
  ['whole balance card does not announce on every update', !/aria-label="Wallet overview:[^\n]*aria-live="polite"/.test(balance)],
  ['Pi and GHC remain separately labelled', /Pi earnings/.test(balance) && /GreenHaven Credits/.test(balance)],
  ['primary actions have visible keyboard focus', /focus-visible:ring-primary/.test(actions)],
  ['disabled actions expose disabled cursor and state', /disabled:cursor-not-allowed disabled:opacity-50/.test(actions)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`Wallet Phase 1 premium-home checks: ${checks.length - failed}/${checks.length} passed`)
