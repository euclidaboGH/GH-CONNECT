#!/usr/bin/env node
import fs from 'node:fs'
const r = (p) => fs.readFileSync(p, 'utf8')
const e = (p) => fs.existsSync(p)
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n) } else { fail++; console.error('FAIL', n) } }

const ux = r('lib/ux/performance-ux-0.338.18.ts')
const mp = r('components/ghc/marketplace-screen.tsx')
const post = r('components/ghc/enhanced-post-card.tsx')
const logo = r('components/ghc/brand-logo.tsx')
const wallet = r('features/wallet/wallet-screen.tsx')
const sheet = r('components/ghc/pi-withdraw-sheet.tsx')
const pkg = JSON.parse(r('package.json'))

ok('search debounce constant', /SEARCH_DEBOUNCE_MS = 280/.test(ux))
ok('media idle prefetch budget', /MEDIA_IDLE_PREFETCH_MAX = 6/.test(ux))
ok('list virtualize threshold', /LIST_VIRTUALIZE_AFTER = 40/.test(ux))
ok('skeleton min display', /SKELETON_MIN_MS = 180/.test(ux))
ok('toast dwell constants', /TOAST_SUCCESS_MS/.test(ux) && /TOAST_ERROR_MS/.test(ux))
ok('pull refresh cooldown', /PULL_REFRESH_COOLDOWN_MS = 1_200/.test(ux))
ok('prefersReducedMotion helper', /prefersReducedMotion/.test(ux))
ok('clampPageSize helper', /clampPageSize/.test(ux))
ok('honest empty state factory', /emptyStateCopy/.test(ux) && /Cart is separate from Wallet/.test(ux))
ok('marketplace content-visibility', /content-visibility:auto/.test(mp))
ok('post card content-visibility', /contentVisibility/.test(post) || /content-visibility/.test(post))
ok('brand logo lazy loading', /loading="lazy"/.test(logo))
ok('wallet clears before hydrate', /setPiWithdrawAvailable\(null\)/.test(wallet) && /setPiWithdrawUser\(null\)/.test(wallet))
ok('sheet sticky max retained', /stickyMaxRef/.test(sheet))
ok('package 0.338.18', pkg.version === '0.338.18')

console.log(`\nPerformance UX 0.338.18: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
