#!/usr/bin/env node
/** Regression guards for Phase 2 rewards and the adjacent payment boundaries. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) })

const claimClient = read('lib/rewards/claim-daily-client.ts')
const dailyApi = read('app/api/economy/rewards/daily/route.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const marketplace = read('app/api/marketplace/listings/route.ts')
const community = read('app/api/communities/route.ts')
const feed = read('components/ghc/enhanced-feed-screen.tsx')

check('daily claim replay requires explicit ALREADY_CLAIMED_TODAY', claimClient.includes('data.code === "ALREADY_CLAIMED_TODAY" && response.ok && data.ok === true'))
check('daily claim rejects incomplete success payloads', claimClient.includes('!response.ok || data.ok !== true'))
check('daily claim POST bypasses browser cache', /postDailyClaim[\s\S]*?cache: "no-store"/.test(claimClient))
check('daily reward remains a pending 48-hour entitlement', dailyApi.includes('atomic.pending !== true || !atomic.redeemableAt'))
check('wallet partial settlement does not display aggregate as available', wallet.includes('const allSettled = claimed === ids.length') && wallet.includes('if (allSettled)'))
check('wallet requests authoritative refresh after claim attempts', wallet.includes('await refreshWalletAuthority()') && wallet.includes('pending-hold-claimed'))
check('Rewards Centre avoids timestamp-generated retry identity', !rewards.includes('reward-claim-${Date.now()}-${rewardId}') && rewards.includes('body: JSON.stringify({ holdId: rewardId })'))
check('marketplace listing activation verifies payment intent', marketplace.includes('verifyListingFeePayment') && marketplace.includes('listingFeeRequiresSettlement'))
check('community creation fails closed without durable storage', community.includes('if (!socialDbConfigured())') && community.includes('nonDurableWriteResponse("Community create"'))
check('feed marketplace interstitial uses canonical overlay navigation', feed.includes('onOpenMarketplace={() => window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "marketplace" }))}') && !feed.includes('onOpenMarketplace={() => setTab("marketplace")}'))

let failures = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`)
  if (!item.ok) failures++
}
console.log(`\nPhase 2 reward/payment contract: ${checks.length - failures}/${checks.length} passed`)
process.exit(failures ? 1 : 0)
