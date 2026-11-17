import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const css = read('app/globals.css')
const checks = [
  ['30 numbered experience refinements', (css.match(/\/\* \d{2} ·/g) || []).length === 30],
  ['wallet scroll region hook', read('features/wallet/wallet-screen.tsx').includes('gh-wallet-scroll-region')],
  ['conversation row hook', read('components/ghc/message-components.tsx').includes('gh-conversation-row')],
  ['message bubble hook', read('components/ghc/message-components.tsx').includes('gh-message-bubble')],
  ['message composer hook', read('components/ghc/message-components.tsx').includes('gh-message-composer')],
  ['community responsive directory hook', read('components/ghc/communities-screen.tsx').includes('gh-community-directory-grid')],
  ['marketplace responsive listing hook', read('components/ghc/marketplace-screen.tsx').includes('gh-marketplace-listing-grid')],
  ['profile timeline content rail hook', read('components/ghc/profile-screen.tsx').includes('gh-profile-post-column')],
  ['rewards balance panel hook', read('components/ghc/rewards-centre-screen.tsx').includes('gh-rewards-balance-panel')],
  ['reduced motion remains respected', css.includes('@media (prefers-reduced-motion: reduce)')],
  ['safe-area composer remains enabled', read('components/ghc/message-components.tsx').includes('env(safe-area-inset-bottom)')],
  ['Pi payout execution remains disabled in env template', read('.env.example').includes('PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0')],
  ['Pi A2U remains testnet-only', read('.env.example').includes('PI_A2U_TESTNET_ONLY=true')],
  ['payout requests remain disabled in env template', read('.env.example').includes('PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0')],
  ['release version synchronized', JSON.parse(read('package.json')).version === JSON.parse(read('package-lock.json')).version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = \"${JSON.parse(read('package.json')).version}\"`)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Run 314 screen experience gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
