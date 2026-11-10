#!/usr/bin/env node
/** Pi withdraw consent, identity map, reservation honesty, cart/wallet separation. */
import fs from 'node:fs'
const r = (p) => fs.readFileSync(p, 'utf8')
const e = (p) => fs.existsSync(p)
let pass = 0, fail = 0
const check = (n, ok) => { if (ok) { pass++; console.log('PASS', n) } else { fail++; console.error('FAIL', n) } }

const sheet = r('components/ghc/pi-withdraw-sheet.tsx')
const wallet = r('features/wallet/wallet-screen.tsx')
const consent = r('lib/client/pi-wallet-consent.ts')
const sep = r('lib/commerce/cart-wallet-separation.ts')
const res = r('lib/wallet/withdrawal-reservation-policy.ts')

check('sticky max does not regress on null parent', /stickyMaxRef/.test(sheet))
check('loadAuth bounded with timeout', /AUTH_STATUS_TIMEOUT|10_000/.test(sheet))
check('identity panel present', /Identity for this withdrawal/.test(sheet))
check('fee preview does not claim reservation', /does not reserve funds|fee estimate only|Review is a fee estimate/i.test(sheet))
check('AuthSnap carries piAppUid', /piAppUid\?:/.test(sheet) || /piAppUid:/.test(sheet))
check('wallet clears stale snapshot then sheet sticky-max protects UX', /setPiWithdrawAvailable\(null\)/.test(wallet) && /stickyMaxRef/.test(sheet))
check('consent client exposes authorizedPiAppUid', /authorizedPiAppUid/.test(consent))
check('PI_AUTH_UNAVAILABLE requires Pi Browser', /Pi Browser/.test(consent))
check('cart/wallet separation module', e('lib/commerce/cart-wallet-separation.ts') && /SURFACE_WALLET/.test(sep) && /SURFACE_CART/.test(sep))
check('cart badge isolated from wallet attention', /isolateCartBadge/.test(sep) && /isolateWalletAttention/.test(sep))
check('reservation only on accepted payout request', /RESERVE_ON_ACCEPTED_PAYOUT_REQUEST = true/.test(res) && /RESERVE_ON_QUOTE = false/.test(res))
check('consent does not reserve', /RESERVE_ON_CONSENT = false/.test(res))

console.log(`\nPi withdraw/consent/identity/separation: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
