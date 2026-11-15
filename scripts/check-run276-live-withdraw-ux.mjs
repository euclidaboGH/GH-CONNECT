#!/usr/bin/env node
/** Run 276: live withdraw UX — scopes, max honesty, quality label, PIN copy. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(fileURLToPath(new URL('..', import.meta.url)))
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n) } else { fail++; console.error('FAIL', n) } }
const pkg = JSON.parse(r('package.json'))
const consent = r('lib/client/pi-wallet-consent.ts')
const sheet = r('components/ghc/pi-withdraw-sheet.tsx')
const wallet = r('features/wallet/wallet-screen.tsx')
const bar = r('components/ghc/post-action-bar.tsx')
const pin = r('components/ghc/pin-recovery-panel.tsx')
const guards = r('lib/curation/client-curation-guards.ts')

ok('01 current package retains Run 276 wallet UX baseline', pkg.version.localeCompare('0.338.40', undefined, { numeric: true }) >= 0)
ok('02 wallet consent requests only the least-privilege wallet_address scope', /piAuthenticateOfficial\(\[\"wallet_address\"\]\)/.test(consent) && (consent.match(/piAuthenticateOfficial\(/g) || []).length === 1)
ok('03 failed narrow-scope consent does not retry with broader permissions', (consent.match(/piAuthenticateOfficial\(/g) || []).length === 1 && !/Progressive scopes|\[\"username\", \"payments\", \"wallet_address\"\]/.test(consent))
ok('04 developer portal guidance in consent errors', /Developer Portal|KYC-approved/.test(consent) || /Developer Portal|KYC-approved/.test(sheet))
ok('05 reserve copy honesty', /reserved only after you confirm/.test(sheet))
ok('06 each new withdrawal sheet session clears stale account snapshot before opening', /const openPiWithdraw = useCallback/.test(wallet) && wallet.indexOf('setPiWithdrawAvailable(null)') < wallet.indexOf('setPiWithdrawOpen(true)') && wallet.indexOf('setPiWithdrawUser(null)') < wallet.indexOf('setPiWithdrawOpen(true)'))
ok('07 atomic withdrawable parse', /withdrawableAtomic/.test(wallet) && /10_000_000/.test(wallet))
ok('08 post action Quality not Weight', /Quality/.test(bar) && !/Weight <span/.test(bar))
ok('09 curation quality label helper', /curationQualityLabel/.test(guards))
ok('10 PIN recovery professional copy', /Secure PIN recovery|Reset withdrawal PIN/.test(pin))
ok('11 withdrawal auth checklist still imported', /buildWithdrawalAuthorizationChecklist/.test(sheet))
ok('12 RESERVE_ON_QUOTE false policy', /RESERVE_ON_QUOTE = false/.test(r('lib/wallet/withdrawal-reservation-policy.ts')))

console.log(`\nRun 276 live withdraw UX: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
