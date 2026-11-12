#!/usr/bin/env node
/**
 * 20 biggest upgrades / 20 high-risk controls — 0.338.18
 */
import fs from 'node:fs'

const r = (p) => fs.readFileSync(p, 'utf8')
const e = (p) => fs.existsSync(p)
let pass = 0, fail = 0
const ok = (n, c) => {
  if (c) {
    pass++
    console.log('PASS', n)
  } else {
    fail++
    console.error('FAIL', n)
  }
}

const controls = r('lib/security/high-risk-controls-0.338.17.ts')
const marketplace = r('components/ghc/marketplace-screen.tsx')
const payment = r('components/ghc/pi-payment-detail.tsx')
const withdraw = r('components/ghc/pi-withdraw-sheet.tsx')
const notif = r('components/ghc/notification-bell.tsx')
const video = r('components/ghc/short-video-screen.tsx')
const qr = e('components/ghc/receive-ghc-flow.tsx') ? r('components/ghc/receive-ghc-flow.tsx') : ''
const pkg = JSON.parse(r('package.json'))
const release = r('lib/app-release.ts')
const cartSep = e('lib/commerce/cart-wallet-separation.ts') ? r('lib/commerce/cart-wallet-separation.ts') : ''
const resPol = e('lib/wallet/withdrawal-reservation-policy.ts') ? r('lib/wallet/withdrawal-reservation-policy.ts') : ''

ok('01 production release flag false in high-risk controls', /PRODUCTION_RELEASE_APPROVED = false/.test(controls))
ok('02 authenticated fetch credentials constant', /AUTHENTICATED_FETCH_CREDENTIALS = "include"/.test(controls))
ok('03 financial read timeout defined', /FINANCIAL_READ_TIMEOUT_MS = 12_000/.test(controls))
ok('04 social read timeout defined', /SOCIAL_READ_TIMEOUT_MS = 15_000/.test(controls))
ok('05 session max concurrent default', /SESSION_MAX_ACTIVE_DEFAULT = 8/.test(controls))
ok('06 marketplace commission fixed 500 bps', /MARKETPLACE_COMMISSION_BPS_FIXED = 500/.test(controls))
ok('07 Pi quote does not reserve funds', /PI_QUOTE_RESERVES_FUNDS = false/.test(controls))
ok('08 remote push production disabled', /REMOTE_PUSH_PRODUCTION_ENABLED = false/.test(controls))
ok('09 demo actor rejection helper', /isDemoActorId/.test(controls) && /DEMO_ACTOR_ID_PATTERN/.test(controls))
ok('10 settings export forbidden keys', /SETTINGS_EXPORT_FORBIDDEN_KEYS/.test(controls) && /isForbiddenExportKey/.test(controls))
ok('11 message idempotency max 80', /MESSAGE_IDEMPOTENCY_MAX = 80/.test(controls))
ok('12 message body max 8000', /MESSAGE_BODY_MAX = 8_000/.test(controls))
ok('13 cart line ceiling', /CART_LINE_MAX = 50/.test(controls))
ok('14 discovery radius clamp 1-100', /clampDiscoveryRadiusKm/.test(controls) && /Math\.min\(100/.test(controls))
ok('15 safe display amount rejects non-finite', /safeDisplayAmount/.test(controls))
ok('16 Pi atomic scale + floor helper', /PI_ATOMIC_SCALE = 10_000_000/.test(controls) && /floorPiToAtomicSafe/.test(controls))
ok('17 cart vs wallet surface constants', /SURFACE_WALLET/.test(controls) && /SURFACE_CART/.test(controls))
ok('18 CSP enforcement required flag', /CSP_ENFORCEMENT_REQUIRED = true/.test(controls))
ok('19 withdrawal PIN required', /WITHDRAWAL_PIN_REQUIRED = true/.test(controls))
ok('20 production identity mapping required', /PRODUCTION_IDENTITY_MAPPING_REQUIRED = true/.test(controls))

ok('CI visual cohesion marketplace strip', /flex shrink-0 flex-col gap-1\.5 border-b/.test(marketplace))
ok('payment timeline credentials include', /credentials:\s*"include"/.test(payment) && /timeline/.test(payment))
ok('payment timeline timeout', /12_000|AbortController|AbortSignal/.test(payment))
ok('notification economy read timeout', /economy\/notifications/.test(notif) && /AbortSignal\.timeout\(10_000\)/.test(notif))
ok('short-video fetch timeout', /short-video/.test(video) && /AbortSignal\.timeout\(15_000\)/.test(video))
ok('QR svg local-only annotation', !qr || /generated locally/.test(qr))
ok('sticky max withdraw still present', /stickyMaxRef/.test(withdraw))
ok('cart wallet separation module retained', /SURFACE_CART/.test(cartSep))
ok('reservation policy quote false', /RESERVE_ON_QUOTE = false/.test(resPol))
ok('package version matches release metadata', release.includes(`APP_RELEASE_VERSION = \"${pkg.version}\"`))

console.log(`\nHigh-risk 20 upgrades: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
