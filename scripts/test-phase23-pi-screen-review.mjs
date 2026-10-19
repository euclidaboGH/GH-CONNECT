import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const runtime = read('lib/pi-runtime.ts')
const payment = read('lib/pi-u2a-payment.ts')
const layout = read('app/layout.tsx')
const css = read('app/globals.css')
const settings = read('components/ghc/settings.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const discover = read('components/ghc/discovery-grid-screen.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const messages = read('components/ghc/message-screen.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const onboarding = read('components/ghc/onboarding.tsx')
const compliance = read('PI_CORE_TEAM_COMPLIANCE_REVIEW_2026-10-19.md')
const matrix = read('PHASE_23_SCREEN_BY_SCREEN_REVIEW_2026-10-19.md')
const release = read('lib/app-release.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['official Pi SDK URL is loaded by the root layout', layout.includes('https://sdk.minepi.com/pi-sdk.js')],
  ['runtime fails closed when Pi.init is absent', runtime.includes('if (typeof Pi.init !== "function")') && runtime.includes('refusing to call other Pi SDK methods')],
  ['runtime does not inject duplicate SDK scripts during load races', runtime.includes('wait for the existing script rather than injecting a') && runtime.includes('if (existing)')],
  ['U2A payment waits for ensurePiInitialized before createPayment', payment.indexOf('await ensurePiInitialized()') >= 0 && payment.indexOf('await ensurePiInitialized()') < payment.indexOf('Pi.createPayment(')],
  ['U2A initialization errors fail closed', payment.includes('Pi SDK could not be initialized safely') && !payment.includes('/* already initialized or unavailable — createPayment path may still fail below */')],
  ['U2A amount is finite, positive and at most seven decimals', payment.includes('!Number.isFinite(amount) || amount <= 0') && payment.includes('Math.round(amount * 10_000_000)')],
  ['U2A memo is bounded', payment.includes('memo.length > 250')],
  ['caller metadata cannot override reserved app/engine/intent fields', payment.indexOf('...(options?.metadata || {})') < payment.indexOf('app: "gh-connect"') && payment.indexOf('engine: "gh_pay"') > payment.indexOf('...(options?.metadata || {})') && payment.includes('else delete metadata.intentId')],
  ['server-side Pi identity remains documented as source of truth', compliance.includes('server-side `/v2/me` verification')],
  ['A2U uses the Pi Core Team Node.js package and remains Testnet-only', compliance.includes('pi-backend') && compliance.includes('Testnet-only') && compliance.includes('PI_A2U_ENABLED')],
  ['Feed has semantic feed role and label', feed.includes('role="feed"') && feed.includes('aria-label={`${activeFilter} feed`}')],
  ['Discover has named screen landmark', discover.includes('aria-label="Discover people and communities"')],
  ['Profile has named screen landmark', profile.includes('aria-label="Your GreenHaven profile"')],
  ['Messages inbox and thread have distinct landmarks', messages.includes('aria-label="Conversation thread"') && messages.includes('aria-label="Messages inbox"')],
  ['Communities has named screen landmark', communities.includes('aria-label="GreenHaven communities"')],
  ['Marketplace has named screen landmark', marketplace.includes('aria-label="GreenHaven marketplace"')],
  ['Wallet has named screen landmark', wallet.includes('aria-label="GHC wallet"')],
  ['Settings has named screen landmark', settings.includes('aria-label="GreenHaven settings"')],
  ['Onboarding has named screen landmark', onboarding.includes('aria-label="GreenHaven account setup"')],
  ['settings version uses shared release version', settings.includes('APP_RELEASE_VERSION') && !settings.includes('Version 0.59.4')],
  ['screen-specific refinements include responsive breakpoints', css.includes('.gh-world-settings') && css.includes('.gh-world-onboarding') && css.includes('.gh-marketplace-shell .gh-marketplace-content') && css.includes('@media (min-width: 768px)') && css.includes('@media (min-width: 1024px)')],
  ['forced-colors support is present', css.includes('@media (forced-colors: active)')],
  ['Pi compliance and screen-by-screen manual matrices are included', compliance.includes('Release gates — do not skip') && matrix.includes('Manual device review still required')],
  ['release version and npm script are aligned without hard-coded phase versions', pkg.version === (release.match(/APP_RELEASE_VERSION\s*=\s*"([^"]+)"/) || [])[1] && pkg.scripts['test:phase23-pi-screen-review']],
]
let failures = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failures++ }
console.log(`\nPhase 23 Pi + screen review checks: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
