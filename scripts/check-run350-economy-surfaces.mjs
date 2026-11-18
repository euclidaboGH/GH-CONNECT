#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const curationGuards = read('lib/curation/client-curation-guards.ts')
const postCard = read('components/ghc/enhanced-post-card.tsx')
const txDetail = read('components/ghc/ghc-transaction-detail.tsx')
const walletTypes = read('features/wallet/wallet-types.ts')
const app = read('components/ghc/app.tsx')
const cartSep = read('lib/commerce/cart-wallet-separation.ts')
const walletUp = read('lib/active-upgrades/wallet.ts')
const rewardsUp = read('lib/active-upgrades/rewards.ts')
const membershipUp = read('lib/active-upgrades/membership.ts')
const ordersUp = read('lib/active-upgrades/orders.ts')
const marketUp = read('lib/active-upgrades/marketplace.ts')
const membershipDomain = read('lib/domains/membership-domain.ts')
const navigate = read('lib/navigation/navigate.ts')

const checks = [
  ['curation expands AUTH_REQUIRED and RATE_LIMITED messages', /AUTH_REQUIRED/.test(curationGuards) && /RATE_LIMITED/.test(curationGuards)],
  ['post card blocks own-post curation before API', /isOwn \|\| isSelfCuration/.test(postCard) && /humanizeCurationError\("SELF_CURATION"\)/.test(postCard)],
  ['post card uses shared curation debounce constant', /CURATION_UI_DEBOUNCE_MS/.test(postCard)],
  ['transaction detail earned label matches wallet TX_LABELS', /earned: "Activity credit"/.test(txDetail) && /earned: "Activity credit"/.test(walletTypes)],
  ['openSettings closes marketplace and wallet overlays', /setMarketplaceOpen\(false\)/.test(app) && /setWalletOpen\(false\)/.test(app.split('openSettings')[1] || '')],
  ['cart/wallet separation policy present', /SURFACE_WALLET/.test(cartSep) && /SURFACE_CART/.test(cartSep)],
  ['wallet upgrades export spendableAmount and durable summary guard', /spendableAmount/.test(walletUp) && /isDurableWalletSummary/.test(walletUp)],
  ['rewards upgrades export claim CTA and claim error humanizer', /canShowClaimCta/.test(rewardsUp) && /humanizeRewardClaimError/.test(rewardsUp)],
  ['membership upgrades export tier/active helpers', /membershipTierLabel/.test(membershipUp) && /membershipActive/.test(membershipUp)],
  ['orders upgrades export terminal and action helpers', /isTerminalOrderStatus/.test(ordersUp) && /orderNeedsBuyerAction/.test(ordersUp)],
  ['marketplace upgrades export cart gate and bucket labels', /canAddListingToCart/.test(marketUp) && /marketplaceBucketLabel/.test(marketUp)],
  ['membership domain uses shared humanizeMembershipError', /humanizeMembershipError/.test(membershipDomain)],
  ['orders deep-link still opens marketplace orders bucket', /marketplaceBucket: "orders"/.test(navigate)],
  ['wallet family still seeds ghc.wallet.focus', /ghc\.wallet\.focus/.test(navigate)],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nRUN350 economy surfaces: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
