import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const css = read('app/globals.css')
const app = read('components/ghc/app.tsx')
const onboarding = read('components/ghc/onboarding.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const discover = read('components/ghc/discovery-grid-screen.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const messages = read('components/ghc/message-screen.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const settings = read('components/ghc/settings.tsx')
const e2e = read('e2e/responsive-screen-review.spec.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['mobile visual-QA includes 320/360/390 viewport widths', e2e.includes('[320, 360, 390, 768, 1024, 1440]')],
  ['tablet and desktop viewport sizes are in the screenshot matrix', e2e.includes('768') && e2e.includes('1024') && e2e.includes('1440')],
  ['actual browser screenshots are captured by the E2E suite', e2e.includes('page.screenshot(') && e2e.includes('testInfo.outputPath')],
  ['keyboard-open responsive states are captured and keep focused fields visible', e2e.includes('keyboard-open') && e2e.includes('toBeFocused()') && e2e.includes('bounds!.bottom')],
  ['offline, API-failure, and fresh-load recovery states are covered', e2e.includes('context.setOffline(true)') && e2e.includes('API failure state') && e2e.includes('fresh-load recovery')],
  ['delayed API responses capture the public loading shell without fake provider data', e2e.includes('delayed-api-loading-shell-390.png') && e2e.includes('delayedRequestSeen')],
  ['wallet and settings screenshots are included for authenticated profile sessions', e2e.includes('wallet-${width}.png') && e2e.includes('settings-${width}.png')],
  ['preview CI runs desktop and mobile browser projects', read('.github/workflows/ci.yml').includes('--project=chromium --project=mobile-chrome')],
  ['document and body horizontal overflow are asserted at runtime', e2e.includes('document.documentElement.scrollWidth') && e2e.includes('document.body.scrollWidth')],
  ['authenticated tests use only an explicitly supplied non-production QA session', e2e.includes('seedPreviewQaSession') && e2e.includes('GHC_E2E_COOKIE_A') && e2e.includes('resolved.isProdTarget') && e2e.includes('does not fake Pi identity or financial data')],
  ['Preview CI passes the optional QA cookie as a secret and uploads screenshot artifacts', read('.github/workflows/ci.yml').includes('GHC_E2E_COOKIE_A: ${{ secrets.GHC_E2E_COOKIE_A }}') && read('.github/workflows/ci.yml').includes('gh-connect-preview-visual-qa-${{ github.run_id }}')],
  ['Pi Browser mobile input zoom prevention uses 16px minimum font', css.includes('font-size: max(1rem, 16px)')],
  ['dynamic viewport and safe-area mobile support are present', css.includes('min-height: 100dvh') && css.includes('env(safe-area-inset-bottom, 0px)')],
  ['document overflow is clipped without disabling internal scrollers', css.includes('body { overflow-x: clip; }') && css.includes('overscroll-behavior: contain')],
  ['media and long content cannot widen the app shell', css.includes(':where(img, video, canvas, svg)') && css.includes('overflow-wrap: anywhere')],
  ['tablet uses bounded readable feed columns', css.includes('@media (min-width: 640px) and (max-width: 1023px)') && css.includes('.gh-feed-column')],
  ['desktop navigation is centered and bounded', css.includes('.gh-bottom-nav {') && css.includes('width: min(100%, 48rem) !important')],
  ['reduced motion behavior is respected', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('animation-duration: .01ms')],
  ['forced-colors keyboard focus remains visible', css.includes('@media (forced-colors: active)') && css.includes('outline: 2px solid Highlight')],
  ['feed, discover, profile, messages and communities have named landmarks', feed.includes('role="feed"') && discover.includes('aria-label="Discover people and communities"') && profile.includes('aria-label="Your GreenHaven profile"') && messages.includes('aria-label="Conversation thread"') && communities.includes('aria-label="GreenHaven communities"')],
  ['marketplace, wallet, onboarding and settings landmarks remain present', marketplace.includes('aria-label="GreenHaven marketplace"') && wallet.includes('aria-label="GHC wallet"') && onboarding.includes('aria-label="GreenHaven account setup"') && settings.includes('aria-label="GreenHaven settings"')],
  ['app navigation labels are exposed to assistive technology', app.includes('aria-label="Main navigation"') && app.includes('aria-label={isActive ? `${label}, current tab` : `Go to ${label}`}')],
  ['Phase 24 E2E suite is included in CI verification', pkg.scripts['ci:verify'].includes('npm run test:phase24-responsive-visual')],
  ['release metadata matches package.json without hard-coded phase versions', pkg.version === (release.match(/APP_RELEASE_VERSION\s*=\s*"([^"]+)"/) || [])[1] && pkg.scripts['test:phase24-responsive-visual']],
]
let failures = 0
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  if (!pass) failures++
}
console.log(`\nPhase 24 responsive visual-QA source checks: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
