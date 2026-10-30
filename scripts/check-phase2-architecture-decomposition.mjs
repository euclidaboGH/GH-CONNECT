#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const checks = [
  ['mutation contracts exist', existsSync(join(root, 'lib/contracts/mutations.ts'))],
  ['financial label guard exists', /assertFinancialLabelNotInvented/.test(read('lib/contracts/mutations.ts'))],
  ['marketplace authority contract', existsSync(join(root, 'lib/contracts/marketplace-authority.ts'))],
  ['checkout authority rejects client total mismatch', /CLIENT_TOTAL_REJECTED/.test(read('features/marketplace/sections/checkout-authority.ts'))],
  ['safe API error helper', existsSync(join(root, 'lib/client/safe-api-error.ts'))],
  ['api.ts uses safe messages', /toClientSafeErrorMessage/.test(read('lib/api.ts'))],
  ['wallet domain provider non-mutating', /canMutateFinances:\s*false/.test(read('contexts/domains/wallet-domain-provider.tsx'))],
  ['wallet read provider non-mutating', /canMutateFinances:\s*false/.test(read('contexts/domains/wallet-read-provider.tsx'))],
  ['bottom nav Home Cart Wallet Profile', /BOTTOM_NAV_IDS = \["home", "cart", "wallet", "profile"\]/.test(read('lib/navigation/destinations.ts'))],
  ['app nav items cart wallet', /id: "cart"/.test(read('components/ghc/app.tsx')) && /id: "wallet"/.test(read('components/ghc/app.tsx'))],
  ['cart opens marketplace', /id === "cart"/.test(read('components/ghc/app.tsx')) && /setMarketplaceOpen\(true\)/.test(read('components/ghc/app.tsx'))],
  ['wallet opens overlay', /id === "wallet"/.test(read('components/ghc/app.tsx')) && /openWallet\(\)/.test(read('components/ghc/app.tsx'))],
  ['wallet sections barrel', existsSync(join(root, 'features/wallet/sections/index.ts'))],
  ['phase2 e2e spec present', existsSync(join(root, 'e2e/phase2-critical-journeys.spec.ts'))],
  ['ghc-context still has domain slices', /GHCFeedContext/.test(read('contexts/ghc-context.tsx')) && /GHCMessagingContext/.test(read('contexts/ghc-context.tsx'))],
  ['phase1 sanitize conventions retained', /sanitizeClientMessage/.test(read('lib/server/http/api-conventions.ts'))],
  ['economy json no-store retained', /FINANCIAL_NO_STORE_HEADERS/.test(read('lib/server/economy/http.ts'))],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 2 architecture decomposition: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
